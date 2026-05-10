# AI Agent Instructions

<!-- BEGIN:nextjs-agent-rules -->
## This is NOT the Next.js you know

This project uses newer framework versions with breaking changes — APIs, conventions, and file structure may differ from older assumptions. Follow existing repo patterns first. If you are changing Next.js app APIs and `node_modules/next/dist/docs/` exists, read the relevant local Next guide before writing code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Required Reading Path

Before editing any file, route yourself through the repo-specific AI docs instead of scanning the whole repository:

1. Start with `docs/ai/00-ai-entrypoint.md`.
2. Read `docs/ai/12-implementation-rules.md` before implementation.
3. Read `docs/ai/13-testing-and-validation.md` before validation.
4. Use `docs/ai/task-routing-guide.md` to choose only the feature-specific docs needed for the task.
5. Read feature-specific docs only after understanding the task and the required scope.

Do not broadly inspect the repo unless the task cannot be understood from the AI docs plus the smallest relevant source files.

## Required Test Workflow

Every Codex implementation must update or add tests in the same branch. Before coding, identify the happy path, common cases, edge cases, unit coverage, and E2E coverage. After coding, run `npm run test:ci` and report exact results. Do not mark complete if tests were not added or updated unless clearly justified.

Use `docs/testing-validation.md` as the source of truth for the test-first change workflow, coverage by change type, edge-case checklist, and definition of done.

## Scope Control

- Keep diffs small and focused on the requested task.
- Do not touch unrelated files.
- Do not broadly refactor while implementing a narrow change.
- Do not rename public APIs, routes, models, query keys, or component contracts unless the task explicitly requires it.
- Do not modify generated Prisma output under `app/generated/prisma`.
- Do not modify lockfiles unless the package manager automatically requires it for an explicitly requested dependency change.
- Do not update package versions unless explicitly asked.

## Behavior to Preserve

Unless the task specifically changes these areas, preserve:

- Optimistic updates and rollback behavior.
- TanStack Query keys and cache shapes.
- Dashboard cache projection rules.
- Drag-and-drop invariants, including local-only hover state and stable cache/server writes on committed actions.
- View/list/item ordering semantics.
- Supabase user scoping and protected tRPC procedure patterns.

## Documentation Expectations

- Update relevant `docs/ai/*.md` files when behavior, data flow, validation, invariants, risks, or implementation patterns change.
- Update `docs/ai/backlog.md` when completing documented work or discovering follow-up risks.
- Prefer concise docs updates that help future agents avoid extra repo scanning.
