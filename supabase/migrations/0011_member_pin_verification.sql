-- Task 12 fix round 2, Important 1: any household member with their own login could read
-- every other member's `pin_hash` and crack it offline. `members_select_household`'s qual is
-- `is_household_member(household_id)` -- HOUSEHOLD-scoped, not SELF-scoped -- and
-- `has_column_privilege('authenticated', 'household_members', 'pin_hash', 'SELECT')` was
-- true, because the existing `grant select ... on household_members to authenticated`
-- (0002_rls.sql) is table-wide, and a table-wide SELECT grant implies SELECT on every column
-- regardless of any column-level REVOKE layered on top of it (Postgres: a role that holds the
-- whole-table privilege does not need, and is not restricted by, a column-level grant/revoke
-- -- see the GRANT/REVOKE reference on column privileges). Four digits against bcrypt cost 10
-- is ~10,000 candidates -- minutes offline, permanently and silently defeating the PIN gate
-- against exactly the person it exists to stop (a curious teen/child with devtools on the
-- shared tablet). This does not break the attribution/authority invariant (the PIN grants no
-- authority), so it is not Critical -- but it defeats the PIN's entire stated job.
--
-- Fix: PIN reads and writes move behind two SECURITY DEFINER functions, hashed/verified with
-- pgcrypto's crypt()/gen_salt() (NOT bcryptjs -- bcryptjs 3 emits `$2b$` hashes, which
-- pgcrypto's crypt() cannot verify; confirmed empirically before writing this migration:
-- attempting to verify a bcryptjs `$2b$` hash via crypt() silently returns false for the
-- correct PIN too, which would ship a security fix that rejects every real switch. pgcrypto
-- must own both the write and the read side.), and `pin_hash` itself is no longer directly
-- SELECTable by `authenticated` at all -- the actual fix, not the functions, which just give
-- the app a way to keep working without that column read.

-- set_member_pin: a member may set their OWN pin; an owner/parent may set one for any member
-- of THEIR OWN household. Authorization is derived entirely from auth.uid() via
-- household_role() (never from an argument), so a caller cannot claim admin of a household
-- they don't belong to, matching guard_household_members_admin_columns()'s own pattern
-- (0004/0005_trigger_fail_closed_and_freeze_identity.sql) of coalescing an unrecognized/absent
-- caller role to the least-privileged 'child' rather than an implicit pass.
create function set_member_pin(p_member_id uuid, p_pin text)
  returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
  declare
    v_uid uuid := auth.uid();
    v_target household_members%rowtype;
  begin
    if v_uid is null then
      raise exception 'not authenticated' using errcode = '42501';
    end if;
    if length(trim(coalesce(p_pin, ''))) = 0 then
      raise exception 'pin is required' using errcode = '22023';
    end if;

    select * into v_target from household_members where id = p_member_id;
    if v_target.id is null then
      raise exception 'member not found' using errcode = '22023';
    end if;

    if v_target.user_id is distinct from v_uid
       and coalesce(household_role(v_target.household_id), 'child'::member_role) not in ('owner', 'parent')
    then
      raise exception 'not permitted to set this pin' using errcode = '42501';
    end if;

    update household_members
    set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 10))
    where id = p_member_id;
  end;
  $$;

-- verify_member_pin: read-side counterpart. Collapses "member does not exist", "caller is not
-- a member of that household", "no pin set yet", and "wrong pin" into the same `false` --
-- never an exception, never a distinguishable result -- so a caller (switchToMemberAction)
-- cannot learn anything beyond "that pin did not verify". The is_household_member() scoping
-- is defense in depth beyond what the app's own pre-lookup already provides: without it nothing
-- would stop an authenticated member of ANY household from calling this RPC directly (bypassing
-- the app's UI and its own household-scoped member lookup) to brute-force a stranger's PIN with
-- no rate limit.
create function verify_member_pin(p_member_id uuid, p_pin text)
  returns boolean
  language plpgsql security definer set search_path = public, pg_temp as $$
  declare
    v_hash text;
    v_household_id uuid;
  begin
    if auth.uid() is null then
      return false;
    end if;

    select pin_hash, household_id into v_hash, v_household_id
    from household_members
    where id = p_member_id and is_active;

    if v_household_id is null or not is_household_member(v_household_id) then
      return false;
    end if;
    if v_hash is null or p_pin is null then
      return false;
    end if;

    return extensions.crypt(p_pin, v_hash) = v_hash;
  end;
  $$;

revoke execute on function set_member_pin(uuid, text)    from public;
revoke execute on function verify_member_pin(uuid, text) from public;
grant  execute on function set_member_pin(uuid, text)    to authenticated;
grant  execute on function verify_member_pin(uuid, text) to authenticated;

-- The actual fix: a table-wide SELECT grant implies SELECT on every column, so the only way
-- to withhold one column is to drop the table-wide grant and re-grant SELECT per remaining
-- column. Every column the application currently reads (app/switch/page.tsx,
-- app/onboarding/page.tsx, lib/auth/active-member.ts) is included below; `pin_hash` is the
-- one deliberate omission. INSERT/UPDATE/DELETE stay table-wide, unchanged from 0002_rls.sql
-- -- this migration is scoped to the SELECT-side disclosure Important 1 found, not a general
-- column-privilege pass; direct writes to `pin_hash` are made moot in practice by the app no
-- longer doing them (it calls set_member_pin instead), not by a grant change here.
revoke select on household_members from authenticated;
grant select (
  id, household_id, user_id, display_name, role, color, avatar_url, birthday,
  points_balance, dietary_prefs, allergies, is_active, created_at
) on household_members to authenticated;
