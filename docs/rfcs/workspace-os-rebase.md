# Workspace OS Rebase RFC

Status: Proposed (3.6.4)

This RFC is decision-only. It records the architecture and product direction for the Workspace OS rebase; it implements no runtime behavior, schema migration, UI change, route, mutator, or feature flag. Implementation begins in 4.0.0.

## Context & Motivation

Tidy currently works as an authenticated personal todo workspace: lists, list items, tags, custom tag-based views, workspace navigation, sharing, a status board, collaborative item notes, and recent history all run on the current local-first dashboard foundation.

The next product direction is broader. The 4.0 Workspace OS Rebase Arc in `docs/FUTURE_PLANS.md` sets the goal: evolve Tidy from a todo-list productivity app into a lightweight workspace OS. This RFC scopes that pivot without duplicating the roadmap. The intent is to preserve the proven local-first technical spine while changing the product grammar deliberately, so future phases do not blindly rename existing models or start with a large schema rewrite.

The product target is not a wholesale clone of another app. Tidy should absorb the useful grammar of pages, projects, work items, and views while keeping its own restrained UI, authenticated personal-workspace shape, and thin vertical-slice delivery discipline.

## Target Product Grammar

| Target noun | Definition | Relationship |
| --- | --- | --- |
| Workspace | The top-level authenticated collaboration and permission boundary. | Owns or scopes project-spaces, membership, sharing, and user navigation. |
| Project-space (project) | A focused work area for a domain, initiative, client, area of life, or project. | Lives inside a workspace and contains pages, work items, views, and scoped labels/properties. |
| Page | A structured document or canvas for context, planning, notes, specs, or durable knowledge. | Belongs to a workspace or project-space; may be linked from work items or views in later phases. |
| Work item | An actionable unit of work with status, assignment, ordering, and optional note/body context. | Usually belongs to a project-space; appears in views and can be represented on list or board surfaces. |
| View | A saved projection over project-spaces, work items, pages, or a constrained subset of those objects. | Uses filter/order/grouping rules; initially evolves from existing custom views rather than introducing a universal object graph. |

This grammar is intentionally small. It is large enough to move beyond todo lists, but narrow enough to prove through the existing dashboard shell and sync model.

## Current-to-Target Noun Mapping

| Current noun | Target concept | Treatment | Rationale |
| --- | --- | --- | --- |
| List | Project-space | Re-scoped gradually; not a blind rename in 4.0.0. | A current list is already the main container for grouped work, ordering, sharing, and dashboard projection. The first target step should present and model it as a project-space while keeping the existing backing shape until runtime proof exists. |
| ListItem | Work item | Re-scoped gradually. | Current items already carry actionable work semantics, status, assignee, ordering, completion, and collaborative notes. They are the clearest bridge to target work items. |
| Tag | Label/property primitive | Kept and broadened later. | Tags are useful as lightweight classification and view-filter inputs. Later phases can decide whether they become project labels, work-item labels, properties, or a split model. |
| View | View | Kept and broadened later. | The target grammar still needs saved projections. Existing views should evolve from tag/list projections before any universal view system is attempted. |
| ViewList | View-to-project-space inclusion/order edge | Re-scoped later. | The current edge orders lists inside a custom view. In the target grammar it can become the ordered project-space subset for a view while keeping the current ordering contract. |
| ViewTag | View filter edge | Re-scoped later. | Current tag filtering remains useful, but the target view grammar may later filter over labels, project-space metadata, or work-item properties. |
| ListTag | Project-space label edge | Re-scoped later. | Current list tags classify containers. That maps naturally to project-space labeling before any richer property model is introduced. |
| Workspace | Workspace | Kept as-is conceptually. | `docs/AI_HANDOFF.md` Forward Arc Invariants (3.0+) say the existing workspace model is kept, not replaced. |
| WorkspaceMember | Workspace membership/role edge | Kept and extended only when scoped. | Workspace membership already expresses collaboration boundaries and should remain the basis for higher-level workspace permissions. |
| ListShare | Project-space share edge | Re-scoped later. | The current list-level share model can become project-space sharing, but permission semantics must be preserved and migrated deliberately. |
| ShareLink | Invite link | Kept and re-scoped only when scoped. | Share links remain the external invitation mechanism; later phases can decide which target resources they invite into. |

## Preserved Technical Spine

The rebase evolves the existing app shell. It does not replace the runtime foundation.

The following remain preserved constraints, sourced from the Forward Arc Invariants (3.0+) in `docs/AI_HANDOFF.md`:

- One Replicache structural-sync spine remains the sole structural-sync path. The rebase must not introduce a second structural-sync lane.
- Yjs remains the document-body collaboration path for collaborative bodies.
- Supabase auth and user-scoped permissions remain the auth and permission spine.
- The existing workspace model is kept.
- shadcn/Radix remains the component foundation.
- Presence remains on a separate transport from Replicache structural sync. Presence must not be coupled into Replicache push/pull.

These constraints matter because the rebase changes product grammar, not the sync architecture by default. Any phase that proposes changing the preserved spine needs a separate architecture decision.

## Data-Model Implications

The target grammar implies future schema and Replicache-key work, but 4.0.0 must not begin with a large schema rewrite.

Likely future implications:

