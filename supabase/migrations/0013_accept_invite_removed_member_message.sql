-- Task 14 fix round 2: distinguish "already an ACTIVE member of this household" from
-- "was a member of this household but was REMOVED (is_active = false)".
--
-- 0012_accept_invite_one_household_guard.sql's same-household check (itself unchanged from
-- Task 6) does not filter on is_active -- ANY household_members row matching (household_id,
-- user_id), active or not, raises 'you are already a member of this household'. That collided
-- with a real, ordinary product flow: a parent removes a teen (Task 13's deactivate flow, an
-- ordinary soft-delete via is_active = false), later wants them back, and creates a fresh
-- invite. The teen accepts it and is told "you are already a member of this household" --
-- while Task 13's own member list filters to active-only, so nobody can even SEE the row the
-- error is talking about. The parent is told the person is already there, cannot find them
-- anywhere in the UI, and has no way forward. A dead end, not a security boundary working as
-- intended.
--
-- Fix: split that single check into two, ordered active-first:
--   - An ACTIVE row in the invite's own household keeps the EXACT existing message and
--     errcode, unchanged -- supabase/tests/020_bootstrap.sql's assertion of it keeps passing
--     verbatim.
--   - An INACTIVE row in the invite's own household now raises a NEW, distinct, honest
--     message: they were removed from this household, and need an owner/parent to restore
--     their membership. It is deliberately NOT the same message, because "you are already a
--     member" is false for someone Task 13's UI shows as gone.
--
-- Explicitly NOT weakened: a removed member is still rejected here, not allowed to mint a
-- second household_members row for the same household. Their original row -- points, history,
-- everything -- still exists; the correct fix is to REACTIVATE it, not fragment their history
-- across two rows. This migration does not build that reactivation path -- there is no UI or
-- RPC yet that flips is_active back to true for a specific member (Task 13 only ever sets it
-- false). That belongs to member management and is intentionally left for Task 15 to build;
-- this migration's new error message point at a capability that does not exist yet, carried
-- deliberately rather than a gap discovered later. Until Task 15 ships it, a removed member who
-- receives a fresh invite is correctly told what happened and why they can't proceed, even
-- though nothing in the product yet lets an owner/parent act on that.
--
-- 0012's separate, broader check (ANY household, active memberships only, closing the
-- cross-household confused-deputy takeover) is unchanged and still runs AFTER both branches
-- below -- so a caller who was removed from household A can still accept a fresh invite into
-- household B, exactly as before. That specific case (removed from A, claims into B) had no
-- direct pgTAP coverage of its own until this migration's accompanying test file update, even
-- though it is exactly the behavior 0012's fix depends on being preserved.
create or replace function accept_invite(p_token text)
  returns uuid
  language plpgsql security definer set search_path = public, pg_temp, extensions as $$
  declare
    v_uid uuid := auth.uid();
    v_invite household_invites%rowtype;
    v_display_name text;
    v_member_id uuid;
  begin
    if v_uid is null then
      raise exception 'not authenticated' using errcode = '42501';
    end if;

    -- Must happen before any read this function's decisions depend on -- see
    -- 0012_accept_invite_one_household_guard.sql's header comment, and
    -- 0010_create_household_toctou_guard.sql's identical rule for create_household.
    perform pg_advisory_xact_lock(hashtext(v_uid::text));

    select * into v_invite from household_invites
    where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    for update;

    if v_invite.id is null then
      raise exception 'invitation not found' using errcode = '22023';
    end if;
    if v_invite.accepted_at is not null then
      raise exception 'invitation already used' using errcode = '22023';
    end if;
    if v_invite.expires_at < now() then
      raise exception 'invitation expired' using errcode = '22023';
    end if;

    -- Split from Task 6's original single check (unfiltered by is_active) into two, ordered
    -- active-first -- see this migration's header comment.
    if exists (
      select 1 from household_members
      where household_id = v_invite.household_id and user_id = v_uid and is_active
    ) then
      raise exception 'you are already a member of this household' using errcode = '22023';
    end if;

    if exists (
      select 1 from household_members
      where household_id = v_invite.household_id and user_id = v_uid and not is_active
    ) then
      raise exception 'you were removed from this household -- ask an owner or parent to restore your membership'
        using errcode = '22023';
    end if;

    -- Unchanged (0012): scoped to ANY household, ACTIVE memberships only. See that migration's
    -- header comment for why this is required (closes the cross-household takeover it fixes)
    -- and why is_active matters (a previously-removed member must not be locked out of a FRESH
    -- household elsewhere -- only the two checks above, scoped to the invite's OWN household,
    -- should ever mention restoration).
    if exists (
      select 1 from household_members where user_id = v_uid and is_active
    ) then
      raise exception 'you already have a household' using errcode = '22023';
    end if;

    select display_name into v_display_name from profiles where id = v_uid;

    if v_invite.member_id is not null then
      if not exists (
        select 1 from household_members
        where id = v_invite.member_id and household_id = v_invite.household_id
      ) then
        raise exception 'invitation not found' using errcode = '22023';
      end if;

      update household_members
      set user_id = v_uid, role = v_invite.role
      where id = v_invite.member_id
        and household_id = v_invite.household_id
        and user_id is null
        and is_active
      returning id into v_member_id;

      if v_member_id is null then
        raise exception 'profile already claimed' using errcode = '22023';
      end if;
    else
      -- Fix 1 (0008): truncate, then re-trim, then fall back -- see create_household's copy
      -- and 0008's header comment.
      insert into household_members (household_id, user_id, display_name, role)
      values (
        v_invite.household_id,
        v_uid,
        coalesce(nullif(trim(left(coalesce(v_display_name, 'Member'), 40)), ''), 'Member'),
        v_invite.role
      )
      returning id into v_member_id;
    end if;

    update household_invites set accepted_at = now() where id = v_invite.id;
    return v_member_id;
  end;
  $$;
