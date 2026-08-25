begin;
select plan(10);

-- Task 14 fix round 3: /invite/[token] no longer calls accept_invite during a plain GET
-- render (claiming is irreversible -- the token is single-use, so a prefetched/previewed link
-- would otherwise burn a real invitation before the invited person ever decided to click
-- anything). The signed-in branch now previews the invite read-only via preview_invite() and
-- requires an explicit confirm-and-submit before accept_invite ever runs. This file covers
-- preview_invite() in isolation -- it never mutates household_invites or household_members,
-- so there is no plan(3)-style "call it twice" concern the way accept_invite has one.
--
-- Fix round 4: round 3's preview_invite checked only the TOKEN's validity, not whether the
-- CALLER is eligible to claim it -- so an ineligible token holder (already has a household,
-- already a member of this one, was removed from it, or the target row is already claimed) saw
-- a confirm screen naming a real household and a real child, then was only rejected on submit.
-- That is worse disclosure than the pre-round-3 flow, which revealed nothing to an ineligible
-- caller. preview_invite now runs the exact same eligibility checks accept_invite does, via the
-- shared assert_invite_claimable() helper (supabase/migrations/0015_shared_invite_eligibility_check.sql)
-- both functions call -- see that migration's header comment for why a shared helper, not two
-- copies, is what keeps them from drifting apart.
--
-- Fixtures: House Preview (Preview Owner) with a login-less child (Preview Kid, targeted by a
-- valid claim invite) and a valid new-member invite (member_id null). An expired invite and an
-- already-used invite (accepted_at set directly, not via a prior accept_invite call -- this
-- file does not need a real claimant to prove the "already used" guard) round out the token-
-- validity cases preview_invite must reject exactly like accept_invite does. House Preview
-- Rival exists solely to give Preview Rival an active membership somewhere ELSE (case: already
-- has a household). Preview Active Member and Preview Removed Member hold, respectively, an
-- ACTIVE and an INACTIVE row directly in House Preview (cases: already a member / removed
-- member of THIS household). Preview Claimed Kid already has a real login attached from the
-- start (case: target row already claimed).
insert into auth.users (id, email, raw_user_meta_data) values
  ('9e710000-0000-4000-8000-000000000001', 'previewowner@test.local', '{"display_name":"Preview Owner"}'::jsonb),
  ('9e710000-0000-4000-8000-000000000002', 'previewviewer@test.local','{"display_name":"Preview Viewer"}'::jsonb),
  ('9e710000-0000-4000-8000-000000000003', 'previewrival@test.local', '{"display_name":"Preview Rival"}'::jsonb),
  ('9e710000-0000-4000-8000-000000000004', 'previewactivemember@test.local', '{"display_name":"Preview Active Member"}'::jsonb),
  ('9e710000-0000-4000-8000-000000000005', 'previewremovedmember@test.local', '{"display_name":"Preview Removed Member"}'::jsonb),
  ('9e710000-0000-4000-8000-000000000006', 'previewclaimedlogin@test.local', '{"display_name":"Preview Claimed Login"}'::jsonb);

insert into households (id, name, created_by) values
  ('9e720000-0000-4000-8000-000000000001', 'House Preview', '9e710000-0000-4000-8000-000000000001'),
  ('9e720000-0000-4000-8000-000000000002', 'House Preview Rival', '9e710000-0000-4000-8000-000000000003');

insert into household_members (id, household_id, user_id, display_name, role) values
  ('9e730000-0000-4000-8000-000000000001', '9e720000-0000-4000-8000-000000000001',
   '9e710000-0000-4000-8000-000000000001', 'Preview Owner', 'owner'),
  ('9e730000-0000-4000-8000-000000000002', '9e720000-0000-4000-8000-000000000001',
   null, 'Preview Kid', 'child'),
  ('9e730000-0000-4000-8000-000000000003', '9e720000-0000-4000-8000-000000000002',
   '9e710000-0000-4000-8000-000000000003', 'Preview Rival', 'owner'),
  ('9e730000-0000-4000-8000-000000000004', '9e720000-0000-4000-8000-000000000001',
   '9e710000-0000-4000-8000-000000000004', 'Preview Active Member', 'parent'),
  ('9e730000-0000-4000-8000-000000000006', '9e720000-0000-4000-8000-000000000001',
   '9e710000-0000-4000-8000-000000000006', 'Preview Claimed Login', 'teen');

-- Preview Removed Member's row in House Preview is INACTIVE -- a previously-removed member.
insert into household_members (id, household_id, user_id, display_name, role, is_active) values
  ('9e730000-0000-4000-8000-000000000005', '9e720000-0000-4000-8000-000000000001',
   '9e710000-0000-4000-8000-000000000005', 'Preview Removed Member', 'child', false);

-- A valid claim invite for Preview Kid.
insert into household_invites (household_id, token_hash, role, member_id, expires_at, created_by)
values (
  '9e720000-0000-4000-8000-000000000001', encode(digest('preview-token-claim', 'sha256'), 'hex'), 'teen',
  '9e730000-0000-4000-8000-000000000002', now() + interval '7 days', '9e710000-0000-4000-8000-000000000001'
);

-- A valid new-member invite (member_id null).
insert into household_invites (household_id, token_hash, role, expires_at, created_by)
values (
  '9e720000-0000-4000-8000-000000000001', encode(digest('preview-token-new-member', 'sha256'), 'hex'), 'parent',
  now() + interval '7 days', '9e710000-0000-4000-8000-000000000001'
);

-- An already-expired invite.
insert into household_invites (household_id, token_hash, role, expires_at, created_by)
values (
  '9e720000-0000-4000-8000-000000000001', encode(digest('preview-token-expired', 'sha256'), 'hex'), 'teen',
  now() - interval '1 hour', '9e710000-0000-4000-8000-000000000001'
);

