-- Follow-up to 0017_household_timezone_guard.sql. The guard is correct but it is not cheap,
-- and it was firing on writes that could not possibly invalidate anything.
--
-- pg_catalog.pg_timezone_names is a view over a set-returning function that re-enumerates the
-- server's entire zoneinfo database on every scan, with no caching between calls. Measured on
-- this project's local Postgres:
--
--   select count(*) from pg_catalog.pg_timezone_names;                            -- 31.2 ms
--   select exists (select 1 from pg_timezone_names where name = 'America/Chicago');-- 29.0 ms
--   ... and again                                                                 -- 28.6 ms
--   ... and again                                                                 -- 28.8 ms
--
-- It is ~29 ms EVERY time, not just the first. 0017 therefore added ~29 ms to every household
-- INSERT and to every UPDATE whose SET list so much as mentions `timezone` -- which the
-- household settings form does on every save, whether or not the user touched the zone. That
-- is a user-facing write path, and the added latency was real enough to flip a previously
-- marginal race in the settings E2E test (fixed separately, and properly, in that test).
--
-- `update of timezone` fires when the column APPEARS in the SET list, not when its value
-- changes, so the skip has to be on the value itself. If the stored value is unchanged it was
-- already validated by whatever wrote it, and re-checking it proves nothing: the guard exists
-- to stop a bad value being WRITTEN, not to re-litigate one already there.
create or replace function guard_household_timezone() returns trigger
  language plpgsql set search_path = public, pg_catalog, pg_temp as $$
  begin
    -- INSERT has no OLD record, so `tg_op` has to be checked before touching it.
    if tg_op = 'UPDATE' and new.timezone is not distinct from old.timezone then
      return new;
    end if;

    if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
      raise exception 'invalid timezone' using errcode = '22023';
    end if;

    return new;
  end;
  $$;
