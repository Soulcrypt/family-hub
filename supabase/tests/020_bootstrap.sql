begin;
select plan(37);

-- New Owner triggers the profile-creation trigger; New Teen claims Ivy's
-- login-less row; Claim Attempt tries to claim an already-claimed row via
-- a second invite pointing at the same member row, then creates a rival
-- household for the cross-household guard test; Expired User exercises
-- the expiry guard; New Member exercises the member_id-is-null insert
-- path; Deactivated Claim attempts to claim a deactivated row; Long Name
-- Claimer's profile is edited past 40 characters after signup, to
-- exercise accept_invite's own defensive re-cap; Cross Attacker accepts
-- a cross-household-mismatched invite.
insert into auth.users (id, email, raw_user_meta_data) values
  ('44444444-4444-4444-8444-444444444444', 'newowner@test.local',         '{"display_name":"New Owner"}'::jsonb),
  ('55555555-5555-4555-8555-555555555555', 'newteen@test.local',          '{"display_name":"New Teen"}'::jsonb),
  ('66666666-6666-4666-8666-666666666666', 'claimattempt@test.local',     '{"display_name":"Claim Attempt"}'::jsonb),
  ('77777777-7777-4777-8777-777777777777', 'expireduser@test.local',      '{"display_name":"Expired User"}'::jsonb),
  ('88888888-8888-4888-8888-888888888888', 'newmember@test.local',        '{"display_name":"New Member"}'::jsonb),
  ('99999999-9999-4999-9999-999999999999', 'crossattacker@test.local',    '{"display_name":"Cross Attacker"}'::jsonb),
  ('c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0', 'deactivatedclaim@test.local', '{"display_name":"Deactivated Claim"}'::jsonb),
  ('b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0', 'longnameclaimer@test.local',  '{"display_name":"Short Name For Now"}'::jsonb),
  ('e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0', 'boundaryowner@test.local',    '{"display_name":"Boundary Owner"}'::jsonb),
  ('f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0', 'boundaryclaimer@test.local',  '{"display_name":"Boundary Claimer"}'::jsonb);

-- I-1: a display_name over household_members' 40-char cap must not brick
-- the account. jsonb_build_object is needed since repeat() can't sit
-- inside a plain '...'::jsonb string literal.
insert into auth.users (id, email, raw_user_meta_data)
values ('a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0', 'longnameowner@test.local',
        jsonb_build_object('display_name', repeat('A', 50)));

-- M-8: a null email (unreachable today -- anonymous/SMS signup are both
-- disabled in config.toml -- but not guaranteed to stay that way) must
-- not abort the auth.users insert itself.
insert into auth.users (id, email) values
  ('d0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0', null);

-- Fix round 3: split_part(email, '@', 1) is untrimmed, unlike the
-- metadata branch. A whitespace-only local part ('   ') is not '', so it
-- previously survived nullif() as the chosen candidate and violated the
-- new profiles_display_name_check, aborting the whole auth.users insert
-- (not just the profile row) -- reachable via any raw auth.users insert,
-- exactly like this test suite, Task 18's seed script, or any future
-- admin/backfill script, even though GoTrue's own signup path almost
-- certainly rejects this email shape first.
insert into auth.users (id, email, raw_user_meta_data) values
  ('13131313-1313-4131-8131-131313131313', '   @whitespace-local.test', '{}'::jsonb);

select is(
  (select display_name from profiles where id = '44444444-4444-4444-8444-444444444444'),
  'New Owner',
  'trigger creates a profile row on auth.users insert'
);

select ok(
  (select length(display_name) <= 40 from profiles where id = 'a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0'),
  'trigger caps an over-long display_name at 40 characters instead of storing it uncapped'
);

select is(
  (select display_name from profiles where id = 'd0d0d0d0-d0d0-4d0d-8d0d-d0d0d0d0d0d0'),
  'Member',
  'trigger falls back to a literal default when email and metadata are both absent'
);

select is(
  (select display_name from profiles where id = '13131313-1313-4131-8131-131313131313'),
  'Member',
  'trigger falls back to Member (rather than aborting the signup) when the email local part is whitespace-only'
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
  'not authenticated',
  'a caller with no auth.uid() cannot create a household'
);

