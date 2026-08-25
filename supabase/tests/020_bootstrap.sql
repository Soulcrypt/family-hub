begin;
select plan(19);

-- New Owner triggers the profile-creation trigger; New Teen claims Ivy's
-- login-less row; Claim Attempt tries to claim an already-claimed row via
-- a second invite pointing at the same member row; Expired User exercises
-- the expiry guard; New Member exercises the member_id-is-null insert
-- path.
insert into auth.users (id, email, raw_user_meta_data) values
  ('44444444-4444-4444-8444-444444444444', 'newowner@test.local',      '{"display_name":"New Owner"}'::jsonb),
  ('55555555-5555-4555-8555-555555555555', 'newteen@test.local',       '{"display_name":"New Teen"}'::jsonb),
  ('66666666-6666-4666-8666-666666666666', 'claimattempt@test.local',  '{"display_name":"Claim Attempt"}'::jsonb),
  ('77777777-7777-4777-8777-777777777777', 'expireduser@test.local',   '{"display_name":"Expired User"}'::jsonb),
  ('88888888-8888-4888-8888-888888888888', 'newmember@test.local',     '{"display_name":"New Member"}'::jsonb),
  ('99999999-9999-4999-9999-999999999999', 'crossattacker@test.local', '{"display_name":"Cross Attacker"}'::jsonb);

select is(
  (select display_name from profiles where id = '44444444-4444-4444-8444-444444444444'),
  'New Owner',
  'trigger creates a profile row on auth.users insert'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';

select lives_ok(
  $$ select create_household('The Testers', 'America/Chicago') $$,
  'an authenticated user with no household can create one'
);

select is(
  (select count(*)::int from households where name = 'The Testers'),
  1,
  'the household row exists and is visible to its creator'
);

select is(
  (select role::text from household_members
   where user_id = '44444444-4444-4444-8444-444444444444'),
  'owner',
  'the creator is inserted as owner'
);

select is(
  (select count(*)::int from household_settings hs
   join households h on h.id = hs.household_id where h.name = 'The Testers'),
  1,
  'settings row is created alongside the household'
);

-- Bootstrap RPCs must still authenticate the caller themselves -- they
-- bypass RLS entirely as SECURITY DEFINER, so this check is the only
-- thing standing between an unauthenticated caller and a free household.
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select create_household('Should Fail', 'UTC') $$,
  '42501',
  null,
  'a caller with no auth.uid() cannot create a household'
);

set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';

-- Claim flow: an invite bound to an existing login-less member row.
insert into household_members (id, household_id, display_name, role, points_balance)
select 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1', id, 'Ivy', 'child', 250
from households where name = 'The Testers';

insert into household_invites (household_id, token_hash, role, member_id, expires_at, created_by)
select id, encode(digest('claim-token-abc', 'sha256'), 'hex'), 'teen',
       'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1', now() + interval '7 days',
       '44444444-4444-4444-8444-444444444444'
from households where name = 'The Testers';

-- A second invite pointing at the SAME member row, used below to prove
-- an already-claimed row is rejected once the first invite is accepted.
insert into household_invites (household_id, token_hash, role, member_id, expires_at, created_by)
select id, encode(digest('claim-token-second', 'sha256'), 'hex'), 'teen',
       'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1', now() + interval '7 days',
       '44444444-4444-4444-8444-444444444444'
from households where name = 'The Testers';

-- An already-expired invite (no member_id -- the new-member path), used
-- below to prove expiry is enforced.
insert into household_invites (household_id, token_hash, role, expires_at, created_by)
select id, encode(digest('claim-token-expired', 'sha256'), 'hex'), 'teen',
       now() - interval '1 day', '44444444-4444-4444-8444-444444444444'
from households where name = 'The Testers';

set local request.jwt.claims = '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}';

select lives_ok(
  $$ select accept_invite('claim-token-abc') $$,
  'an invited user can accept a claim invitation'
);

