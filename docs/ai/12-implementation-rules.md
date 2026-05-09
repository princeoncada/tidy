# Implementation Rules

## Purpose
Define repo-specific rules every future implementation must follow.

## Current Implementation
This is a docs-only rules file. It reflects the current architecture and the user's explicit requirement:

Every future implementation must update the relevant docs and backlog in the same PR.

## Important Files
- `AGENTS.md`: local instruction about Next.js docs.
- `docs/ai/00-ai-entrypoint.md`: reading path.
- `docs/ai/backlog.md`: living backlog.
- `docs/ai/15-decision-log.md`: decision history.
- Feature docs in this folder.

## Data Flow
Implementation workflow:

1. Read `00-ai-entrypoint.md`.
2. Read the feature-specific docs.
3. Read the smallest set of source files needed.
4. Make the code change.
5. Validate with lint/type/build/manual checks appropriate to risk.
6. Update docs and backlog in the same PR.

## Invariants
- Do not modify app behavior for documentation-only tasks.
- Do not refactor unrelated source code while fixing a narrow bug.
- Use existing patterns before adding abstractions.
- Keep dashboard cache mutations centralized in `lib/dashboard-cache.ts` when behavior crosses components.
- Keep drag hover local; do not write cache or server during hover.
- Do not send optimistic-only ids to server reorder endpoints.
- Use `protectedProcedure` for user data.
- Validate ownership on server, even if UI only exposes owned ids.
- Prefer batch server writes for reorder operations.
- Keep expensive custom view recompute work outside short Prisma transactions unless proven safe.
- If changing Next app APIs, read relevant local Next docs under `node_modules/next/dist/docs/` when available.

## Known Risks
- The repo does not currently contain `node_modules` in every environment, so local Next docs may be unavailable.
- Some existing implementation violates ideal ownership rules; fix incrementally and document.
- Broad invalidation or cache refetch can hide consistency bugs during manual testing.

## What Codex Should Read Before Editing
- This file.
- Feature docs relevant to the change.
- `13-testing-and-validation.md`.
- `11-known-issues.md`.

## What Codex Must Update After Editing
- Relevant `docs/ai/*.md`.
- `docs/ai/backlog.md`.
- `docs/ai/15-decision-log.md` for behavior/architecture decisions.
- `docs/ai/13-testing-and-validation.md` for new validation commands or manual regression cases.
