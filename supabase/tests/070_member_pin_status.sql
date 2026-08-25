begin;
select plan(7);

-- The P0 fix: the switcher (app/switch/page.tsx) needs to know WHICH admin profiles are
-- actually PIN-protected, so it can skip the dialog entirely for one that never had a PIN set
-- (onboarding never sets one -- see this task's report). `household_members.pin_hash` stays
-- non-SELECTable (0011_member_pin_verification.sql's fix, deliberately not weakened here), so
-- this adds a THIRD SECURITY DEFINER function, `member_has_pin`, alongside `set_member_pin`
-- and `verify_member_pin` -- same shape as `verify_member_pin`: takes a member id, returns a
-- plain boolean, and collapses "member doesn't exist"/"caller isn't in that household" into
-- the same `false` a member with no PIN set gets, rather than a distinguishable result.
--
-- Disclosure analysis (see this task's report for the full reasoning): revealing "this
-- profile has a PIN" to a FELLOW household member is not a new disclosure -- it's exactly
-- what tapping the tile already reveals today (a dialog appears or it doesn't), and it's what
-- the lock badge this task adds shows on screen anyway. It must NOT be readable by anyone
-- outside the household, which is what the stranger tests below prove.
--
-- Fixtures: House Lock (Lock Owner/owner with a PIN set, Lock Bare/parent with NO pin set --
-- a login-less second admin profile, exactly like Jamie Rivera in the seed) and House Rival
-- (Lock Rival/owner) -- a completely unrelated household, for the cross-household negative
-- control.
insert into auth.users (id, email, raw_user_meta_data) values
  ('44440000-0000-4000-8000-000000000001', 'lockowner@test.local', '{"display_name":"Lock Owner"}'::jsonb),
  ('44440000-0000-4000-8000-000000000002', 'lockrival@test.local', '{"display_name":"Lock Rival"}'::jsonb);

insert into households (id, name, created_by) values
  ('55550000-0000-4000-8000-000000000001', 'House Lock', '44440000-0000-4000-8000-000000000001'),
  ('55550000-0000-4000-8000-000000000002', 'House Rival', '44440000-0000-4000-8000-000000000002');

insert into household_members (id, household_id, user_id, display_name, role) values
  ('66660000-0000-4000-8000-000000000001', '55550000-0000-4000-8000-000000000001',
   '44440000-0000-4000-8000-000000000001', 'Lock Owner', 'owner'),
  ('66660000-0000-4000-8000-000000000002', '55550000-0000-4000-8000-000000000001',
   null, 'Lock Bare', 'parent'),
  ('66660000-0000-4000-8000-000000000003', '55550000-0000-4000-8000-000000000002',
   '44440000-0000-4000-8000-000000000002', 'Lock Rival', 'owner');

-- The function-level counterpart to 030's column-privilege check: PUBLIC must never be able
-- to call this directly, only `authenticated` (via the explicit grant below it).
select ok(
  not has_function_privilege('public', 'member_has_pin(uuid)', 'EXECUTE'),
  'public cannot execute member_has_pin'
);

-- Give Lock Owner an actual PIN to check truthiness against, through set_member_pin itself
-- (exactly like 030_member_pin.sql and seed.sql both do), so this test never hand-rolls a
-- pin_hash write.
set local role authenticated;
set local request.jwt.claims = '{"sub":"44440000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select set_member_pin('66660000-0000-4000-8000-000000000001', '1234') $$,
  'Lock Owner can set their own pin (fixture setup)'
);

-- === A fellow household member's session ===
-- Positive: a member of the SAME household sees true for a profile that has a pin set.
select is(
  member_has_pin('66660000-0000-4000-8000-000000000001'),
  true,
  'a household member sees true for a profile with a pin set'
);
-- Negative control: the same caller sees false for a profile in their OWN household that has
-- never had a pin set -- the exact case that was gating Jamie Rivera shut with no way in.
select is(
  member_has_pin('66660000-0000-4000-8000-000000000002'),
  false,
  'a household member sees false for a profile with no pin set'
);
-- A nonexistent member id is indistinguishable from "no pin set", not an error.
select is(
  member_has_pin('66660000-0000-4000-8000-00000000dead'),
  false,
  'a nonexistent member id returns false rather than throwing'
);
reset role;

-- === A stranger's session (owner of a COMPLETELY different household) ===
-- The disclosure boundary this migration must hold: a stranger gets false EVEN for the
-- profile that genuinely has a pin set -- "has a pin" must never leak across households,
-- regardless of the true answer.
set local role authenticated;
set local request.jwt.claims = '{"sub":"44440000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(
  member_has_pin('66660000-0000-4000-8000-000000000001'),
  false,
  'a stranger to the household sees false even for a profile that genuinely has a pin set'
);
reset role;

-- === No session at all ===
select is(
  member_has_pin('66660000-0000-4000-8000-000000000001'),
  false,
  'an unauthenticated caller sees false, never an error'
);

select * from finish();
rollback;
