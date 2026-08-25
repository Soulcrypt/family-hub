begin;
select plan(8);

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
--   4. Task 14 fix round 1: a caller who already holds an ACTIVE membership in a DIFFERENT
--      household is rejected -- and the targeted member row is left untouched -- rather than
--      being silently attached to a stranger's login-less member row (a real identity
--      takeover, and one that also leaves the caller's own account with two active
--      household_members rows, which lib/auth/active-member.ts's lookupAccountMembership()
--      treats as an unrecoverable MultipleHouseholdMembershipsError). This was originally
--      "fixed" at the Next.js page layer (app/invite/[token]/page.tsx), which does not close
--      it: accept_invite is EXECUTE-granted to `authenticated` and reachable directly via the
--      anon key, bypassing that page entirely. The real fix has to live here.
--   5. Same fix, negative control: a caller whose ONLY existing membership is INACTIVE (a
--      previously-removed member) must NOT be blocked -- only an ACTIVE membership elsewhere
--      should count. This is also the ONLY coverage of "removed from household A, claims into
--      household B still succeeds" -- the exact behavior case 4's fix depends on preserving.
--   6. Task 14 fix round 2: an ACTIVE member of the invite's OWN household is rejected with the
--      original, unchanged message.
--   7. Same fix round, the actual bug: an INACTIVE member of the invite's OWN household (a
--      previously-removed member, e.g. by Task 13's deactivate flow) gets a DISTINCT, honest
--      message pointing at restoration -- not the same "you are already a member" message,
--      which is actively false for someone Task 13's own member list no longer shows at all.
--      (Restoring a removed member -- flipping is_active back to true -- is not built yet;
--      that belongs to Task 15's member management. This message intentionally names a
--      capability that does not exist yet.)
--
-- Fixtures: House Claim (Claim Owner) with two login-less-at-fixture-time children -- Claim
-- Kid (claimed by First Claimant below) and Expired Kid (targeted by an already-expired
-- invite) -- plus Claimed Kid, who already has a real login (Existing Login) attached from the
-- start, to isolate case 3 from case 1. Guarded Kid is a third login-less child, targeted by
-- case 4's cross-household attack attempt. House Attacker exists solely to give Cross
-- Household Attacker an active membership somewhere ELSE; Removed Member's only row there is
-- INACTIVE, for case 5's negative control. House Rejoin exists solely for cases 6/7: Active
-- Rejoiner holds an ACTIVE row there, Removed Teen holds an INACTIVE one -- both then try to
-- accept a FRESH invite for that SAME household.
insert into auth.users (id, email, raw_user_meta_data) values
  ('c1a10000-0000-4000-8000-000000000001', 'claimowner@test.local',    '{"display_name":"Claim Owner"}'::jsonb),
  ('c1a10000-0000-4000-8000-000000000002', 'firstclaimant@test.local', '{"display_name":"First Claimant"}'::jsonb),
  ('c1a10000-0000-4000-8000-000000000003', 'secondclaimant@test.local','{"display_name":"Second Claimant"}'::jsonb),
  ('c1a10000-0000-4000-8000-000000000004', 'expiredclaimant@test.local','{"display_name":"Expired Claimant"}'::jsonb),
  ('c1a10000-0000-4000-8000-000000000005', 'existinglogin@test.local', '{"display_name":"Existing Login"}'::jsonb),
  ('c1a10000-0000-4000-8000-000000000006', 'alreadyclaimant@test.local','{"display_name":"Already Claimant"}'::jsonb),
  ('c1a10000-0000-4000-8000-000000000007', 'crosshousehold@test.local','{"display_name":"Cross Household Attacker"}'::jsonb),
  ('c1a10000-0000-4000-8000-000000000008', 'removedmember@test.local', '{"display_name":"Removed Member"}'::jsonb),
  ('c1a10000-0000-4000-8000-000000000009', 'rejoinowner@test.local',   '{"display_name":"Rejoin Owner"}'::jsonb),
  ('c1a10000-0000-4000-8000-00000000000a', 'activerejoiner@test.local','{"display_name":"Active Rejoiner"}'::jsonb),
  ('c1a10000-0000-4000-8000-00000000000b', 'removedteen@test.local',   '{"display_name":"Removed Teen"}'::jsonb);

