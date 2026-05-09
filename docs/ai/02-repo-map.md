# Repo Map

## Purpose
Give future Codex sessions a compact map of ownership boundaries so they can edit the right files without scanning the repo.

## Current Implementation
The repo is a Next.js App Router project with client-heavy dashboard components and tRPC server routers.

Top-level areas:

- `app/`: routes, global layout, global CSS, API route handlers, generated Prisma output.
- `components/`: dashboard, auth screens, list/view components, shadcn/radix UI primitives.
- `hooks/`: client hooks, currently user auth cache and optimistic queue.
- `lib/`: shared helpers, Supabase clients, Prisma client, dashboard cache helpers, optimistic debug tools.
- `trpc/`: tRPC client/server setup, query client, API routers.
- `prisma/`: schema and migrations.
- `docs/`: historical implementation notes and the AI documentation system.
- `public/`: app icon assets.

## Important Files
- `app/layout.tsx`: metadata, fonts, global providers.
- `app/globals.css`: Tailwind v4 imports and shadcn theme tokens.
- `app/api/trpc/[trpc]/route.ts`: tRPC fetch adapter.
- `proxy.ts`: Next proxy matcher for `/dashboard`.
- `trpc/client.tsx`: browser tRPC provider and QueryClientProvider.
- `trpc/server.tsx`: server-side tRPC options proxy and hydration helpers.
- `trpc/query-client.ts`: TanStack Query defaults.
- `trpc/routers/_app.ts`: router composition.
- `lib/db.ts`: Prisma 7 client using `@prisma/adapter-pg`.
- `lib/trpc.ts`: exported router types used by cache helpers and components.
- `components/ui/`: generated shadcn/radix primitives.

## Data Flow
Route ownership:

- Public/auth pages render auth or landing components.
- `/dashboard` renders `Dashboard`, which composes list and view features.
- API requests route through `app/api/trpc/[trpc]/route.ts`.
- Auth confirmation routes share `lib/supabase/auth-confirm.ts`.

Feature ownership:

- List creation: `ListAdder` plus `trpc/routers/listRouter.ts`.
- List display/edit/delete: `ListComponent` plus `listRouter`.
- Item display/create/edit/delete/complete/reorder: `ListComponent`, `ListItemComponent`, `ListsContainer`, `listItemRouter`.
- Tag management: `ListTagPicker` plus `tagRouter`.
- View selection/create/edit/delete/reorder: `ViewsSidebarPreview` plus `viewRouter` and `viewHelpers`.
- Cross-cache reconciliation: `lib/dashboard-cache.ts`.

## Invariants
- Client components that use hooks must start with `"use client"`.
- tRPC server-only helpers stay in `trpc/server.tsx` and import `server-only`.
- Prisma imports use `@/app/generated/prisma/client`, not `@prisma/client`, because schema output is customized.
- Shared dashboard cache logic belongs in `lib/dashboard-cache.ts` when it affects more than one component.
- UI primitives in `components/ui` should not absorb app-specific dashboard state.

## Known Risks
- `app/generated/prisma` is generated output under `app/`; future edits should not manually patch it.
- Existing docs in `docs/optimistic-updates.md` and `docs/app-reverse-engineering.md` may drift unless AI docs are maintained.
- Some components own substantial logic directly, especially `ListsContainer`, `ViewsSidebarPreview`, and `ListTagPicker`.

## What Codex Should Read Before Editing
- Always read this file and the feature-specific doc.
- For component work, read the target component and `09-ui-components.md`.
- For server work, read the relevant router and `04-auth-and-api.md`.
- For generated types, read `components/list/types.ts`, `lib/trpc.ts`, and `prisma/schema.prisma`.

## What Codex Must Update After Editing
- Add new files, ownership shifts, or route changes here.
- Update the relevant feature doc with new data flow or invariants.
- Update `backlog.md` with any refactor or decomposition tasks identified.
