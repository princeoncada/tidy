-- Apply manually in Supabase after the 2.0.6 Prisma migration.
-- Codex does not run this file.

alter table realtime.messages enable row level security;

drop policy if exists "tidy note collaborators receive broadcasts"
on realtime.messages;

drop policy if exists "tidy note editors send broadcasts"
on realtime.messages;

create policy "tidy note collaborators receive broadcasts"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and exists (
    select 1
    from "ListItem" item
    join "List" list on list.id = item."listId"
    left join "ListShare" direct_share
      on direct_share."listId" = list.id
      and direct_share."userId" = (select auth.uid())
    left join "Workspace" workspace
      on workspace.id = list."workspaceId"
    left join "WorkspaceMember" workspace_member
      on workspace_member."workspaceId" = workspace.id
      and workspace_member."userId" = (select auth.uid())
    where item.id = case
      when (select realtime.topic()) ~
        '^tidy:note:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      then split_part((select realtime.topic()), ':', 3)::uuid
      else null
    end
    and (
      list."userId" = (select auth.uid())
      or direct_share."userId" is not null
      or workspace."ownerId" = (select auth.uid())
      or workspace_member."userId" is not null
    )
  )
);

create policy "tidy note editors send broadcasts"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and exists (
    select 1
    from "ListItem" item
    join "List" list on list.id = item."listId"
    left join "ListShare" direct_share
      on direct_share."listId" = list.id
      and direct_share."userId" = (select auth.uid())
    left join "Workspace" workspace
      on workspace.id = list."workspaceId"
    left join "WorkspaceMember" workspace_member
      on workspace_member."workspaceId" = workspace.id
      and workspace_member."userId" = (select auth.uid())
    where item.id = case
      when (select realtime.topic()) ~
        '^tidy:note:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      then split_part((select realtime.topic()), ':', 3)::uuid
      else null
    end
    and (
      list."userId" = (select auth.uid())
      or direct_share.role in ('EDITOR', 'OWNER')
      or workspace."ownerId" = (select auth.uid())
      or workspace_member.role in ('EDITOR', 'OWNER')
    )
  )
);