set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';

-- M-7: p_name was only checked for emptiness, not households.name's own
-- 1-80 bound -- an over-long name raised a raw 23514 with a row dump.
select throws_ok(
  $$ select create_household(repeat('N', 81), 'UTC') $$,
  '22023',
  'household name must be between 1 and 80 characters',
  'create_household rejects a name over 80 characters with a clean error'
);

-- M-6: p_timezone was not validated at all -- garbage would feed
-- straight into Task 16+'s date math.
select throws_ok(
  $$ select create_household('Timezone Test', 'Mars/Olympus_Mons') $$,
  '22023',
  'invalid timezone',
  'create_household rejects a timezone that is not a real IANA zone'
);

select is(
  (select count(*)::int from households where name = 'Timezone Test'),
  0,
  'the rejected timezone attempt created no household row'
);

-- I-1 continued: create_household must succeed for a caller whose
-- profile display_name is over 40 characters (proving the account is not
-- bricked), and the resulting household_members row must be capped
-- defensively at create_household's own copy site too.
set local request.jwt.claims = '{"sub":"a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0","role":"authenticated"}';

select lives_ok(
  $$ select create_household('Long Name House', 'UTC') $$,
  'an over-long display_name no longer bricks the account -- create_household still succeeds'
);

select ok(
  (select length(display_name) <= 40 from household_members
   where user_id = 'a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0'),
  'create_household defensively re-caps display_name at its own copy site, independent of the trigger'
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

-- I-2: a deactivated login-less member row must not be claimable.
insert into household_members (id, household_id, display_name, role, is_active)
select 'dea171ed-dea1-471e-8dea-171edea171ed', id, 'Deactivated Kid', 'child', false
from households where name = 'The Testers';

insert into household_invites (household_id, token_hash, role, member_id, expires_at, created_by)
select id, encode(digest('claim-token-deactivated', 'sha256'), 'hex'), 'teen',
       'dea171ed-dea1-471e-8dea-171edea171ed', now() + interval '7 days',
       '44444444-4444-4444-8444-444444444444'
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

select is(
  (select user_id from household_members where id = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1'),
  '55555555-5555-4555-8555-555555555555'::uuid,
  'claiming attaches the caller''s own uid to the row -- not just some uid'
);

select throws_ok(
  $$ select accept_invite('claim-token-abc') $$,
  '22023',
  'invitation already used',
  'reusing an already-accepted invitation token is rejected'
);

set local request.jwt.claims = '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}';

select throws_ok(
  $$ select accept_invite('claim-token-second') $$,
  '22023',
  'profile already claimed',
  'a second invite pointing at an already-claimed row is rejected'
);

set local request.jwt.claims = '{"sub":"c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0","role":"authenticated"}';

select throws_ok(
  $$ select accept_invite('claim-token-deactivated') $$,
  '22023',
  'profile already claimed',
  'claiming a deactivated member row is rejected rather than silently succeeding into an empty membership'
);

reset role;
select is(
  (select user_id from household_members where id = 'dea171ed-dea1-471e-8dea-171edea171ed'),
  null,
  'the deactivated row was never attached to the rejected caller'
);
set local role authenticated;

set local request.jwt.claims = '{"sub":"77777777-7777-4777-8777-777777777777","role":"authenticated"}';

select throws_ok(
  $$ select accept_invite('claim-token-expired') $$,
  '22023',
  'invitation expired',
  'an expired invitation is rejected'
);

-- M-4: a caller who already belongs to the invite's household must be
-- rejected explicitly, not merely stopped by household_members_user_unique
-- (0001_schema.sql's partial unique index on (household_id, user_id) --
-- load-bearing here as the last-resort backstop, but accept_invite should
-- not depend on it silently).
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
insert into household_invites (household_id, token_hash, role, expires_at, created_by)
select id, encode(digest('claim-token-already-member', 'sha256'), 'hex'), 'parent',
       now() + interval '7 days', '44444444-4444-4444-8444-444444444444'
from households where name = 'The Testers';

select throws_ok(
  $$ select accept_invite('claim-token-already-member') $$,
  '22023',
  'you are already a member of this household',
  'a caller who is already a member of the invite''s household is rejected explicitly'
);

-- New-member path: member_id is null, so accept_invite inserts a fresh
-- row instead of claiming an existing one.
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

-- I-1 continued: the new-member insert path must also cap display_name
-- defensively -- exercised on a profile whose display_name was edited
-- past 40 characters after signup (postgres bypasses RLS as table
-- owner, simulating what profiles_update_self would otherwise allow).
reset role;
update profiles set display_name = repeat('B', 55) where id = 'b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0';
set local role authenticated;

set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
insert into household_invites (household_id, token_hash, role, expires_at, created_by)
select id, encode(digest('claim-token-longname', 'sha256'), 'hex'), 'teen',
       now() + interval '7 days', '44444444-4444-4444-8444-444444444444'
from households where name = 'The Testers';

set local request.jwt.claims = '{"sub":"b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0","role":"authenticated"}';

select lives_ok(
  $$ select accept_invite('claim-token-longname') $$,
  'the new-member insert path succeeds even when the profile display_name is over 40 characters'
);

select ok(
  (select length(display_name) <= 40 from household_members
   where user_id = 'b0b0b0b0-b0b0-4b0b-8b0b-b0b0b0b0b0b0'),
  'accept_invite''s new-member path defensively re-caps display_name at its own copy site'
);

-- I-1 residual (fix round 2): profiles.display_name has no CHECK of its
-- own (only NOT NULL), and profiles_update_self lets any user set it to
-- anything -- including a name whose first 40 characters are entirely
-- whitespace even though the full (untruncated) name has real content
-- beyond that point. A bare left(v_display_name, 40) at either RPC's
-- copy site would then trim to empty and violate
-- household_members_display_name_check, bricking the account exactly
-- like the original over-length case, just entered through a different
-- door.
--
-- Note: a *purely* whitespace profile name (the exact shape originally
-- reproduced against round 1) is no longer constructible at all once
-- profiles_display_name_check lands in 0008 -- that CHECK enforces
-- length(trim(display_name)) between 1 and 80 unconditionally, for every
-- caller, including profiles_update_self, so setting a profile name to
-- e.g. 45 spaces now fails at the UPDATE itself. This fixture instead
-- targets the risk that survives even with that CHECK in place: a name
-- that trims non-empty as a WHOLE (so it still satisfies profiles' own
-- 80-character bound) but whose first 40 characters -- exactly what the
-- copy sites take via left(..., 40) -- are all whitespace. That gap
-- exists precisely because profiles allows up to 80 characters while
-- household_members caps at 40; the copy-site fix has to handle it even
-- with the CHECK in place. Each update below is done as the affected
-- user's own session, through profiles_update_self, matching how a real
-- user would reach this state -- an entirely ordinary self-edit.
set local request.jwt.claims = '{"sub":"e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0","role":"authenticated"}';
update profiles set display_name = repeat(' ', 40) || 'Bob' where id = 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0';

select lives_ok(
  $$ select create_household('Boundary House', 'UTC') $$,
  'create_household succeeds even when the first 40 characters of the caller''s display_name are all whitespace'
);

select is(
  (select display_name from household_members where user_id = 'e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e0e0'),
  'Member',
  'create_household''s copy site falls back to Member when truncation would otherwise leave whitespace'
);

set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
insert into household_invites (household_id, token_hash, role, expires_at, created_by)
select id, encode(digest('claim-token-boundary', 'sha256'), 'hex'), 'child',
       now() + interval '7 days', '44444444-4444-4444-8444-444444444444'
from households where name = 'The Testers';

set local request.jwt.claims = '{"sub":"f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0","role":"authenticated"}';
update profiles set display_name = repeat(' ', 40) || 'Cee' where id = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0';

select lives_ok(
  $$ select accept_invite('claim-token-boundary') $$,
  'accept_invite''s new-member path succeeds even when the first 40 characters of the caller''s display_name are all whitespace'
);

select is(
  (select display_name from household_members where user_id = 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0'),
  'Member',
  'accept_invite''s copy site falls back to Member when truncation would otherwise leave whitespace'
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
  'invitation not found',
  'accept_invite rejects an invite whose member_id belongs to a different household than its own household_id, without revealing the row exists'
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
