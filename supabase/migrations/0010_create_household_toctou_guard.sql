-- Task 10 fix round 1: close a TOCTOU window in create_household().
--
-- create_household() has never had an existence check of its own -- it is
-- a plain three-row insert (households, household_members, household_settings).
-- The only thing that ever stopped one account from ending up with two
-- households was application code: app/onboarding/actions.ts's
-- createHouseholdAction reads getAccountMembership() and skips the RPC if
-- a membership already exists. That is a read-then-act race, not a
-- guarantee -- two genuinely concurrent calls from the SAME account (two
-- browser tabs, or a double-click landing inside the same event-loop tick
-- before React disables the submit button) can both pass that
-- application-level read before either transaction commits its insert,
-- and both succeed. household_members_user_unique (0001_schema.sql) is
-- `(household_id, user_id)`, not `(user_id)` alone, so it does not stop
-- this either -- the two rows land in two DIFFERENT households.
--
-- The result is exactly the state lib/auth/active-member.ts's own
-- comments call unrecoverable: MultipleHouseholdMembershipsError. Once an
-- account has two active household_members rows, every subsequent
-- request through getAccountMembership()/requireAccountMembership()
-- throws, for that account, everywhere -- not just on /onboarding.
--
-- Fix: take a transaction-scoped advisory lock keyed on the caller's own
-- uid at the very top of the function, before any read. A concurrent
-- second call from the SAME account blocks on this lock until the first
-- call's transaction commits or rolls back; pg_advisory_xact_lock
-- releases automatically at end of transaction, so there is no explicit
-- unlock to forget and no way for a lock to leak past a crash. Once the
-- lock is held, re-check for an existing active membership and raise a
-- clean, distinguishable error rather than either (a) silently creating
-- a second household, or (b) silently returning the id of the existing
-- one -- both would surprise a caller who has no way to tell which
-- happened.
--
-- hashtext() collapses the uid to an int4 lock key. A hash collision
-- between two different accounts' uids would only ever serialize their
-- create_household() calls against each other (briefly slower, both
-- still correct) -- the actual correctness guarantee comes from the
-- re-check below, which is keyed on the real uid, not from the lock key
-- being collision-free.
--
-- Deliberate scope note for future readers: this enforces SP1's
-- one-household-per-account assumption ON PURPOSE. A later sub-project
-- may legitimately want one account to belong to multiple households --
-- if so, that needs a new, explicit entry point (e.g. a "create another
-- household" action reachable from WITHIN an existing household, once
-- signed in), not a relaxation of this check. Onboarding's entire premise
-- is "you have nothing yet"; an authenticated account that already has a
-- membership calling this specific function is either the race this
-- migration closes, or a bug upstream -- never a legitimate second
-- household. Do not delete this check to "support multi-household" --
-- add a different function instead.
create or replace function create_household(p_name text, p_timezone text default 'UTC')
  returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
  declare
    v_uid uuid := auth.uid();
    v_household_id uuid;
    v_display_name text;
    v_name text;
    v_timezone text;
  begin
    if v_uid is null then
      raise exception 'not authenticated' using errcode = '42501';
    end if;

    -- Must happen before ANY read this function bases a decision on,
    -- including the existence check immediately below -- otherwise the
    -- same read-then-act race just moves one line down.
    perform pg_advisory_xact_lock(hashtext(v_uid::text));

    if exists (
      select 1 from household_members where user_id = v_uid and is_active
    ) then
      raise exception 'you already have a household' using errcode = '22023';
    end if;

    v_name := trim(coalesce(p_name, ''));
    if length(v_name) < 1 or length(v_name) > 80 then
      raise exception 'household name must be between 1 and 80 characters' using errcode = '22023';
    end if;

    v_timezone := coalesce(nullif(trim(p_timezone), ''), 'UTC');
    if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_timezone) then
      raise exception 'invalid timezone' using errcode = '22023';
    end if;

    select display_name into v_display_name from profiles where id = v_uid;
    if v_display_name is null then
      raise exception 'profile missing' using errcode = '42501';
    end if;

    insert into households (name, timezone, created_by)
    values (v_name, v_timezone, v_uid)
    returning id into v_household_id;

    -- Fix 1 (0008): truncate, then re-trim, then fall back -- a bare
    -- left(v_display_name, 40) could still land on an all-whitespace
    -- prefix even once profiles.display_name is CHECK-constrained.
    insert into household_members (household_id, user_id, display_name, role)
    values (v_household_id, v_uid, coalesce(nullif(trim(left(v_display_name, 40)), ''), 'Member'), 'owner');

    insert into household_settings (household_id) values (v_household_id);

    return v_household_id;
  end;
  $$;
