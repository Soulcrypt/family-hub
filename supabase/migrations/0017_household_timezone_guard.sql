-- Task 18 fix: households.timezone (0001_schema.sql) has never had a database-level
-- constraint. Validity was only ever enforced by two call sites agreeing to check it before
-- writing -- create_household() (0010_create_household_toctou_guard.sql) and app/settings' own
-- validation. Task 18's seed script is a third write path that reaches households directly via
-- INSERT, which is exactly the kind of write that convention was never going to survive --
-- confirmed empirically before writing this migration: supabase/tests/060_household_timezone_guard.sql's
-- INSERT/UPDATE probes both succeeded with a garbage 'Not/AZone' value against the pre-trigger
-- schema.
--
-- A CHECK constraint cannot express this: pg_catalog.pg_timezone_names is a view backed by a
-- set-returning function (it enumerates the server's zoneinfo database), not an immutable
-- expression, and Postgres flatly disallows subqueries inside a CHECK constraint regardless of
-- immutability. A BEFORE INSERT OR UPDATE trigger is the only way to validate against it,
-- and it runs unconditionally -- independent of which code path performs the write.
create function guard_household_timezone() returns trigger
  language plpgsql set search_path = public, pg_catalog, pg_temp as $$
  begin
    if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
      raise exception 'invalid timezone' using errcode = '22023';
    end if;
    return new;
  end;
  $$;

-- Scoped to `update of timezone` (rather than every UPDATE) so untouched rows never pay this
-- lookup on unrelated column writes; the trigger still fires on INSERT unconditionally since
-- there is no previous value to compare against.
create trigger household_timezone_guard
  before insert or update of timezone on households
  for each row execute function guard_household_timezone();
