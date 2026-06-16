-- Apply manually in Supabase after the 2.0.6 Prisma migration.
-- Codex does not run this file.
--
-- Realtime evaluates these policies as the "authenticated" role, which cannot read the
-- Prisma-owned public app tables. The per-item access checks therefore run inside
-- SECURITY DEFINER helper functions. tidy_note_topic_item_id guards the uuid cast so the
-- policy is safe when OR-evaluated against non-note topic joins (e.g. the poke topic).

alter table realtime.messages enable row level security;

create or replace function public.tidy_note_topic_item_id(topic text)
returns uuid
language sql
immutable
as $func$
  select case
    when topic ~ '^tidy:note:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    then split_part(topic, ':', 3)::uuid
    else null
  end
$func$;

create or replace function public.tidy_can_read_note_topic(topic text, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $func$
  select exists (
    select 1
    from "ListItem" item
    join "List" list on list.id = item."listId"
    left join "ListShare" direct_share
      on direct_share."listId" = list.id and direct_share."userId" = uid
    left join "Workspace" workspace
      on workspace.id = list."workspaceId"
    left join "WorkspaceMember" workspace_member
      on workspace_member."workspaceId" = workspace.id and workspace_member."userId" = uid
    where item.id = public.tidy_note_topic_item_id(topic)
      and (
        list."userId" = uid
        or direct_share."userId" is not null
        or workspace."ownerId" = uid
        or workspace_member."userId" is not null
      )
  );
$func$;

create or replace function public.tidy_can_edit_note_topic(topic text, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $func$
  select exists (
    select 1
    from "ListItem" item
    join "List" list on list.id = item."listId"
    left join "ListShare" direct_share
      on direct_share."listId" = list.id and direct_share."userId" = uid
    left join "Workspace" workspace
      on workspace.id = list."workspaceId"
    left join "WorkspaceMember" workspace_member
      on workspace_member."workspaceId" = workspace.id and workspace_member."userId" = uid
    where item.id = public.tidy_note_topic_item_id(topic)
      and (
        list."userId" = uid
        or direct_share.role in ('EDITOR', 'OWNER')
        or workspace."ownerId" = uid
        or workspace_member.role in ('EDITOR', 'OWNER')
      )
  );
$func$;

grant execute on function public.tidy_note_topic_item_id(text) to authenticated;
grant execute on function public.tidy_can_read_note_topic(text, uuid) to authenticated;
grant execute on function public.tidy_can_edit_note_topic(text, uuid) to authenticated;

drop policy if exists "tidy note collaborators receive broadcasts" on realtime.messages;
drop policy if exists "tidy note editors send broadcasts" on realtime.messages;

create policy "tidy note collaborators receive broadcasts"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and public.tidy_can_read_note_topic((select realtime.topic()), (select auth.uid()))
);

create policy "tidy note editors send broadcasts"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and public.tidy_can_edit_note_topic((select realtime.topic()), (select auth.uid()))
);
