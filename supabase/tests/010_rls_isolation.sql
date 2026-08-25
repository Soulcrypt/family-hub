begin;
select plan(11);

-- Two households, two owners, one teen in household A.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'a@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'b@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'teen@test.local');

insert into profiles (id, display_name) values
  ('11111111-1111-4111-8111-111111111111', 'Owner A'),
  ('22222222-2222-4222-8222-222222222222', 'Owner B'),
  ('33333333-3333-4333-8333-333333333333', 'Teen A');

insert into households (id, name, created_by) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'House A', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'House B', '22222222-2222-4222-8222-222222222222');

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
   null, 'Ivy', 'child');

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

select lives_ok(
  $$ update households set name = 'House A renamed' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  'owner A can rename their own household'
);

-- A bare `select ... from (update ... returning 1) t` is not valid SQL:
-- a data-modifying statement may only appear in a WITH clause, and that
-- WITH must be the top-level statement. Restructured accordingly; the
-- assertion (0 rows affected) is unchanged from the brief.
with upd as (
  update households set name = 'hacked'
  where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' returning 1
)
select is(count(*)::int, 0, 'owner A updating household B affects zero rows') from upd;

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

select is(
  (select count(*)::int from household_invites),
  0,
  'teen cannot read invitations'
);

select * from finish();
rollback;
