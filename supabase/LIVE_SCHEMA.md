# StoreFlow Sync: live Supabase design (read-only notes)

These notes describe what is already applied to the StoreFlow Sync project. **Do not run any older
`storeflow-hardening.sql`; it has been removed because it conflicts with this design.** No emails or keys
are recorded here (this repository is public).

## Tables and access
- `public.storeflow_sync(store_id, data, updated_at, revision)`: one board per store. RLS on. Signed-in users
  can select, insert and update only their own approved stores. No delete. Anonymous access: none.
- `public.storeflow_sync_meta(store_id, revision, updated_at, updated_by)`: tiny row bumped by a trigger on
  every board write. This is the only table published to Realtime, so the 1 MB Realtime limit never applies.
- `private.storeflow_members(store_id, email, role)`: the approved-account allowlist (lowercase email).
- `private.storeflow_history`: previous boards, newest 30 kept per store, plus a one-time snapshot of the
  original `store-19891` board.

## Server-side rules (triggers and functions)
- Sign-up is blocked for any email not in the allowlist (trigger on `auth.users`).
- Membership requires a confirmed email address.
- `revision` is set by the server: 1 on insert, +1 whenever `data` changes. Clients cannot set it.
- Inserting an empty board, or replacing a populated board with an empty one, is refused.
- `store_id` cannot be changed.
- `public.storeflow_list_versions(store_id)` and `public.storeflow_restore_version(store_id, version_id,
  expected_revision)` let a member list and restore older versions. A restore is itself undoable.

## How the app uses it
1. Sign in (email + password).
2. Pull: read `data, revision`. A first-time device backs up its local board, then adopts the cloud board.
3. Push: `update ... where store_id = X and revision = <last seen>`. Zero rows updated means someone else
   saved first, so the app pulls, merges by item id, and retries.
4. Realtime: subscribe to `storeflow_sync_meta` for the store, then re-fetch the board. A 30 second poll is
   the fallback.

## Adding a tester (run in the Supabase SQL editor, then create the user in Authentication > Users)
```sql
insert into private.storeflow_members (store_id, email, role)
values ('19891-test', lower('person@example.com'), 'tester');
```
