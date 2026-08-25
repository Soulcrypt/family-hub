begin;
select plan(91);

-- Two households, two owners, one teen in household A, plus fixtures for
-- fix-round-2 coverage: a real invite (so "teen cannot read invitations"
-- is non-vacuous), a login-having member whose active/inactive state we
-- flip (Member E, in household E owned by a dedicated Owner E), and two
-- more throwaway single-purpose households (C owned in name only, with a
-- 'parent' member; D with an 'owner' member) to probe
-- households_delete_owner's role check without disturbing household A's
-- or B's membership counts used throughout this file. Each throwaway
-- actor is a brand new user with exactly one membership, so the original
-- "owner A/B sees only their own household" assertions keep their
-- original meaning.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'b@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'teen@test.local'),
  ('55555555-5555-4555-8555-555555555555', 'parentc@test.local'),
  ('66666666-6666-4666-8666-666666666666', 'ownerd@test.local'),
  ('77777777-7777-4777-8777-777777777777', 'membere@test.local'),
  ('99999999-9999-4999-8999-999999999999', 'ownere@test.local');

-- Task 6 added a trigger that creates a profiles row on every auth.users
-- insert above, so this upserts the specific display names this file's
-- readability depends on rather than colliding with the trigger's own
-- (email-derived) row.
insert into profiles (id, display_name) values
  ('11111111-1111-4111-8111-111111111111', 'Owner A'),
  ('22222222-2222-4222-8222-222222222222', 'Owner B'),
  ('33333333-3333-4333-8333-333333333333', 'Teen A'),
  ('55555555-5555-4555-8555-555555555555', 'Parent C'),
  ('66666666-6666-4666-8666-666666666666', 'Owner D'),
  ('77777777-7777-4777-8777-777777777777', 'Member E'),
  ('99999999-9999-4999-8999-999999999999', 'Owner E')
on conflict (id) do update set display_name = excluded.display_name;

insert into households (id, name, created_by) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'House A', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'House B', '22222222-2222-4222-8222-222222222222'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'House C', '11111111-1111-4111-8111-111111111111'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'House D', '11111111-1111-4111-8111-111111111111'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'House E', '11111111-1111-4111-8111-111111111111'),
  -- House F exists solely for fix-round-3's SECURITY DEFINER positive
  -- control: it holds one login-less member (Zed) whose user_id we
  -- attach via a trusted definer-context probe, isolated from every
  -- other household so that mutation cannot perturb any count asserted
  -- elsewhere in this file.
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'House F', '11111111-1111-4111-8111-111111111111');

