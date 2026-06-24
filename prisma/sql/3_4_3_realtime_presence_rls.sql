-- Apply manually in Supabase after deploying 3.4.3. Codex does not run this file.
-- Replaces the permissive development presence policy used for the 3.4.0 proof
-- with a permission-scoped policy: only members of the room's underlying list may
-- receive (select) or send (insert) presence/broadcast messages on
-- tidy:presence:<listId>. Realtime evaluates policies as the "authenticated" role,
-- which cannot read the Prisma-owned public app tables, so the membership check
-- runs inside a SECURITY DEFINER helper (same constraint/pattern as
-- 2_0_6_note_collab_rls.sql). The room id is the list id; tidy_presence_topic_list_id
-- guards the uuid cast so the policy is safe when OR-evaluated against non-presence
-- topic joins (e.g. the poke or note topics).
--
alter table realtime.messages enable row level security;
--
create or replace function public.tidy_presence_topic_list_id(topic text)
returns uuid
language sql
immutable
as $func$
  select case
    when topic ~ '^tidy:presence:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    then split_part(topic, ':', 3)::uuid
    else null
  end
$func$;
--
create or replace function public.tidy_can_access_presence_topic(topic text, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $func$
  select exists (
    select 1
    from "List" list
    left join "ListShare" direct_share
      on direct_share."listId" = list.id and direct_share."userId" = uid
    left join "Workspace" workspace
      on workspace.id = list."workspaceId"
    left join "WorkspaceMember" workspace_member
      on workspace_member."workspaceId" = workspace.id and workspace_member."userId" = uid
    where list.id = public.tidy_presence_topic_list_id(topic)
      and (
        list."userId" = uid
        or direct_share."userId" is not null
        or workspace."ownerId" = uid
        or workspace_member."userId" is not null
      )
  );
$func$;
--
grant execute on function public.tidy_presence_topic_list_id(text) to authenticated;
grant execute on function public.tidy_can_access_presence_topic(text, uuid) to authenticated;
--
-- Drop the permissive development presence policies applied in the Supabase
-- dashboard during the 3.4.0 proof (authenticated select/insert on
-- tidy:presence:% with no membership check). Adjust these names if the dashboard
-- policies were created under different names.
drop policy if exists "tidy presence dev select" on realtime.messages;
drop policy if exists "tidy presence dev insert" on realtime.messages;
--
drop policy if exists "tidy presence members receive" on realtime.messages;
drop policy if exists "tidy presence members send" on realtime.messages;
--
create policy "tidy presence members receive"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('presence', 'broadcast')
  and public.tidy_can_access_presence_topic((select realtime.topic()), (select auth.uid()))
);
--
create policy "tidy presence members send"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension in ('presence', 'broadcast')
  and public.tidy_can_access_presence_topic((select realtime.topic()), (select auth.uid()))
);
