# Tidy

Tidy is an optimistic-updates-first productivity app focused on speed, fluid interactions, and modern task management workflows.

Built with a performance-first mindset, the app delivers near-instant UI feedback through aggressive optimistic updates, smooth drag-and-drop interactions, and scalable state management designed for growing interconnected data structures.

## Features

- ⚡ Optimistic updates for instant user feedback
- 🧠 Smart task organization with lists and views
- 🏷️ Tag-based filtering and categorization
- 🎯 Drag-and-drop task and list management
- 🔄 Debounced reordering and sync handling
- 📱 Responsive modern UI
- 🛠️ Built with type-safe full-stack architecture
- 💾 Persistent database-backed state management
- 🎨 Clean and minimal productivity-focused design

## Tech Stack

- Next.js
- TypeScript
- React
- TailwindCSS
- tRPC
- Prisma
- PostgreSQL
- TanStack Query
- DND Kit
- Framer Motion
- shadcn/ui

## Philosophy

Tidy is designed around one core principle:

> User feedback should feel instant.

The project explores advanced optimistic UI patterns, scalable frontend architecture, and seamless interaction design while maintaining strong developer experience and type safety.

## Current Status

🚧 In active development.

The project is continuously evolving with improvements to:

- Real-time interaction handling
- Optimistic mutation queues
- Drag-and-drop UX
- View systems
- Tag filtering
- Performance optimization
- Offline/PWA support

## Goals

- Create a productivity app that feels instantaneous
- Push optimistic UI patterns to production-ready quality
- Build scalable interaction systems for complex task management
- Explore modern full-stack architecture patterns

---

## Environment Variables

Copy `.env.example` to `.env` and provide values before running the app.

| Variable | Required | Exposure | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | Server | PostgreSQL connection string read by the Prisma client (`lib/db.ts`). Use a pooled URL in production. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public | Supabase project URL (auth + realtime). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Public | Supabase publishable (anon) key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Prod | Server only | Lets the server SEND realtime pokes (the `/api/replicache/push` doorbell) so shared changes propagate quickly. Bypasses RLS; never expose to the client. Without it, pokes no-op and clients heal via the periodic Replicache pull. |
| `NEXT_PUBLIC_SITE_URL` | Prod | Public | Canonical absolute site URL (no trailing slash) for metadata and share links. Falls back to `VERCEL_URL`, then `localhost`. |
| `NEXT_PUBLIC_OFFLINE_APP_SHELL_ENABLED` | No | Public | Opt-in offline app-shell service worker. Default off. |
| `NEXT_PUBLIC_YJS_NOTES_ENABLED` | No | Public | Opt-in collaborative (Yjs) item notes. Default off. |
| `VERCEL_URL` | Auto | Server | Set automatically by Vercel; used as a site-URL fallback. Do not set manually. |
| `PORT` | No | Server | Local dev port (defaults to 3000). |

E2E credentials (`E2E_TEST_EMAIL_*` / `E2E_TEST_PASSWORD_*`) are only needed to run the Playwright suites; see `.env.example`.

> Replicache has no dedicated environment variable. The render path and the former license key were retired in the 2.0.x series; Replicache runs entirely through the `/api/replicache/push` and `/api/replicache/pull` server routes, backed by `DATABASE_URL` and the Supabase realtime poke above.

## Local Development

```bash
# Install dependencies (postinstall runs prisma generate)
npm install

# Configure environment, then edit .env with your local values
cp .env.example .env

# Start the dev server at http://localhost:3000
npm run dev
```

Locally you can leave `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL` unset: realtime pokes simply no-op (clients still heal via the periodic pull) and absolute URLs fall back to `http://localhost:3000`.

## Deployment

The app targets a Node/Vercel host with a managed PostgreSQL database (e.g. Supabase Postgres). Set every Required and Prod variable from the table above in the host's environment settings.

Local vs production differences:

- `DATABASE_URL` - use a pooled connection string in production/serverless; a direct local URL is fine for development.
- `NEXT_PUBLIC_SITE_URL` - required in production (the canonical domain); omit locally to use the `localhost` fallback.
- `SUPABASE_SERVICE_ROLE_KEY` - set in production so realtime pokes are delivered; keep it server-only. Optional locally (pokes no-op without it).
- `VERCEL_URL` - provided automatically on Vercel; never set it manually.

Database migration and production build steps are documented in **Database & Migrations** and **Production Build & Release** below.

## Database & Migrations

Prisma reads `DATABASE_URL` through `prisma.config.ts`, which loads `dotenv/config` and sets `datasource.url` from the environment. The schema's `datasource` block intentionally has no `url`: the runtime client connects through the `pg` driver adapter (`@prisma/adapter-pg`), while the Prisma CLI reads the connection from `prisma.config.ts`.

Common commands:

- `npx prisma generate` - regenerate the typed client into `app/generated/prisma`. Runs automatically on `postinstall` and at the start of `npm run build`.
- `npx prisma migrate dev` - local only: create a new migration from schema changes and apply it to your dev database.
- `npx prisma migrate deploy` - production/CI: apply all pending migrations in `prisma/migrations/` in order, without diffing the schema. Run this against the production database as part of every release.
- `npx prisma migrate status` - report which migrations are applied or pending.

### Manual SQL policies (not in the Prisma migration history)

`prisma/sql/` holds Supabase Realtime RLS setup that Prisma migrations do **not** manage. Apply each file once per environment (e.g. via the Supabase SQL editor or `psql`), in addition to `prisma migrate deploy`:

- `2_0_3_realtime_poke_rls.sql` - authenticated users can receive only their own broadcast pokes.
- `2_0_6_note_collab_rls.sql` - RLS for Yjs collaborative item notes.

Without these policies the realtime poke and Yjs note paths degrade (clients fall back to periodic pull).

## Production Build & Release

A repeatable release runs in this order:

1. Set every Required and Prod environment variable from the table above in the host.
2. `npm ci` - install exact dependencies; `postinstall` runs `prisma generate`.
3. `npx prisma migrate deploy` - apply pending migrations to the production database.
4. Apply any not-yet-applied `prisma/sql/*` policies (see above).
5. `npm run build` - runs `prisma generate` then `next build`.
6. `npm start` - serve the production build (`next start`).

## Post-Deploy Smoke Checklist

After each production deploy, manually walk the core path before announcing the release. This is a fast confidence check, not a replacement for the automated suites.

1. **Log in** - sign in with a real account; the dashboard loads without an auth redirect loop.
2. **Dashboard loads** - existing lists and items render.
3. **Create a list and an item** - both appear instantly.
4. **Tag / custom view** - open a tag or custom view and confirm the expected items are projected.
5. **Reorder** - drag an item (or list) to a new position; the new order holds.
6. **Refresh** - reload the page; everything created and reordered above is still present.
7. **Two-client sync** - in a second client signed in to the same (or a shared) workspace, make a change in one and confirm it appears in the other within a few seconds via the realtime poke, or after the next periodic pull.

If a step fails, recheck `npx prisma migrate status`, that the `prisma/sql/*` policies were applied, and that every Required and Prod environment variable from the tables above is set in the host.

---

Made by Prince Oncada.
