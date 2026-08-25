-- SP1 Foundation design review, P0: the profile switcher (app/switch/page.tsx) opens a PIN
-- dialog for EVERY admin-role member other than the caller's own row -- `requiresPin()`
-- (lib/auth/permissions.ts) is true for `owner` and `parent` unconditionally -- but onboarding
-- never sets a PIN for anyone. A parent (e.g. Jamie Rivera in the seed) who has never had a
-- PIN set is therefore permanently unreachable: the dialog demands a PIN that does not exist,
-- and every guess comes back "Incorrect PIN — try again."
--
-- The fix needs the switcher to know, per member, whether a PIN is actually set -- WITHOUT
-- weakening 0011_member_pin_verification.sql's fix, which made `pin_hash` non-SELECTable by
-- `authenticated` for good reason (a table-wide SELECT grant implies every column; a member
-- reading another's `pin_hash` off the wire could crack a 4-digit bcrypt PIN offline in
-- minutes). So this adds a THIRD SECURITY DEFINER function alongside `set_member_pin` and
-- `verify_member_pin`, following the exact same shape as `verify_member_pin`: a member id in,
-- a plain boolean out, `is_household_member()` as the sole gate.
--
-- Disclosure analysis: revealing "this profile has a PIN set" to a FELLOW household member is
-- not a new leak -- it is exactly what tapping the tile already reveals today (a dialog opens
-- or it doesn't), and it is what this task's lock badge shows on screen anyway. It must NOT be
-- readable by anyone outside the household -- `is_household_member(v_household_id)` is what
-- holds that line, mirroring `verify_member_pin`'s own scoping exactly. See
-- supabase/tests/070_member_pin_status.sql for the pgTAP proof of both halves.
create function member_has_pin(p_member_id uuid)
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

    return v_hash is not null;
  end;
  $$;

revoke execute on function member_has_pin(uuid) from public;
grant  execute on function member_has_pin(uuid) to authenticated;