insert into households (id, name, created_by) values
  ('c1a20000-0000-4000-8000-000000000001', 'House Claim', 'c1a10000-0000-4000-8000-000000000001'),
  ('c1a20000-0000-4000-8000-000000000002', 'House Attacker', 'c1a10000-0000-4000-8000-000000000007'),
  ('c1a20000-0000-4000-8000-000000000003', 'House Rejoin', 'c1a10000-0000-4000-8000-000000000009');

insert into household_members (id, household_id, user_id, display_name, role, points_balance) values
  ('c1a30000-0000-4000-8000-000000000001', 'c1a20000-0000-4000-8000-000000000001',
   'c1a10000-0000-4000-8000-000000000001', 'Claim Owner', 'owner', 0),
  ('c1a30000-0000-4000-8000-000000000002', 'c1a20000-0000-4000-8000-000000000001',
   null, 'Claim Kid', 'child', 250),
  ('c1a30000-0000-4000-8000-000000000003', 'c1a20000-0000-4000-8000-000000000001',
   null, 'Expired Kid', 'child', 100),
  ('c1a30000-0000-4000-8000-000000000004', 'c1a20000-0000-4000-8000-000000000001',
   'c1a10000-0000-4000-8000-000000000005', 'Claimed Kid', 'teen', 75),
  ('c1a30000-0000-4000-8000-000000000006', 'c1a20000-0000-4000-8000-000000000001',
   null, 'Guarded Kid', 'child', 500),
  ('c1a30000-0000-4000-8000-000000000007', 'c1a20000-0000-4000-8000-000000000002',
   'c1a10000-0000-4000-8000-000000000007', 'Cross Household Attacker', 'owner', 0);

-- Removed Member's ONLY household_members row, and it is INACTIVE -- a previously-removed
-- member, not a currently-active one anywhere.
insert into household_members (id, household_id, user_id, display_name, role, is_active) values
  ('c1a30000-0000-4000-8000-000000000008', 'c1a20000-0000-4000-8000-000000000002',
   'c1a10000-0000-4000-8000-000000000008', 'Removed Member', 'child', false);

insert into household_members (id, household_id, user_id, display_name, role) values
  ('c1a30000-0000-4000-8000-000000000009', 'c1a20000-0000-4000-8000-000000000003',
   'c1a10000-0000-4000-8000-000000000009', 'Rejoin Owner', 'owner'),
  ('c1a30000-0000-4000-8000-00000000000a', 'c1a20000-0000-4000-8000-000000000003',
   'c1a10000-0000-4000-8000-00000000000a', 'Active Rejoiner', 'child');

-- Removed Teen's row in House Rejoin -- INACTIVE, e.g. Task 13's own deactivate flow. This is
-- the case cases 6/7 exist to distinguish from Active Rejoiner's.
insert into household_members (id, household_id, user_id, display_name, role, is_active) values
  ('c1a30000-0000-4000-8000-00000000000b', 'c1a20000-0000-4000-8000-000000000003',
   'c1a10000-0000-4000-8000-00000000000b', 'Removed Teen', 'teen', false);

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

-- Invite 4: a valid claim invite for Guarded Kid -- targeted below by Cross Household
-- Attacker, who already has an active membership in a COMPLETELY DIFFERENT household.
insert into household_invites (household_id, token_hash, role, member_id, expires_at, created_by)
values (
  'c1a20000-0000-4000-8000-000000000001', encode(digest('claim-token-cross-household', 'sha256'), 'hex'), 'parent',
  'c1a30000-0000-4000-8000-000000000006', now() + interval '7 days', 'c1a10000-0000-4000-8000-000000000001'
);

