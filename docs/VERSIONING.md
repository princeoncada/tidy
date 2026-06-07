# Versioning

## Version Format

```
X.Y.Z-[state]
```

- **X** - Major: architectural shift (new persistence layer, framework upgrade, full system replacement)
- **Y** - Minor: significant feature or phase completion
- **Z** - Patch: bug fix, doc correction, minor tweak
- **State**: `alpha` (implemented, not validated) | `stable` (fully validated, committed to master)

## Five Versioning Locations

Every version bump must update **all five** in the same commit:

1. `STATE.json` - `version` + `state` fields (machine-readable oracle; read first every session)
2. `docs/VERSIONING.md` - current version state + rules (this file)
3. `docs/AI_HANDOFF.md` - version comment at top
4. `package.json` - `version` field
5. `docs/WORKFLOW.md` - version comment at top

Use `.\scripts\open-phase.ps1` to open a new `-alpha` phase across all five locations automatically.
Use `.\scripts\promote.ps1` to promote `-alpha` -> `-stable` across all five locations automatically.

## Doc Continuity Model

Every fact that appears in more than one doc has exactly ONE owner. Other docs must
either reference the owner (Point), be synced from it by a script (Sync), or be
checked against it by `validate.ps1` (Gate). Never hand-copy an owned fact into a
new place - that is how drift starts.

| Fact | Owner | Where it also appears | Kept in sync by |
|------|-------|-----------------------|-----------------|
| Version + state string | `STATE.json` (`version`, `state`) | VERSIONING (current state), AI_HANDOFF (comment + prose), package.json, WORKFLOW (comment) | Sync: `open-phase.ps1` (alpha) + `promote.ps1` (stable) + Gate: `validate.ps1` |
| Phase identity (number + title) | `STATE.json` (`phase`, `phaseTitle`) | VERSIONING (Current State), AI_HANDOFF (Current Phase) | Gate: `validate.ps1` checks current VERSIONING and AI_HANDOFF copies against STATE.json |
| Next phase | `STATE.json` (`nextPhase`) | VERSIONING (Next phase line), AI_HANDOFF (Next line) | Sync: `open-phase.ps1` (alpha) + `promote.ps1` (stable) + Gate: `validate.ps1` checks copies and stable roadmap agreement |
| Next backlog item | `docs/FUTURE_PLANS.md` (first Planned) | reported at startup; compared with STATE.json nextPhase when stable | Point: read fresh each session + Gate: `validate.ps1` |
| Roadmap (version-sequenced) | `docs/FUTURE_PLANS.md` (Planned) | startup reads it; VERSIONING holds version rules + current state only | Point: FUTURE_PLANS is the single roadmap owner |
| Roadmap closeout | `docs/FUTURE_PLANS.md` (Completed / In Progress / Planned) | promotion workflow | Sync: `promote.ps1` closes the promoted roadmap item + Gate: `validate.ps1` catches stale phase/backlog drift |
| Completed-version history (version + title + date) | `docs/FUTURE_PLANS.md` (Completed) | VERSIONING points to it (no history table) | Sync: `promote.ps1` writes the Completed bullet + Gate: `validate.ps1` |
| Session state snapshot | `STATE.json` + `docs/FUTURE_PLANS.md` | the chathead opener | Point: opener tells the AI to read them; it must NOT embed a snapshot |
| Project rules / entrypoint | `AGENTS.md` | `CLAUDE.md` (imports it via `@AGENTS.md`) | Point: CLAUDE.md must stay a one-line import and never restate rules |

Rules:
- Adding a new copy of an owned fact is drift. Point to the owner instead.
- `CLAUDE.md` is a thin `@AGENTS.md` import - never add rule text directly to it.
- The roadmap lives only in `docs/FUTURE_PLANS.md` (Planned). Do not keep a second
  roadmap table in VERSIONING.md.
- Completed-version history lives only in `docs/FUTURE_PLANS.md` (Completed).
  VERSIONING.md does not keep a version-history table; its `## Version History`
  section is a pointer to FUTURE_PLANS Completed.
- FUTURE_PLANS remains the single owner of the forward roadmap. Promotion may
  close the promoted roadmap item there, but FUTURE_PLANS is roadmap state, not
  a sixth versioning location.
- When state is stable, `STATE.json.nextPhase` must equal the first Planned
  heading in `docs/FUTURE_PLANS.md`. `validate.ps1` gates this agreement, and
  `promote.ps1` blocks promotion if closeout would leave drift.
- `STATE.json` owns `nextPhase`; `docs/FUTURE_PLANS.md` owns the roadmap and
  first Planned heading. When stable, they must agree. `validate.ps1` gates the
  agreement, while `open-phase.ps1` and `promote.ps1` enforce it during phase
  transitions. FUTURE_PLANS remains roadmap state, not a sixth versioning
  location.
- When opening alpha, `open-phase.ps1` requires `STATE.json.nextPhase` to exist
  in Planned unless `-AllowMissingNextPhase` is used for a scoped roadmap rewrite
  patch that adds or renumbers FUTURE_PLANS before validation.
- Prompt format safety is a workflow invariant. Docs that define prompt
  templates must avoid nested fenced code blocks. Workflow prompts should be
  emitted as separate top-level sections: Section 1 master prompt, Section 2
  validation, and optional commit/promotion blocks. When a section itself is
  fenced, examples inside it must be unfenced or indented.
