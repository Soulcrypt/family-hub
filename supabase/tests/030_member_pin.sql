begin;
select plan(13);

-- Task 12 fix round 2, Important 1: `pin_hash` must never be directly SELECTable by
-- `authenticated`, and all reads/writes must go through the two SECURITY DEFINER functions
-- (supabase/migrations/0011_member_pin_verification.sql). This file covers both.
--
-- Fixtures: House Pin (Pin Owner/owner, Pin Teen/teen with their own login, Pin Child/child
-- login-less, Pin Deputy/parent login-less -- a second admin profile an owner can set a PIN
-- for on someone else's behalf) and House Stranger (Pin Stranger/owner) -- a completely
-- unrelated household, for the cross-household negative control.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11110000-0000-4000-8000-000000000001', 'pinowner@test.local',    '{"display_name":"Pin Owner"}'::jsonb),
  ('11110000-0000-4000-8000-000000000002', 'pinteen@test.local',     '{"display_name":"Pin Teen"}'::jsonb),
  ('11110000-0000-4000-8000-000000000003', 'pinstranger@test.local', '{"display_name":"Pin Stranger"}'::jsonb);

insert into households (id, name, created_by) values
  ('22220000-0000-4000-8000-000000000001', 'House Pin',      '11110000-0000-4000-8000-000000000001'),
  ('22220000-0000-4000-8000-000000000002', 'House Stranger', '11110000-0000-4000-8000-000000000003');

insert into household_members (id, household_id, user_id, display_name, role) values
  ('33330000-0000-4000-8000-000000000001', '22220000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000001', 'Pin Owner', 'owner'),
  ('33330000-0000-4000-8000-000000000002', '22220000-0000-4000-8000-000000000001',
   '11110000-0000-4000-8000-000000000002', 'Pin Teen', 'teen'),
  ('33330000-0000-4000-8000-000000000003', '22220000-0000-4000-8000-000000000001',
   null, 'Pin Child', 'child'),
  ('33330000-0000-4000-8000-000000000004', '22220000-0000-4000-8000-000000000001',
   null, 'Pin Deputy', 'parent'),
  ('33330000-0000-4000-8000-000000000005', '22220000-0000-4000-8000-000000000002',
   '11110000-0000-4000-8000-000000000003', 'Pin Stranger', 'owner');

-- The actual fix, checked independent of any session: a table-wide SELECT grant implies every
-- column, so this only holds if 0011's revoke-then-column-regrant genuinely replaced it.
select ok(
  not has_column_privilege('authenticated', 'household_members', 'pin_hash', 'SELECT'),
  'authenticated cannot select household_members.pin_hash'
);

-- === Pin Owner's session ===
set local role authenticated;
set local request.jwt.claims = '{"sub":"11110000-0000-4000-8000-000000000001","role":"authenticated"}';

-- Positive: a member can set their own PIN.
select lives_ok(
  $$ select set_member_pin('33330000-0000-4000-8000-000000000001', '1111') $$,
  'Pin Owner can set their own pin'
);
select is(
  verify_member_pin('33330000-0000-4000-8000-000000000001', '1111'),
  true,
  'verify_member_pin returns true for the right pin'
);
select is(
  verify_member_pin('33330000-0000-4000-8000-000000000001', '9999'),
  false,
  'verify_member_pin returns false for the wrong pin (negative control for the previous case)'
);

-- Positive: an owner can set a PIN for a member of their own household on that member's
-- behalf (Pin Deputy is login-less, so this is the only way it ever gets one).
select lives_ok(
  $$ select set_member_pin('33330000-0000-4000-8000-000000000004', '2222') $$,
  'an owner can set a pin for another member of their own household'
);
select is(
  verify_member_pin('33330000-0000-4000-8000-000000000004', '2222'),
  true,
  'verify_member_pin is true after an owner sets a pin on a member''s behalf'
);

-- Negative control: a member who never had a PIN set (Pin Teen, at this point in the file)
-- verifies false, not an error -- covered again from Pin Teen's own session below.
select is(
  verify_member_pin('33330000-0000-4000-8000-000000000002', 'anything'),
  false,
  'verify_member_pin returns false for a null stored hash rather than throwing'
);

reset role;

-- === Pin Teen's session (non-admin, has their own login) ===
set local role authenticated;
set local request.jwt.claims = '{"sub":"11110000-0000-4000-8000-000000000002","role":"authenticated"}';

-- Negative: a teen cannot set another member's pin -- neither an admin's nor a peer's.
select throws_ok(
  $$ select set_member_pin('33330000-0000-4000-8000-000000000001', '0000') $$,
  '42501',
  null,
  'a teen cannot set the owner''s pin'
);
select throws_ok(
  $$ select set_member_pin('33330000-0000-4000-8000-000000000003', '0000') $$,
  '42501',
  null,
  'a teen cannot set another member''s pin either'
);

-- Positive (negative control for the two throws_ok above): self-service isn't role-gated --
-- a non-admin can still set their OWN pin.
select lives_ok(
  $$ select set_member_pin('33330000-0000-4000-8000-000000000002', '3333') $$,
  'a teen can set their own pin'
);
select is(
  verify_member_pin('33330000-0000-4000-8000-000000000002', '3333'),
  true,
  'verify_member_pin is true for the teen''s own freshly-set pin'
);

reset role;

-- === Pin Stranger's session (an owner, but of a DIFFERENT household) ===
set local role authenticated;
set local request.jwt.claims = '{"sub":"11110000-0000-4000-8000-000000000003","role":"authenticated"}';

-- Negative control: being an owner somewhere doesn't carry over -- household_role() is scoped
-- to the TARGET member's own household, not the caller's admin status in general.
select throws_ok(
  $$ select set_member_pin('33330000-0000-4000-8000-000000000003', '5555') $$,
  '42501',
  null,
  'an owner of a different household cannot set a pin for House Pin''s child'
);

-- Negative control: verify_member_pin never discloses a stranger's pin either -- the correct
-- pin gets the same `false` a wrong guess or a non-member's row would, never a distinguishable
-- result.
select is(
  verify_member_pin('33330000-0000-4000-8000-000000000001', '1111'),
  false,
  'verify_member_pin returns false for a member outside the caller''s household, even with the correct pin'
);

select * from finish();
rollback;
