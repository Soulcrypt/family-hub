-- Task 12 fix: `service_role` has never actually been able to read or write any of this
-- project's tables. 0003_revoke_unneeded_grants.sql already documents the intent --
-- "service_role is intentionally left untouched... by Supabase's own design it is the
-- trusted, RLS-bypassing backend role" -- but that intent was never backed by a grant.
--
-- `rolbypassrls` (which service_role has) only skips RLS POLICY evaluation; it does not
-- substitute for the underlying SQL privilege grant, and this project's local config
-- disables `auto_expose_new_tables` (see 0002_rls.sql's comment on the `authenticated`
-- grants below it). Every table here was created by migrations running as `postgres`, whose
-- default privileges for schema `public` hand new tables only TRUNCATE/REFERENCES/TRIGGER to
-- service_role -- never SELECT/INSERT/UPDATE/DELETE. Confirmed locally: querying any of
-- these five tables as service_role fails with "permission denied for table ..." before RLS
-- (which it bypasses anyway) is ever reached.
--
-- This went unnoticed through Tasks 1-11 because nothing used the service-role key. Task 12's
-- E2E test is the first to need it, to seed a PIN hash directly into `household_members`
-- (Task 13's own PIN-setting flow doesn't exist yet) the same way the pgTAP suites
-- (supabase/tests/*.sql) seed fixtures directly, bypassing the application layer.
--
-- Unlike the scoped, policy-mirroring grants to `authenticated` in 0002_rls.sql, service_role
-- is not policy-governed at all -- it is meant to have full backend access -- so this grants
-- every DML operation on every table, not just the ones with a matching RLS policy.
grant select, insert, update, delete on profiles           to service_role;
grant select, insert, update, delete on households         to service_role;
grant select, insert, update, delete on household_members  to service_role;
grant select, insert, update, delete on household_invites  to service_role;
grant select, insert, update, delete on household_settings to service_role;

-- Table grants alone are not enough: guard_household_members_admin_columns() (0004/0005) is a
-- BEFORE UPDATE trigger on household_members, and its guarded-columns check is
--   (new.role is distinct from old.role or ... or new.household_id is distinct from old.household_id)
--   and coalesce(household_role(old.household_id), 'child'::member_role) not in ('owner', 'parent')
-- Confirmed locally: Postgres does NOT reliably short-circuit this AND for a stable function
-- call the way one might assume (the same class of gotcha the official docs warn about --
-- "do not rely on AND/OR to provide left-to-right short-circuit evaluation... in ways other
-- programming languages do") -- household_role() gets invoked even for an UPDATE that only
-- touches pin_hash, an unguarded column no policy or trigger branch actually cares about.
-- 0002_rls.sql granted EXECUTE on both SECURITY DEFINER helpers to `authenticated` only, the
-- same omission this migration's table grants above are already fixing for service_role.
grant execute on function is_household_member(uuid) to service_role;
grant execute on function household_role(uuid)      to service_role;