- Decide whether `List` remains the persisted project-space model for a longer compatibility window or receives a later table/model rename.
- Decide whether `ListItem` remains the persisted work-item model during the first rebase slices or receives a later table/model rename.
- Introduce page storage only when the first page behavior is scoped; do not create a universal page model ahead of runtime proof.
- Preserve existing Replicache key shapes during the first slice unless a targeted alias or compatibility layer is explicitly scoped.
- Define any future key migration from `list/{id}` and `listItem/{id}` to target names as a staged migration with backward compatibility, pull/push correctness, and rollback behavior.
- Treat `ViewList`, `ViewTag`, and `ListTag` as existing relation edges that may be reinterpreted before they are replaced.
- Keep permission checks attached to the effective target resource, especially when current list-level sharing becomes project-space sharing.
- Keep ordering authorities explicit: list/project-space order, item/work-item order, board/status order, and view order must not be collapsed into ambiguous generic ordering.

The first implementation slice should prove the product grammar on top of the current structures. Schema migration comes only after the new noun boundaries have been validated in runtime behavior.

## Design-System Implications

`docs/design.md` remains the UI source of truth. This RFC can name design implications, but it does not update design contracts.

The target grammar will eventually require design decisions for project-space navigation, page surfaces, work-item density, view controls, empty states, status/property editing, and how the dashboard shell communicates workspace-level versus project-level context. Those changes must be made as later, separately scoped edits to `docs/design.md` when a runtime phase changes the UI contract.

Until then, the rebase must preserve current design-system constraints: restrained chrome, semantic tokens, accessible controls, the shadcn/Radix foundation, optimistic/local-first feedback, and the existing shell contracts.

## Agent-Workflow Implications

The role model established in 3.6.3 carries into the rebase arc:

- Claude Code remains the future-plan architect and implementation explainer.
- Codex remains the implementer and automated-validation evidence reporter.
- ChatGPT remains the audit, second-opinion, and docs-workflow reviewer.
- The user/controller remains responsible for manual product validation and closeout.

This RFC introduces no new role boundaries. Future Workspace OS phases should continue to use small scoped prompts, targeted read sets, automated validation evidence from Codex, and user/controller approval for manual product proof and closeout.

## Migration Sequence & Risks

High-level migration path:

1. Prove the target grammar in the existing dashboard shell with a thin 4.0.0 vertical slice.
2. Introduce project-space framing around the current list-backed surface without changing the sync spine.
3. Reframe list items as work items only where the slice needs it, keeping existing behaviors and tests intact.
4. Extend views only after project-space and work-item language has a stable runtime home.
5. Add page behavior as its own scoped slice, using Yjs bodies where collaborative document bodies are required.
6. Revisit schema and Replicache key naming only after the product grammar has runtime proof and migration risks are understood.

Key risks:

- Sync correctness: Replicache pull/push, CVR diffs, mutator semantics, correction behavior, and poke self-healing must remain correct while nouns are reinterpreted.
- Permissions: workspace, project-space/list sharing, assignee access, note access, and share links must preserve user-scoped authorization.
- Local-first rendering: the dashboard must continue rendering from the Replicache store without reintroducing retired tRPC dashboard render paths or pending-overlay behavior.
- Ordering: list/project-space order, work-item order, board order, and view order must remain explicit and stable.
- Migration clarity: partial renames can create confusing mixed language if compatibility boundaries are not named in each phase.
- Design drift: UI copy and layout may imply contracts not yet recorded in `docs/design.md` if design changes are not separately scoped.

The mitigation is thin vertical slices with explicit compatibility language, targeted tests, and no broad runtime rewrite before the new product model is proven.

## Non-Goals / Deferral Boundary

This RFC and the first 4.0.0 implementation slice do not include:

- A Notion clone.
- A Plane clone.
- A full page editor.
- A universal object graph.
- A command palette.
- Backlinks.
- Analytics.
- A mobile app.
- MCP integration.
- A complete schema migration.
- Replacement of Replicache.
- Replacement of Yjs.
- Replacement of shadcn/Radix.
- Replacement of the Supabase auth and permission spine.
- Replacement of the current workspace model.
- A second structural-sync path.

Native mobile and MCP are folded into the 4.0.0 deferral boundary until separately scoped. They remain possible future directions, but they are not first-slice work.

## First 4.0.0 Implementation Slice

The thinnest 4.0.0 slice should prove the new product grammar on the existing authenticated dashboard shell and Replicache spine with minimal runtime disruption.

Recommended slice:

- Introduce a project-space framing layer for the current list-backed dashboard surface.
- Keep `List` and `ListItem` as the backing runtime entities for the slice.
- Present the primary container as a project-space/project in the UI area scoped by 4.0.0, while clearly preserving compatibility where current list behavior remains.
- Present the actionable child noun as a work item only in the same narrow surface, without changing the underlying mutator or Replicache key contracts unless explicitly required by that slice.
- Keep workspace navigation, custom views, tags, board behavior, sharing, permissions, Yjs notes, and presence on their existing technical paths.
- Add targeted tests proving the new product grammar appears in the selected UI path and that existing list/item behavior, sync, permissions, local-first rendering, and ordering remain intact.
- Update `docs/AI_HANDOFF.md`, `docs/design.md`, and `docs/CONTEXT_INDEX.md` only as required by the runtime changes in that phase.

This slice is intentionally a product-model proof, not a schema migration. It should make users begin to see Tidy as a workspace made of project-spaces and work items while preserving the proven app shell and sync behavior.
