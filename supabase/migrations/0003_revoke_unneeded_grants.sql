-- Task 5 fix round 1: TRUNCATE, REFERENCES, and TRIGGER are unnecessary
-- grants that anon/authenticated inherited from this project's baseline
-- default privileges (set before 0001_schema.sql, for role `postgres` in
-- schema `public`). TRUNCATE in particular bypasses Row Level Security
-- entirely -- RLS policies are never consulted for TRUNCATE -- so any
-- role holding it can empty a table regardless of every policy written in
-- 0002_rls.sql. REFERENCES (create a foreign key pointing at the table)
-- and TRIGGER (attach a trigger to the table) are the same class of
-- unnecessary grant: neither is required by any policy, which only ever
-- governs SELECT/INSERT/UPDATE/DELETE.
--
-- service_role is intentionally left untouched: by Supabase's own design
-- it is the trusted, RLS-bypassing backend role, not a policy-governed
-- client role.
revoke truncate, references, trigger on
  profiles,
  households,
  household_members,
  household_invites,
  household_settings
from anon, authenticated;

-- Without this, every future migration that creates a new table in
-- `public` (run as role `postgres`, same as these migrations) would
-- silently reintroduce the same TRUNCATE/REFERENCES/TRIGGER grants to
-- anon/authenticated, via this project's pre-existing default privileges
-- for role `postgres` in schema `public`. This closes that hole for
-- SP2-SP6 tasks that add tables later.
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;
