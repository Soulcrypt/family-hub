begin;
select plan(4);

-- Task 18 fix: households.timezone has never had a database-level constraint -- validity was
-- only ever enforced by two call sites agreeing to check it first (create_household,
-- 0010_create_household_toctou_guard.sql, and app/settings' own validation). Task 18's seed
-- script is a third write path that goes around both of them (a raw INSERT), which is exactly
-- where that convention was always going to break. This file's own INSERT below (before the
-- trigger exists, captured as this migration's RED) proves it: a garbage timezone is silently
-- accepted with no backstop at all.

insert into auth.users (id, email) values
  ('7a7a7a7a-7a7a-4a7a-8a7a-7a7a7a7a7a7a', 'tzguardowner@test.local');

-- A CHECK constraint cannot express this: pg_timezone_names is backed by a set-returning
-- function, not an immutable expression, and subqueries are banned inside CHECK entirely. Only
-- a BEFORE INSERT OR UPDATE trigger can look it up per-row.

select lives_ok(
  $$ insert into households (id, name, timezone, created_by) values
     ('7b7b7b7b-7b7b-4b7b-8b7b-7b7b7b7b7b7b', 'Guard Insert Household', 'America/Chicago',
      '7a7a7a7a-7a7a-4a7a-8a7a-7a7a7a7a7a7a') $$,
  'a valid IANA timezone is accepted on INSERT'
);

select throws_ok(
  $$ insert into households (id, name, timezone, created_by) values
     ('7c7c7c7c-7c7c-4c7c-8c7c-7c7c7c7c7c7c', 'Guard Insert Bad Household', 'Not/AZone',
      '7a7a7a7a-7a7a-4a7a-8a7a-7a7a7a7a7a7a') $$,
  '22023',
  'invalid timezone',
  'a garbage timezone is rejected on INSERT'
);

select throws_ok(
  $$ update households set timezone = 'Still/NotAZone'
     where id = '7b7b7b7b-7b7b-4b7b-8b7b-7b7b7b7b7b7b' $$,
  '22023',
  'invalid timezone',
  'a garbage timezone is rejected on UPDATE'
);

select lives_ok(
  $$ update households set timezone = 'Europe/London'
     where id = '7b7b7b7b-7b7b-4b7b-8b7b-7b7b7b7b7b7b' $$,
  'a valid IANA timezone is accepted on UPDATE'
);

select * from finish();
rollback;