-- Invite 5: a fresh new-member invite (member_id null) -- targeted below by Removed Member,
-- whose only existing row is inactive, and whose only existing row is in a DIFFERENT
-- household (House Attacker) than this invite's own (House Claim).
insert into household_invites (household_id, token_hash, role, expires_at, created_by)
values (
  'c1a20000-0000-4000-8000-000000000001', encode(digest('claim-token-removed-member-ok', 'sha256'), 'hex'), 'child',
  now() + interval '7 days', 'c1a10000-0000-4000-8000-000000000001'
);

-- Invite 6: a fresh new-member invite for House Rejoin -- targeted below by Active Rejoiner,
-- who already has an ACTIVE row in this SAME household.
insert into household_invites (household_id, token_hash, role, expires_at, created_by)
values (
  'c1a20000-0000-4000-8000-000000000003', encode(digest('claim-token-rejoin-active', 'sha256'), 'hex'), 'child',
  now() + interval '7 days', 'c1a10000-0000-4000-8000-000000000009'
);

-- Invite 7: a fresh new-member invite for House Rejoin -- targeted below by Removed Teen, who
-- has an INACTIVE row in this SAME household (not a different one, unlike invite 5).
insert into household_invites (household_id, token_hash, role, expires_at, created_by)
values (
  'c1a20000-0000-4000-8000-000000000003', encode(digest('claim-token-rejoin-removed', 'sha256'), 'hex'), 'teen',
  now() + interval '7 days', 'c1a10000-0000-4000-8000-000000000009'
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

-- === 4. Cross Household Attacker already owns House Attacker (active); accepting Guarded
-- Kid's claim invite (House Claim) must be rejected -- not silently succeed into a second
-- active membership and a hijacked stranger's profile. ===
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1a10000-0000-4000-8000-000000000007","role":"authenticated"}';
select throws_ok(
  $$ select accept_invite('claim-token-cross-household') $$,
  '22023',
  'you already have a household',
  'an account with an active membership in a DIFFERENT household cannot accept an invite for another one'
);
reset role;

select is(
  (select user_id from household_members where id = 'c1a30000-0000-4000-8000-000000000006'),
  null,
  'Guarded Kid''s row was never attached to the rejected cross-household caller'
);

-- === 5. Negative control: Removed Member's only row is INACTIVE, and it is in a DIFFERENT
-- household than this invite -- neither fact should block them from accepting a brand-new
-- invite elsewhere. This is the exact "removed from A, claims into B" behavior case 4's fix
-- depends on preserving. ===
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1a10000-0000-4000-8000-000000000008","role":"authenticated"}';
select lives_ok(
  $$ select accept_invite('claim-token-removed-member-ok') $$,
  'a caller removed from a DIFFERENT household (their only membership, and it is inactive) can still accept a fresh invite elsewhere'
);
reset role;

-- === 6. An ACTIVE member of the invite's OWN household still gets the original, unchanged
-- message. ===
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1a10000-0000-4000-8000-00000000000a","role":"authenticated"}';
select throws_ok(
  $$ select accept_invite('claim-token-rejoin-active') $$,
  '22023',
  'you are already a member of this household',
  'an ACTIVE member of the invite''s own household is rejected with the original message, unchanged'
);
reset role;

-- === 7. Fix round 2's actual bug: an INACTIVE member of the invite's OWN household (removed,
-- e.g. by Task 13's deactivate flow) gets a DISTINCT, honest message -- not "you are already a
-- member", which is false for someone the app's own member list no longer shows at all. ===
set local role authenticated;
set local request.jwt.claims = '{"sub":"c1a10000-0000-4000-8000-00000000000b","role":"authenticated"}';
select throws_ok(
  $$ select accept_invite('claim-token-rejoin-removed') $$,
  '22023',
  'you were removed from this household -- ask an owner or parent to restore your membership',
  'a REMOVED (inactive) member of the invite''s own household gets a distinct message pointing at restoration, not "already a member"'
);
reset role;

select * from finish();
rollback;