-- An already-used invite -- accepted_at set directly (this file only needs to prove
-- preview_invite checks it, not exercise a real claimant).
insert into household_invites (household_id, token_hash, role, expires_at, created_by, accepted_at)
values (
  '9e720000-0000-4000-8000-000000000001', encode(digest('preview-token-used', 'sha256'), 'hex'), 'teen',
  now() + interval '7 days', '9e710000-0000-4000-8000-000000000001', now()
);

-- Four fresh, otherwise-valid new-member invites (member_id null) for House Preview -- each
-- previewed below by a caller who is ineligible for a DIFFERENT reason than the token itself.
insert into household_invites (household_id, token_hash, role, expires_at, created_by)
values (
  '9e720000-0000-4000-8000-000000000001', encode(digest('preview-token-rival', 'sha256'), 'hex'), 'child',
  now() + interval '7 days', '9e710000-0000-4000-8000-000000000001'
);
insert into household_invites (household_id, token_hash, role, expires_at, created_by)
values (
  '9e720000-0000-4000-8000-000000000001', encode(digest('preview-token-already-member', 'sha256'), 'hex'), 'child',
  now() + interval '7 days', '9e710000-0000-4000-8000-000000000001'
);
insert into household_invites (household_id, token_hash, role, expires_at, created_by)
values (
  '9e720000-0000-4000-8000-000000000001', encode(digest('preview-token-removed-caller', 'sha256'), 'hex'), 'child',
  now() + interval '7 days', '9e710000-0000-4000-8000-000000000001'
);

-- A claim invite whose target (Preview Claimed Login) already has a real login attached.
insert into household_invites (household_id, token_hash, role, member_id, expires_at, created_by)
values (
  '9e720000-0000-4000-8000-000000000001', encode(digest('preview-token-claimed-target', 'sha256'), 'hex'), 'teen',
  '9e730000-0000-4000-8000-000000000006', now() + interval '7 days', '9e710000-0000-4000-8000-000000000001'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"9e710000-0000-4000-8000-000000000002","role":"authenticated"}';

select is(
  preview_invite('preview-token-claim'),
  jsonb_build_object('household_name', 'House Preview', 'member_display_name', 'Preview Kid'),
  'previewing a valid claim invite returns the household name and the target member''s display name, without mutating anything'
);

select is(
  preview_invite('preview-token-new-member'),
  jsonb_build_object('household_name', 'House Preview', 'member_display_name', null),
  'previewing a valid new-member invite (no member_id) returns a null member_display_name'
);

select throws_ok(
  $$ select preview_invite('this-token-does-not-exist') $$,
  '22023',
  'invitation not found',
  'previewing an unknown token is rejected exactly like accept_invite rejects it'
);

select throws_ok(
  $$ select preview_invite('preview-token-expired') $$,
  '22023',
  'invitation expired',
  'previewing an expired invite is rejected'
);

select throws_ok(
  $$ select preview_invite('preview-token-used') $$,
  '22023',
  'invitation already used',
  'previewing an already-used invite is rejected'
);

reset role;

-- === Fix round 4: previewing must reject the same INELIGIBLE callers accept_invite would,
-- rather than showing them a confirm screen naming a real household/member it will only
-- refuse on submit. Each case below uses a fresh, otherwise-perfectly-valid token -- the ONLY
-- thing wrong is the caller. ===

-- Preview Rival already has an ACTIVE membership in a COMPLETELY DIFFERENT household.
set local role authenticated;
set local request.jwt.claims = '{"sub":"9e710000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok(
  $$ select preview_invite('preview-token-rival') $$,
  '22023',
  'you already have a household',
  'previewing an invite while the caller already has an active household elsewhere is rejected at PREVIEW time, not just at submit'
);
reset role;

-- Preview Active Member already has an ACTIVE row in THIS SAME household.
set local role authenticated;
set local request.jwt.claims = '{"sub":"9e710000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok(
  $$ select preview_invite('preview-token-already-member') $$,
  '22023',
  'you are already a member of this household',
  'previewing an invite while the caller is already an active member of THIS household is rejected at preview time'
);
reset role;

-- Preview Removed Member has an INACTIVE row in THIS SAME household.
set local role authenticated;
set local request.jwt.claims = '{"sub":"9e710000-0000-4000-8000-000000000005","role":"authenticated"}';
select throws_ok(
  $$ select preview_invite('preview-token-removed-caller') $$,
  '22023',
  'you were removed from this household -- ask an owner or parent to restore your membership',
  'previewing an invite while the caller was removed (inactive row) from THIS household is rejected at preview time'
);
reset role;

-- Preview Viewer (otherwise perfectly eligible) previews a claim invite whose TARGET row
-- already has a real login (Preview Claimed Login) -- rejected for the target's sake, not the
-- caller's.
set local role authenticated;
set local request.jwt.claims = '{"sub":"9e710000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select preview_invite('preview-token-claimed-target') $$,
  '22023',
  'profile already claimed',
  'previewing a claim invite whose target member row already has a login is rejected at preview time'
);
reset role;

-- Established pattern (supabase/tests/020_bootstrap.sql): a claims object with no "sub" key
-- makes auth.uid() return null while still running AS the authenticated role -- this is what
-- actually exercises the function's own "not authenticated" guard, not `reset role` (which
-- only resets the ROLE, not the request.jwt.claims GUC a prior `set local` in this same
-- transaction already set).
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select preview_invite('preview-token-claim') $$,
  '42501',
  'not authenticated',
  'previewing an invite while signed out is rejected -- the signed-out branch of /invite/[token] never calls this at all, but the RPC itself must not trust otherwise'
);
reset role;

select * from finish();
rollback;
