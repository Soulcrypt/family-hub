begin;
select plan(6);

-- Task 14 fix round 3: /invite/[token] no longer calls accept_invite during a plain GET
-- render (claiming is irreversible -- the token is single-use, so a prefetched/previewed link
-- would otherwise burn a real invitation before the invited person ever decided to click
-- anything). The signed-in branch now previews the invite read-only via preview_invite() and
-- requires an explicit confirm-and-submit before accept_invite ever runs. This file covers
-- preview_invite() in isolation -- it never mutates household_invites or household_members,
-- so there is no plan(3)-style "call it twice" concern the way accept_invite has one.
--
-- Fixtures: House Preview (Preview Owner) with a login-less child (Preview Kid, targeted by a
-- valid claim invite) and a valid new-member invite (member_id null). An expired invite and an
-- already-used invite (accepted_at set directly, not via a prior accept_invite call -- this
-- file does not need a real claimant to prove the "already used" guard) round out the token-
-- validity cases preview_invite must reject exactly like accept_invite does.
insert into auth.users (id, email, raw_user_meta_data) values
  ('9e710000-0000-4000-8000-000000000001', 'previewowner@test.local', '{"display_name":"Preview Owner"}'::jsonb),
  ('9e710000-0000-4000-8000-000000000002', 'previewviewer@test.local','{"display_name":"Preview Viewer"}'::jsonb);

insert into households (id, name, created_by) values
  ('9e720000-0000-4000-8000-000000000001', 'House Preview', '9e710000-0000-4000-8000-000000000001');

insert into household_members (id, household_id, user_id, display_name, role) values
  ('9e730000-0000-4000-8000-000000000001', '9e720000-0000-4000-8000-000000000001',
   '9e710000-0000-4000-8000-000000000001', 'Preview Owner', 'owner'),
  ('9e730000-0000-4000-8000-000000000002', '9e720000-0000-4000-8000-000000000001',
   null, 'Preview Kid', 'child');

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