- Repo state questions are answered from pushed GitHub state or local repo state
  depending on execution context. ChatGPT reviewer mode uses pushed GitHub
  state plus pasted local evidence; local-only facts are not visible to ChatGPT
  until pasted or pushed. The Local Evidence Packet is the bridge for local
  ChromaDB, graph output, git diff/status, and validation output. This does not
  change `STATE.json` ownership or `docs/FUTURE_PLANS.md` ownership, and prompt
  format safety still applies when documenting the Local Evidence Packet.
- `docs/PHASE_LOG.md` is historical traceability for pre-versioning work and old
  checkpoint evidence. It is not an active workflow surface for new versioned
  phases.
- The chathead opener instructs reading `STATE.json` + `docs/FUTURE_PLANS.md`; it
  must never embed a "current state" or "next work" snapshot.

## Rules

**Bug Fix Rule**: Any bug discovered after a stable release always opens a `Z+1` patch. Never modify a stable release in place. The implementation prompt must bump all five locations to `X.Y.(Z+1)-alpha`.

**Version Ordering Rule**: Versions must be monotonically increasing and reflect actual implementation order, not planned order. If a phase is built out of sequence, assign the next available `Y.Z` after the last stable release - never fill gaps or retrofit.

**Planned Renumber Rule**: Planned (not-yet-built) versions in `docs/FUTURE_PLANS.md` may be renumbered to stay monotonic. Inserting a new minor or major pushes the later planned numbers back (e.g. inserting 1.2.0 pushed Phase 3 Completion 1.2.0 -> 1.3.0). Patches (Z) may ship under the current minor before the next X/Y. Renumber only planned items - never a released version.

**Alpha Rule**: A version stays `-alpha` until `npm run test:ci` passes clean. Do not promote to stable until the full validation suite is green.

---

## Current State

- **Current version:** 1.9.14-alpha
- **Current phase:** 1.9.14 - Version-History Ownership De-Dup
- **Next phase:** 1.9.15 - Retire/Compress ai-harness Pointer Surface

---

## Pre-Versioning Baseline

Everything below was built before formal versioning was introduced (pre-1.0.0). Documented for traceability.

### Core Application Bootstrap (pre-1.0.0)

Tidy was bootstrapped as a Next.js 16 / React 19 / TypeScript strict productivity app:

- **Auth**: Supabase email/password + OTP; proxy-guarded `/dashboard` route (`proxy.ts`)
- **API**: tRPC 11 with protected procedures, Prisma 7 + PostgreSQL via `@prisma/adapter-pg`
- **Client state**: TanStack Query 5, `lib/dashboard-cache.ts` centralized cache helpers, `hooks/useOptimisticSync.ts` module-level queue
- **UI**: dnd-kit drag-and-drop, shadcn/radix, Tailwind v4, Framer Motion
- **Features**: Lists, items (with completion + ordering), custom views, tag system (ALL/ANY match modes), view reordering
- **Docs**: `docs/ai/` system with 14 feature reference docs (deprecated in v1.0.0; content consolidated into `docs/AI_HANDOFF.md` and `docs/CODEX_RULES.md`)

### Phase 1: Dexie Foundation (pre-1.0.0) - COMPLETE

Branch merged to master. Added local-first persistence layer:

- Dexie v4 local database + schema (`lib/local/db.ts`)
- Outbox operation types and metadata repository helpers
- Sync status model foundation
- No server sync triggered (intentional: foundation only, runtime behavior unchanged)

Phase log: `docs/PHASE_LOG.md` (Phase 1 section)

### Phase 2: Outbox Sync Queue (pre-1.0.0) - COMPLETE

Branch ready for merge review at time of versioning introduction. Added durable write queue infrastructure:

- `OutboxOperation` model with coalescing rules
- Replay client contract and sync endpoint scaffolding
- Sync status surface in UI
- Runtime behavior intentionally unchanged (auto-sync deferred to Phase 4)

Phase log: `docs/PHASE_LOG.md` (Phase 2 section)

### Phase 3: View Filter Hardening (pre-1.0.0) - IN PROGRESS

Active branch: `checkpoint/fix-cross-view-list-moves`. Fixing projection consistency for custom views (ANY-mode list visibility, cross-view list moves, tag relation consistency):

| Checkpoint | Branch | Status |
|---|---|---|
| 1: fix-view-list-projection | `checkpoint/fix-view-list-projection` | Done |
| 2: fix-tag-relation-consistency | `checkpoint/fix-tag-relation-consistency` | Done |
| 3: fix-cross-view-list-moves | `checkpoint/fix-cross-view-list-moves` | Active |
| 4-6 | TBD | Planned |

Phase log: `docs/PHASE_LOG.md` (Phase 3 section)

---

## Version History

Completed-version history - version, title, and stable date for every released phase - lives in `docs/FUTURE_PLANS.md` under `## Completed`, the single owner. This file no longer maintains a duplicate history table; it keeps the version format, the five-location rules, the Doc Continuity Model, current state, and the pre-versioning baseline only. `promote.ps1` records each promotion as a `## Completed` bullet in `docs/FUTURE_PLANS.md`.

---

## Planned Phases

The forward roadmap lives in `docs/FUTURE_PLANS.md` (the `Planned` section) - the
single version-sequenced owner. This file keeps history + rules only. Do not
maintain a second roadmap table here.

