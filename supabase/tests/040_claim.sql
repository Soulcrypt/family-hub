begin;
select plan(3);

-- Task 14: the claim flow's product-facing guarantees, on top of Task 6's accept_invite()
-- (already exhaustively covered for the cross-household guard, the already-a-member guard,
-- and the deactivated-row guard by supabase/tests/020_bootstrap.sql -- this file does not
-- repeat those). What this file proves, in the shape the actual UI exercises it:
--
--   1. A claim invitation cannot be redeemed twice -- the second attempt, by a DIFFERENT
--      would-be claimant, is rejected rather than silently reusing/racing the first.
--   2. An expired invitation is rejected even though the row itself is otherwise well-formed.
--   3. An invite whose target member row ALREADY has a user_id (a real, pre-existing login --
--      not merely "claimed by a previous accept_invite call", which 020_bootstrap.sql already
--      covers) is rejected with the same "profile already claimed" message, not a generic
--      constraint error.
--
-- Fixtures: House Claim (Claim Owner) with two login-less-at-fixture-time children -- Claim
-- Kid (claimed by First Claimant below) and Expired Kid (targeted by an already-expired
-- invite) -- plus Claimed Kid, who already has a real login (Existing Login) attached from the
-- start, to isolate case 3 from case 1.
insert into auth.users (id, email, raw_user_meta_data) values
  ('c1a10000-0000-4000-8000-000000000001', 'claimowner@test.local',    '{"display_name":"Claim Owner"}'::jsonb),
  ('c1a10000-0000-4000-8000-000000000002', 'firstclaimant@test.local', '{"display_name":"First Claimant"}'::jsonb),
  ('c1a10000-0000-4000-8000-000000000003', 'secondclaimant@test.local','{"display_name":"Second Claimant"}'::jsonb),
  ('c1a10000-0000-4000-8000-000000000004', 'expiredclaimant@test.local','{"display_name":"Expired Claimant"}'::jsonb),
  ('c1a10000-0000-4000-8000-000000000005', 'existinglogin@test.local', '{"display_name":"Existing Login"}'::jsonb),
  ('c1a10000-0000-4000-8000-000000000006', 'alreadyclaimant@test.local','{"display_name":"Already Claimant"}'::jsonb);

insert into households (id, name, created_by) values
  ('c1a20000-0000-4000-8000-000000000001', 'House Claim', 'c1a10000-0000-4000-8000-000000000001');

insert into household_members (id, household_id, user_id, display_name, role, points_balance) values
  ('c1a30000-0000-4000-8000-000000000001', 'c1a20000-0000-4000-8000-000000000001',
   'c1a10000-0000-4000-8000-000000000001', 'Claim Owner', 'owner', 0),
  ('c1a30000-0000-4000-8000-000000000002', 'c1a20000-0000-4000-8000-000000000001',
   null, 'Claim Kid', 'child', 250),
  ('c1a30000-0000-4000-8000-000000000003', 'c1a20000-0000-4000-8000-000000000001',
   null, 'Expired Kid', 'child', 100),
  ('c1a30000-0000-4000-8000-000000000004', 'c1a20000-0000-4000-8000-000000000001',
   'c1a10000-0000-4000-8000-000000000005', 'Claimed Kid', 'teen', 75);

-- Invite 1: a valid, unexpired claim invite for Claim Kid.
insert into household_invites (household_id, token_hash, role, member_id, expires_at, created_by)
values (
  'c1a20000-0000-4000-8000-000000000001', encode(digest('claim-token-reuse', 'sha256'), 'hex'), 'teen',
  'c1a30000-0000-4000-8000-000000000002', now() + interval '7 days', 'c1a10000-0000-4000-8000-000000000001'
);

-- Invite 2: already expired, no member_id (new-member path) -- expiry must be checked before
-- anything else about the invite's shape.
insert into household_invites (household_id, token_hash, role, expires_at, created_by)
values (
  'c1a20000-0000-4000-8000-000000000001', encode(digest('claim-token-expired-2', 'sha256'), 'hex'), 'teen',
  now() - interval '1 hour', 'c1a10000-0000-4000-8000-000000000001'
);

-- Invite 3: a well-formed, unexpired invite whose member_id already has a real user_id
-- attached from fixture creation (not from a prior accept_invite call) -- the direct case of
-- "this profile already has a login".
insert into household_invites (household_id, token_hash, role, member_id, expires_at, created_by)
values (
  'c1a20000-0000-4000-8000-000000000001', encode(digest('claim-token-has-login', 'sha256'), 'hex'), 'parent',
  'c1a30000-0000-4000-8000-000000000004', now() + interval '7 days', 'c1a10000-0000-4000-8000-000000000001'
);

-- === 1. First Claimant redeems the invite; Second Claimant then tries the SAME token. ===
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1a10000-0000-4000-8000-000000000002","role":"authenticated"}';
-- Plain call (not a pgTAP assertion) -- this is fixture setup for the real assertion below, not
-- itself one of this file's 3 planned checks.
select accept_invite('claim-token-reuse');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"c1a10000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok(
  $$ select accept_invite('claim-token-reuse') $$,
  '22023',
  'invitation already used',
  'a claim invitation cannot be redeemed a second time by a different claimant'
);
reset role;

-- === 2. An expired invitation is rejected. ===
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1a10000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok(
  $$ select accept_invite('claim-token-expired-2') $$,
  '22023',
  'invitation expired',
  'an expired invitation is rejected even though it is otherwise well-formed'
);
reset role;

-- === 3. A member row that already has a real user_id cannot be claimed. ===
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1a10000-0000-4000-8000-000000000006","role":"authenticated"}';
select throws_ok(
  $$ select accept_invite('claim-token-has-login') $$,
  '22023',
  'profile already claimed',
  'a member row that already has its own login cannot be claimed by someone else'
);
reset role;

select * from finish();
rollback;
