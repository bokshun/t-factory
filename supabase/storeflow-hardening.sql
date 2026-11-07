-- StoreFlow hardening v2: team-membership RLS, version history, and a server-side revision counter.
-- Review before applying. NOT yet applied.
-- Data: no row in public.storeflow_sync is modified or deleted. A snapshot of each existing row is added to
--   storeflow_sync_history. The trigger keeps the newest 30 'before update' versions per store and prunes older
--   ones from the history table only (the 'pre-hardening snapshot' rows are never pruned).
-- Access: all existing policies on storeflow_sync are replaced by team-membership policies. Anonymous access is removed.
-- After applying, add each approved tester (lowercase email) with:
--   insert into public.storeflow_members (store_id, email, display_name) values ('19891-test', 'name@example.com', 'Name');
-- Restore a previous version (run in the Supabase SQL editor; clients will pull it as the newest version):
--   select id, store_id, archived_at, reason, pg_column_size(data) from public.storeflow_sync_history order by id desc;
--   update public.storeflow_sync s set data = h.data from public.storeflow_sync_history h
--     where h.id = <HISTORY_ID> and s.store_id = h.store_id;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.storeflow_members (
  store_id text not null,
  email text not null check (email = lower(email)),
  display_name text,
  added_at timestamptz not null default now(),
  primary key (store_id, email)
);
alter table public.storeflow_members enable row level security;
revoke all on public.storeflow_members from anon, authenticated;

create table if not exists public.storeflow_sync_history (
  id bigint generated always as identity primary key,
  store_id text not null,
  data jsonb not null,
  row_updated_at timestamptz,
  archived_at timestamptz not null default now(),
  reason text
);
alter table public.storeflow_sync_history enable row level security;
revoke all on public.storeflow_sync_history from anon, authenticated;

create or replace function private.storeflow_is_member(p_store_id text)
returns boolean language sql stable security definer set search_path = '' as $fn$
  select exists (
    select 1 from auth.users u
    join public.storeflow_members m on m.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null and m.store_id = p_store_id
  );
$fn$;
revoke all on function private.storeflow_is_member(text) from public, anon;
grant execute on function private.storeflow_is_member(text) to authenticated;

alter table public.storeflow_sync add column if not exists rev bigint not null default 1;

create or replace function private.storeflow_archive_before_update()
returns trigger language plpgsql security definer set search_path = '' as $fn$
begin
  new.rev := old.rev + 1;  -- server-controlled; clients cannot set it
  if old.data is distinct from new.data then
    insert into public.storeflow_sync_history (store_id, data, row_updated_at, reason)
    values (old.store_id, old.data, old.updated_at, 'before update');
    delete from public.storeflow_sync_history h
    where h.store_id = old.store_id and h.reason = 'before update'
      and h.id not in (select id from public.storeflow_sync_history
                       where store_id = old.store_id and reason = 'before update'
                       order by id desc limit 30);
  end if;
  return new;
end $fn$;
revoke all on function private.storeflow_archive_before_update() from public, anon, authenticated;

drop trigger if exists storeflow_archive on public.storeflow_sync;
create trigger storeflow_archive before update on public.storeflow_sync
  for each row execute function private.storeflow_archive_before_update();

insert into public.storeflow_sync_history (store_id, data, row_updated_at, reason)
select store_id, data, updated_at, 'pre-hardening snapshot'
from public.storeflow_sync s
where not exists (select 1 from public.storeflow_sync_history h
                  where h.store_id = s.store_id and h.reason = 'pre-hardening snapshot');

alter table public.storeflow_sync enable row level security;

-- Remove EVERY existing policy on this table (they are replaced below), so no older permissive
-- policy can bypass team membership. Policies are access rules only; no rows are touched.
do $do$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'storeflow_sync' loop
    execute format('drop policy %I on public.storeflow_sync', p.policyname);
  end loop;
end $do$;

-- Explicit grants: anonymous gets nothing; signed-in users can read, insert and update (never delete).
revoke all on public.storeflow_sync from anon;
revoke all on public.storeflow_sync from authenticated;
grant select, insert, update on public.storeflow_sync to authenticated;

create policy "storeflow members select" on public.storeflow_sync for select to authenticated
  using (private.storeflow_is_member(store_id));
create policy "storeflow members insert" on public.storeflow_sync for insert to authenticated
  with check (private.storeflow_is_member(store_id));
create policy "storeflow members update" on public.storeflow_sync for update to authenticated
  using (private.storeflow_is_member(store_id))
  with check (private.storeflow_is_member(store_id));