select is(
  (select points_balance from household_members
   where id = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1'),
  250,
  'claiming attaches the account to the existing row and preserves points'
);

select is(
  (select role::text from household_members
   where id = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1'),
  'teen',
  'claiming applies the invite''s role to the claimed row'
);

select throws_ok(
  $$ select accept_invite('claim-token-abc') $$,
  '22023',
  null,
  'reusing an already-accepted invitation token is rejected'
);

set local request.jwt.claims = '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}';

select throws_ok(
  $$ select accept_invite('claim-token-second') $$,
  '22023',
  null,
  'a second invite pointing at an already-claimed row is rejected'
);

set local request.jwt.claims = '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}';

select throws_ok(
  $$ select accept_invite('claim-token-expired') $$,
  '22023',
  null,
  'an expired invitation is rejected'
);

-- New-member path: member_id is null, so accept_invite inserts a fresh
-- row instead of claiming an existing one.
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
insert into household_invites (household_id, token_hash, role, expires_at, created_by)
select id, encode(digest('claim-token-new', 'sha256'), 'hex'), 'parent',
       now() + interval '7 days', '44444444-4444-4444-8444-444444444444'
from households where name = 'The Testers';

set local request.jwt.claims = '{"sub":"88888888-8888-4888-8888-888888888888","role":"authenticated"}';

select lives_ok(
  $$ select accept_invite('claim-token-new') $$,
  'a brand-new invite with no member_id creates a new member row'
);

select is(
  (select role::text from household_members where user_id = '88888888-8888-4888-8888-888888888888'),
  'parent',
  'the new member row is created with the invite''s role'
);

-- Cross-household guard: household_invites.household_id and the
-- household_id of the row invite.member_id points at are two independent
-- columns with no DB constraint tying them together, and
-- invites_insert_admins (Task 5) only checks that the caller administers
-- the invite's OWN household_id -- not that member_id belongs to it.
-- Claim Attempt is admin of their own new household ("Rival House") and
-- adds a login-less member there; New Owner (admin only of The Testers)
-- can still INSERT an invite naming their own household_id but a
-- member_id from Rival House -- RLS alone does not stop this. accept_invite
-- itself must refuse to act on the mismatch.
set local request.jwt.claims = '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}';

select lives_ok(
  $$ select create_household('Rival House', 'UTC') $$,
  'Claim Attempt can create their own household'
);

insert into household_members (id, household_id, display_name, role)
select 'ba1dba1d-ba1d-4ba1-8ba1-ba1dba1dba1d', id, 'Rival Kid', 'child'
from households where name = 'Rival House';

set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';

select lives_ok(
  $$ insert into household_invites (household_id, token_hash, role, member_id, expires_at, created_by)
     select id, encode(digest('claim-token-cross', 'sha256'), 'hex'), 'owner',
            'ba1dba1d-ba1d-4ba1-8ba1-ba1dba1dba1d', now() + interval '7 days',
            '44444444-4444-4444-8444-444444444444'
     from households where name = 'The Testers' $$,
  'RLS alone permits inserting a cross-household invite (member_id from a household the inviter does not administer) -- accept_invite must be the layer that refuses it'
);

set local request.jwt.claims = '{"sub":"99999999-9999-4999-9999-999999999999","role":"authenticated"}';

select throws_ok(
  $$ select accept_invite('claim-token-cross') $$,
  '22023',
  null,
  'accept_invite rejects an invite whose member_id belongs to a different household than its own household_id'
);

reset role;
select is(
  (select user_id from household_members where id = 'ba1dba1d-ba1d-4ba1-8ba1-ba1dba1dba1d'),
  null,
  'the mismatched cross-household member row was never claimed'
);

select is(
  (select bool_or(has_function_privilege('anon', p.oid, 'execute'))
   from pg_proc p where p.proname in ('create_household', 'accept_invite')),
  false,
  'anon cannot execute either bootstrap RPC'
);

select * from finish();
rollback;
