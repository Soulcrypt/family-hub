-- Task 5 fix round 3: two findings from re-review of 0004's trigger.
--
-- Open 1 (Important): the guard read
--   household_role(old.household_id) not in ('owner', 'parent')
-- When the caller has NO active membership in the row's household at
-- all, household_role() returns NULL, and `NULL not in (...)` evaluates
-- to NULL -- not TRUE -- so the `if` never fires and the write is
-- silently PERMITTED. Not reachable by `authenticated` today only
-- because the surrounding SELECT policy and fix 2's WITH CHECK already
-- exclude a non-member before the trigger ever runs -- exactly the kind
-- of implicit-side-effect dependency finding 2 asked us to stop relying
-- on for a Critical guard. Wrapped in coalesce() so an unrecognized
-- caller is always treated as the least-privileged role, never as an
-- implicit pass.
--
-- Open 2 (Important): tightening members_insert_admins (fix 4) closed
-- planting an arbitrary user_id via INSERT, but members_update_admins
-- was untouched: an owner could
--   update household_members set user_id = '<stranger>' where id = <a
--   login-less row in my household>
-- and then read that stranger's profile via
-- profiles_select_self_and_household -- the same unconsented-membership
-- / profile-disclosure chain fix 4 closed, one verb over. `id` is frozen
-- for the same class of reason, plus household_invites.member_id is a
-- foreign key to it.
--
-- Both are fixed in the same trigger function, gated by `current_user`
-- (not a session variable -- `authenticated` could set that itself and
-- hand every client a bypass) to detect trusted SECURITY DEFINER
-- context: such a function, owned by `postgres` (this project's table
-- owner, and the role every migration and RPC runs as), executes with
-- current_user = 'postgres' regardless of which authenticated user
-- actually invoked it (auth.uid() still resolves to that original
-- caller -- SECURITY DEFINER elevates table/trigger privilege, not JWT
-- identity). This is what lets Task 6's accept_invite() attach a real
-- user_id to a login-less row on behalf of a non-admin caller.
--
-- This is a real, intentional bypass surface, stated plainly: ANY
-- SECURITY DEFINER function owned by `postgres` is automatically exempt
-- from this entire trigger, not just for user_id/id. Writing such a
-- function means opting OUT of this protection -- it must perform its
-- own authorization checks rather than relying on this trigger to catch
-- a mistake.
create or replace function guard_household_members_admin_columns() returns trigger
  language plpgsql set search_path = public, pg_temp as $$
  begin
    if current_user = 'postgres' then
      return new;
    end if;

    if new.id is distinct from old.id or new.user_id is distinct from old.user_id then
      raise exception
        'id and user_id may only be changed by a trusted server-side function'
        using errcode = '42501';
    end if;

    if (new.role is distinct from old.role
        or new.points_balance is distinct from old.points_balance
        or new.is_active is distinct from old.is_active
        or new.household_id is distinct from old.household_id)
       and coalesce(household_role(old.household_id), 'child'::member_role) not in ('owner', 'parent')
    then
      raise exception
        'only an owner or parent may change role, points_balance, is_active, or household_id'
        using errcode = '42501';
    end if;

    return new;
  end;
  $$;
