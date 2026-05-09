# Auth And API

## Purpose
Document Supabase auth, tRPC setup, protected procedures, and API boundaries.

## Current Implementation
Supabase owns authentication. tRPC owns type-safe API calls. TanStack Query owns client cache.

`trpc/init.ts` creates context by calling the Supabase server client and reading `supabase.auth.getUser()`. `protectedProcedure` requires a user and exposes `ctx.userId`.

The API root is `trpc/routers/_app.ts`:

- `test`
- `user`
- `list`
- `listItem`
- `tag`
- `view`

The HTTP endpoint is `app/api/trpc/[trpc]/route.ts`.

## Important Files
- `trpc/init.ts`: context, transformer, auth middleware.
- `trpc/routers/_app.ts`: router root.
- `trpc/client.tsx`: browser tRPC client and providers.
- `trpc/server.tsx`: server-side tRPC options proxy and hydration helpers.
- `trpc/query-client.ts`: query defaults and superjson hydration.
- `app/api/trpc/[trpc]/route.ts`: tRPC fetch handler.
- `lib/supabase/client.ts`: browser Supabase client.
- `lib/supabase/server.ts`: server Supabase client using Next cookies.
- `lib/supabase/proxy.ts`: auth refresh and dashboard redirect.
- `proxy.ts`: matcher for `/dashboard`.
- `lib/supabase/auth-confirm.ts`: email confirmation and OTP callback.
- `components/AuthSync.tsx`: clears React Query cache on logout.
- `hooks/useUser.ts`: user query wrapper.

## Data Flow
Auth:

1. Register uses `supabase.auth.signUp` with `emailRedirectTo: absoluteUrl("/auth/confirm?next=/dashboard")`.
2. Login uses `supabase.auth.signInWithPassword`.
3. Supabase auth state changes are observed by `AuthSync`.
4. `AuthSync` stores the user in `["user"]` and clears the entire QueryClient when the session disappears.
5. `/dashboard` requests pass through `proxy.ts`; unauthenticated users redirect to `/login`.

tRPC:

1. Client calls `useTRPC()` generated helpers from `trpc/client.tsx`.
2. `httpBatchLink` posts to `/api/trpc`.
3. `fetchRequestHandler` invokes `createTRPCContext`.
4. Protected procedures throw `UNAUTHORIZED` if there is no Supabase user.
5. Routers enforce ownership with `ctx.userId` where implemented.

## Invariants
- All app data procedures that expose user data should use `protectedProcedure`.
- Server code should trust `ctx.userId`, not client-submitted `userId`.
- API inputs use Zod, including UUID validation for ids.
- Client-generated UUIDs are accepted for optimistic list, item, tag, and view creation.
- On logout, call `queryClient.clear()` to prevent previous user cache leaks.
- `absoluteUrl` uses `NEXT_PUBLIC_SITE_URL`, then `VERCEL_URL`, then localhost fallback.

## Known Risks
- Item rename/delete/completion endpoints need stronger ownership checks through `parentList.userId`.
- `proxy.ts` only matches `/dashboard`, not nested dashboard paths if added later.
- Auth form redirects use `redirect()` inside client callbacks after timeout. Future Next versions may prefer router navigation in client event handlers.
- Register button copy says "Login".
- Error handling is mostly toast/log based; no structured API error telemetry.

## What Codex Should Read Before Editing
- Auth flow: `lib/supabase/*`, `proxy.ts`, auth components, this doc.
- Router work: `trpc/init.ts`, `_app.ts`, target router, `03-data-model.md`.
- Client API usage: `trpc/client.tsx`, `trpc/query-client.ts`, relevant component.

## What Codex Must Update After Editing
- Update this file for new routers, procedures, auth guards, env vars, redirects, or session behavior.
- Update `03-data-model.md` if API changes depend on model changes.
- Update `13-testing-and-validation.md` with new validation steps.
- Add security or ownership follow-ups to `backlog.md`.
