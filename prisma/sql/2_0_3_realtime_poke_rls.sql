alter table realtime.messages enable row level security;

drop policy if exists "tidy users receive only their own pokes"
on realtime.messages;

create policy "tidy users receive only their own pokes"
on realtime.messages
for select
to authenticated
using (
  (select realtime.topic()) = 'tidy:user:' || (select auth.uid())::text
  and realtime.messages.extension = 'broadcast'
);
