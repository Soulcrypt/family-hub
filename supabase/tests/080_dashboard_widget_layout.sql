begin;
select plan(15);

-- SP1 Foundation dashboard rebuild: member_dashboard_layouts (0020_dashboard_widget_layout.sql)
-- stores which widgets a member's dashboard shows and in what order. Fixtures: House Layout
-- (Layout Owner/owner, Layout Kid/child -- a login-less member, exactly like Ivy, to prove a
-- fellow household member can write a layout on their behalf) and House Layout Rival (an
-- entirely unrelated household) for the cross-household negative controls.
insert into auth.users (id, email, raw_user_meta_data) values
  ('8b8b0000-0000-4000-8000-000000000001', 'layoutowner@test.local', '{"display_name":"Layout Owner"}'::jsonb),
  ('8b8b0000-0000-4000-8000-000000000002', 'layoutrival@test.local', '{"display_name":"Layout Rival"}'::jsonb);

insert into households (id, name, created_by) values
  ('8c8c0000-0000-4000-8000-000000000001', 'House Layout', '8b8b0000-0000-4000-8000-000000000001'),
  ('8c8c0000-0000-4000-8000-000000000002', 'House Layout Rival', '8b8b0000-0000-4000-8000-000000000002');

insert into household_members (id, household_id, user_id, display_name, role) values
  ('8d8d0000-0000-4000-8000-000000000001', '8c8c0000-0000-4000-8000-000000000001',
   '8b8b0000-0000-4000-8000-000000000001', 'Layout Owner', 'owner'),
  ('8d8d0000-0000-4000-8000-000000000003', '8c8c0000-0000-4000-8000-000000000002',
   '8b8b0000-0000-4000-8000-000000000002', 'Layout Rival', 'owner');

insert into household_members (id, household_id, user_id, display_name, role) values
  ('8d8d0000-0000-4000-8000-000000000002', '8c8c0000-0000-4000-8000-000000000001',
   null, 'Layout Kid', 'child');

set local role authenticated;
set local request.jwt.claims = '{"sub":"8b8b0000-0000-4000-8000-000000000001","role":"authenticated"}';

-- A household member can write a layout for a LOGIN-LESS fellow member (Layout Kid) -- the
-- exact case a login-less toddler like Ivy needs, since she can never open the edit-widgets
-- drawer herself.
select lives_ok(
  $$ insert into member_dashboard_layouts (member_id, household_id, widgets) values
     ('8d8d0000-0000-4000-8000-000000000002', '8c8c0000-0000-4000-8000-000000000001',
      '["weather","news"]'::jsonb) $$,
  'a household member can insert a dashboard layout for a login-less fellow member'
);

select is(
  (select widgets from member_dashboard_layouts where member_id = '8d8d0000-0000-4000-8000-000000000002'),
  '["weather","news"]'::jsonb,
  'the inserted layout round-trips exactly'
);

select lives_ok(
  $$ update member_dashboard_layouts set widgets = '["dinner","weather","photos"]'::jsonb
     where member_id = '8d8d0000-0000-4000-8000-000000000002' $$,
  'a valid widget list is accepted on UPDATE'
);

select throws_ok(
  $$ insert into member_dashboard_layouts (member_id, household_id, widgets) values
     ('8d8d0000-0000-4000-8000-000000000001', '8c8c0000-0000-4000-8000-000000000001',
      '["schedule","budget"]'::jsonb) $$,
  '22023',
  'unknown widget key: budget',
  'an unrecognized widget key is rejected'
);

select throws_ok(
  $$ insert into member_dashboard_layouts (member_id, household_id, widgets) values
     ('8d8d0000-0000-4000-8000-000000000001', '8c8c0000-0000-4000-8000-000000000001',
      '["news","news"]'::jsonb) $$,
  '22023',
  'duplicate widget key: news',
  'a repeated widget key is rejected'
);

select throws_ok(
  $$ insert into member_dashboard_layouts (member_id, household_id, widgets) values
     ('8d8d0000-0000-4000-8000-000000000001', '8c8c0000-0000-4000-8000-000000000001',
      '{"schedule":true}'::jsonb) $$,
  '22023',
  'widgets must be a jsonb array',
  'a non-array widgets value is rejected'
);

-- The denormalized household_id must actually match the member's real household -- an owner
-- cannot plant a row claiming a member from a DIFFERENT household lives in theirs.
select throws_ok(
  $$ insert into member_dashboard_layouts (member_id, household_id, widgets) values
     ('8d8d0000-0000-4000-8000-000000000003', '8c8c0000-0000-4000-8000-000000000001',
      '["weather"]'::jsonb) $$,
  '42501',
  null,
  'household_id must match the target member''s actual household -- cannot claim a rival household member'
);

reset role;

-- === A stranger to the household (owner of a completely different household) ===
set local role authenticated;
set local request.jwt.claims = '{"sub":"8b8b0000-0000-4000-8000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::int from member_dashboard_layouts where household_id = '8c8c0000-0000-4000-8000-000000000001'),
  0,
  'a stranger to the household sees no rows from it at all (RLS select scoping)'
);

select throws_ok(
  $$ insert into member_dashboard_layouts (member_id, household_id, widgets) values
     ('8d8d0000-0000-4000-8000-000000000002', '8c8c0000-0000-4000-8000-000000000001',
      '["weather"]'::jsonb) $$,
  '42501',
  null,
  'a stranger cannot insert a layout row into a household they do not belong to'
);

-- An UPDATE whose WHERE clause matches nothing (because RLS's `using` clause hides the row
-- from this caller entirely) is not an error in Postgres -- it just affects zero rows. So this
-- proves the isolation by running the UPDATE (lives_ok: no exception) and then, back as an
-- unrestricted reader, confirming the value never actually changed.
select lives_ok(
  $$ update member_dashboard_layouts set widgets = '["news"]'::jsonb
     where member_id = '8d8d0000-0000-4000-8000-000000000002' $$,
  'a stranger''s UPDATE against another household''s row runs without error, but RLS hides the row so it matches nothing'
);

reset role;

select isnt(
  (select widgets from member_dashboard_layouts where member_id = '8d8d0000-0000-4000-8000-000000000002'),
  '["news"]'::jsonb,
  'the stranger''s update did not actually change the row -- RLS hid it from their UPDATE entirely'
);

-- === No session at all ===
-- Following supabase/tests/010_rls_isolation.sql's established pattern for this case: pgTAP
-- runs as a superuser role that bypasses RLS entirely, so actually attempting a SELECT as
-- `anon` would prove nothing here. Asserting the GRANT itself is absent is what actually pins
-- this down -- and independent of RLS, the same class of gap 010's own "fix round 2" comment
-- describes (a future migration could add a policy for anon without anyone noticing there was
-- never a GRANT to match).
select ok(
    not has_table_privilege('anon', 'member_dashboard_layouts', priv),
    format('anon cannot %s on member_dashboard_layouts', priv)
  )
from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as priv;

select * from finish();
rollback;
