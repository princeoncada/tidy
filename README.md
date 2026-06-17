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

The production build runs with `npm run build` then `npm start` (the build step runs `prisma generate`). Database migration and build-readiness details are documented separately.

---

Made by Prince Oncada.