insert into household_settings (household_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

insert into household_members (id, household_id, user_id, display_name, role) values
  ('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '11111111-1111-4111-8111-111111111111', 'Owner A', 'owner'),
  ('b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '22222222-2222-4222-8222-222222222222', 'Owner B', 'owner'),
  ('a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '33333333-3333-4333-8333-333333333333', 'Teen A', 'teen'),
  ('a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a3a3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   null, 'Ivy', 'child'),
  ('c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   '55555555-5555-4555-8555-555555555555', 'Parent C', 'parent'),
  ('d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   '66666666-6666-4666-8666-666666666666', 'Owner D', 'owner'),
  ('e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e1e1e1', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   '99999999-9999-4999-8999-999999999999', 'Owner E', 'owner'),
  ('e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   '77777777-7777-4777-8777-777777777777', 'Member E', 'teen'),
  ('f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1', 'ffffffff-ffff-4fff-8fff-ffffffffffff',
   null, 'Zed', 'child');

-- Fix round 3's positive control: a tiny SECURITY DEFINER function,
-- created here (while still running as the migration/superuser role, so
-- it is owned by `postgres`) and dropped again after its one use below.
-- Proves the guard trigger's `current_user = 'postgres'` exemption
-- actually works, rather than being assumed -- Task 6's accept_invite()
-- does not exist yet to exercise this for real.
create function probe_definer_attach_user(mid uuid, uid uuid) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
  begin
    update household_members set user_id = uid where id = mid;
  end;
  $$;

insert into household_invites (household_id, email, token_hash, role, expires_at, created_by) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'invitee@test.local', 'hash-of-token-abc', 'parent',
   now() + interval '7 days', '11111111-1111-4111-8111-111111111111');

-- === Owner A's session ===
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is(
  (select count(*)::int from households),
  1,
  'owner A sees only their own household'
);

select is(
  (select count(*)::int from household_members),
  3,
  'owner A sees all three members of household A and none of B'
);

select is(
  (select count(*)::int from household_members where household_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  0,
  'owner A cannot read household B members'
);

-- Strengthens the previous assertion: pairs the "B is 0" negative with an
-- explicit "A is exactly 3" positive filtered the same way, so a policy
-- that blocked everything (rather than correctly scoping by household)
-- cannot pass both this and the total-count assertion above.
select is(
  (select count(*)::int from household_members where household_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  3,
  'owner A sees exactly the three members explicitly filtered to household A'
);

-- Was `lives_ok` on the raw UPDATE, which also passes if the update is
-- silently filtered to zero rows (an UPDATE matching nothing raises
-- nothing). Converted to the CTE form asserting exactly one row changed.
with upd as (
  update households set name = 'House A renamed'
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1
)
select is(count(*)::int, 1, 'owner A can rename their own household') from upd;

with upd as (
  update households set name = 'hacked'
  where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' returning 1
)
select is(count(*)::int, 0, 'owner A updating household B affects zero rows') from upd;

select is(
  (select count(*)::int from household_invites where household_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1,
  'owner A (admin) can read household A''s invite'
);

-- profiles: previously had zero coverage, including the cross-household
-- case that fix 3 patches (subject is_active).
select is(
  (select count(*)::int from profiles where id = '11111111-1111-4111-8111-111111111111'),
  1,
  'owner A can read their own profile'
);

select is(
  (select count(*)::int from profiles where id = '33333333-3333-4333-8333-333333333333'),
  1,
  'owner A can read a household-mate''s profile (Teen A)'
);

select is(
  (select count(*)::int from profiles where id = '22222222-2222-4222-8222-222222222222'),
  0,
  'owner A cannot read Owner B''s profile (different household)'
);

with upd as (
  update profiles set display_name = 'Owner A (renamed)'
  where id = '11111111-1111-4111-8111-111111111111' returning 1
)
select is(count(*)::int, 1, 'owner A can update their own profile') from upd;

with upd as (
  update profiles set display_name = 'Hijacked'
  where id = '33333333-3333-4333-8333-333333333333' returning 1
)
select is(count(*)::int, 0, 'owner A cannot update Teen A''s profile') from upd;

-- Fix 1's admin path must still work: an owner/parent can still change
-- role/points_balance/is_active/household_id on a member row in their
-- household -- the trigger only blocks a non-admin doing it on their own row.
with upd as (
  update household_members set points_balance = 50
  where id = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2' returning 1
)
select is(count(*)::int, 1, 'owner A (admin) can still change Teen A''s points_balance') from upd;

-- households_delete_owner, cross-household half: Owner A is not a member
-- of household B at all.
with del as (
  delete from households where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' returning 1
)
select is(count(*)::int, 0, 'a non-member cannot delete a household') from del;

select lives_ok(
  $$ insert into household_members (household_id, display_name, role)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'New Kid', 'child') $$,
  'owner A can add a login-less member to their household'
);

select throws_ok(
  $$ insert into household_members (household_id, display_name, role)
     values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Intruder', 'child') $$,
  '42501',
  null,
  'owner A cannot insert a member into household B'
);

-- Fix 4: members_insert_admins must not accept an arbitrary user_id --
-- otherwise an admin could plant a membership row for any known uid and
-- immediately read that stranger's profile.
select throws_ok(
  $$ insert into household_members (household_id, user_id, display_name, role)
     values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'Planted', 'child') $$,
  '42501',
  null,
  'owner A cannot insert a member row with a pre-existing user_id'
);

-- Fix round 3, open 2: the same unconsented-membership/profile-disclosure
-- chain fix 4 closed on INSERT was still open on UPDATE --
-- members_update_admins never restricted user_id, so an owner could
-- repoint a login-less row at any known uid and immediately read that
-- stranger's profile. `id` is frozen for the same class of reason (and
-- because household_invites.member_id is a foreign key to it). Both are
-- enforced by the trigger, not by policy -- an owner/parent legitimately
-- reaches WITH CHECK here, so only the trigger stands between them and
-- the plant.
select throws_ok(
  $$ update household_members set user_id = '22222222-2222-4222-8222-222222222222'
     where id = 'a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a3a3' $$,
  '42501',
  null,
  'owner A (admin) cannot repoint a login-less member row at another account'
);

select throws_ok(
  $$ update household_members set id = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0'
     where id = 'a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a3a3' $$,
  '42501',
  null,
  'owner A (admin) cannot rewrite a member row''s primary key'
);

-- === Owner B's session (symmetric direction -- previously untested) ===
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select is(
  (select count(*)::int from households),
  1,
  'owner B sees only their own household'
);

select is(
  (select count(*)::int from household_members),
  1,
  'owner B sees only their own household''s member'
);

select is(
  (select count(*)::int from household_members where household_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0,
  'owner B cannot read household A''s members'
);

select is(
  (select count(*)::int from household_invites),
  0,
  'owner B cannot read household A''s invite'
);

select is(
  (select count(*)::int from profiles where id = '11111111-1111-4111-8111-111111111111'),
  0,
  'owner B cannot read Owner A''s profile'
);

-- Fix round 3, open 1: the trigger's admin check
-- (household_role(old.household_id) not in ('owner','parent')) silently
-- PERMITS the write when the caller has no active membership in the
-- row's household at all -- NULL not in (...) is NULL, not TRUE, so the
-- `if` never fires. Not reachable by `authenticated` today only because
-- members_select_household and members_update_admins already exclude a
-- non-member before the trigger runs -- which is exactly the kind of
-- implicit-side-effect dependency finding 2 asked us to stop relying on.
-- To assert the trigger's OWN fail-closed behaviour, independent of the
-- surrounding policies, both policies are temporarily widened wide open
-- for this one probe and then restored to their real definitions
-- immediately after -- this is still inside the outer transaction that
-- is rolled back at the very end of this file, so nothing here can
-- persist regardless. Altering a policy requires table ownership, so
-- each DDL step below runs as this session's own role (postgres, the
-- table owner) rather than as `authenticated`.
reset role;
drop policy members_select_household on household_members;
create policy members_select_household on household_members for select to authenticated
  using (true);
drop policy members_update_admins on household_members;
create policy members_update_admins on household_members for update to authenticated
  using (true) with check (true);

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select throws_ok(
  $$ update household_members set role = 'owner'
     where id = 'a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a3a3' $$,
  '42501',
  null,
  'trigger itself fails closed for a caller with no active membership in the row''s household, even when the surrounding policies are wide open'
);

reset role;
drop policy members_select_household on household_members;
create policy members_select_household on household_members for select to authenticated
  using (is_household_member(household_id));
drop policy members_update_admins on household_members;
create policy members_update_admins on household_members for update to authenticated
  using (household_role(household_id) in ('owner', 'parent'))
  with check (household_role(household_id) in ('owner', 'parent'));

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

-- Positive control for the current_user = 'postgres' exemption itself:
-- Owner B holds no role at all in House F, yet a trusted SECURITY
-- DEFINER function (created above, owned by `postgres`) can still attach
-- her uid to Zed's login-less row -- proving Task 6's accept_invite()
-- will be able to do the same, rather than merely assuming it.
select probe_definer_attach_user('f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1', '22222222-2222-4222-8222-222222222222');

select is(
  (select user_id::text from household_members where id = 'f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1'),
  '22222222-2222-4222-8222-222222222222',
  'a trusted SECURITY DEFINER function (current_user = postgres) can still set user_id -- the exemption works, not just assumed'
);

reset role;
drop function probe_definer_attach_user(uuid, uuid);
set local role authenticated;

-- === Parent C's session: households_delete_owner, role-check half ===
set local request.jwt.claims = '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}';

with del as (
  delete from households where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' returning 1
)
select is(count(*)::int, 0, 'a parent cannot delete their household') from del;

-- === Owner D's session: positive control for households_delete_owner,
-- proving the policy isn't a blanket deny ===
set local request.jwt.claims = '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}';

with del as (
  delete from households where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' returning 1
)
select is(count(*)::int, 1, 'an owner can delete their own household') from del;

-- === Owner E's session: fix 3, profile visibility tracks the subject's
-- is_active, not just the caller's ===
set local request.jwt.claims = '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}';

select is(
  (select count(*)::int from profiles where id = '77777777-7777-4777-8777-777777777777'),
  1,
  'owner E can read Member E''s profile while her membership is active'
);

with upd as (
  update household_members set is_active = false
  where id = 'e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2' returning 1
)
select is(count(*)::int, 1, 'owner E can deactivate Member E') from upd;

select is(
  (select count(*)::int from profiles where id = '77777777-7777-4777-8777-777777777777'),
  0,
  'owner E can no longer read Member E''s profile once her membership is inactive'
);

with upd as (
  update household_members set is_active = true
  where id = 'e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e2e2' returning 1
)
select is(count(*)::int, 1, 'owner E can reactivate Member E') from upd;

select is(
  (select count(*)::int from profiles where id = '77777777-7777-4777-8777-777777777777'),
  1,
  'owner E can read Member E''s profile again once reactivated'
);

-- === Teen A's session ===
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';

select is(
  (select count(*)::int from household_members),
  4,
  'teen sees their household members'
);

with upd as (
  update household_members set display_name = 'Renamed'
  where id = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1' returning 1
)
select is(count(*)::int, 0, 'teen cannot rename another member') from upd;

with upd as (
  update household_settings set enabled_features = '{}'::jsonb
  where household_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' returning 1
)
select is(count(*)::int, 0, 'teen cannot change household settings') from upd;

-- No longer vacuous: a real invite exists in household A (inserted
-- above), so this fails if invites_select_admins is ever dropped or
-- widened rather than passing regardless of whether any row exists.
select is(
  (select count(*)::int from household_invites),
  0,
  'teen cannot read invitations'
);

-- Fix 1 (the critical vulnerability): a child cannot self-promote their
-- own role, cannot inflate their own points_balance, and cannot
-- deactivate themselves, even though members_update_self otherwise lets
-- them update their own row.
select throws_ok(
  $$ update household_members set role = 'owner'
     where id = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2' $$,
  '42501',
  null,
  'a child cannot self-promote their own role'
);

select throws_ok(
  $$ update household_members set points_balance = 999999
     where id = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2' $$,
  '42501',
  null,
  'a child cannot inflate their own points_balance'
);

select throws_ok(
  $$ update household_members set is_active = false
     where id = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2' $$,
  '42501',
  null,
  'a child cannot deactivate themselves'
);

-- Fix 2: members_update_self's WITH CHECK now explicitly requires the
-- (possibly new) household_id to be one the caller is a member of, so a
-- self-row household_id rewrite cannot be used to hop households. (In
-- this build it is also independently caught by fix 1's trigger, since
-- household_id is one of its guarded columns -- both layers were each
-- individually verified in isolation; see the report.)
select throws_ok(
  $$ update household_members set household_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
     where id = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2' $$,
  '42501',
  null,
  'a child cannot move their own row into a different household'
);

-- Fix round 1: TRUNCATE bypasses Row Level Security entirely -- RLS
-- policies are never consulted for TRUNCATE -- so a role holding it could
-- empty any of these tables regardless of every policy above. REFERENCES
-- and TRIGGER are the same class of grant unrelated to the CRUD
-- operations the policies actually govern. None of the three should be
-- held by anon or authenticated on any of the five tables. This asserts
-- that directly against pg_catalog via has_table_privilege(), independent
-- of RLS, so a future migration cannot silently reintroduce the grant
-- (e.g. by recreating a table without repeating the revoke).
select ok(
    not has_table_privilege(r.role_name, t.table_name, p.priv),
    format('%s cannot %s on %s (bypasses/unrelated-to RLS)', r.role_name, p.priv, t.table_name)
  )
from
  unnest(array['anon', 'authenticated']) as r(role_name),
  unnest(array[
    'profiles', 'households', 'household_members',
    'household_invites', 'household_settings'
  ]) as t(table_name),
  unnest(array['TRUNCATE', 'REFERENCES', 'TRIGGER']) as p(priv)
order by t.table_name, r.role_name, p.priv;

-- Fix round 2, item 6: the previous privilege-bypass block only ever
-- checked TRUNCATE/REFERENCES/TRIGGER, so a future migration granting
-- `anon` (unauthenticated) SELECT/INSERT/UPDATE/DELETE would sail through
-- untested even though the app never authenticates as anon at all.
select ok(
    not has_table_privilege('anon', t.table_name, p.priv),
    format('anon cannot %s on %s', p.priv, t.table_name)
  )
from
  unnest(array[
    'profiles', 'households', 'household_members',
    'household_invites', 'household_settings'
  ]) as t(table_name),
  unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as p(priv)
order by t.table_name, p.priv;

select * from finish();
rollback;
