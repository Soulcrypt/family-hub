-- Task 14 fix round 4: fix round 3's confirm screen made disclosure WORSE, and its own new
-- E2E test demonstrated it without anyone noticing at the time.
--
-- preview_invite() (0014_invite_preview_rpc.sql) checked only that the TOKEN was valid --
-- found, unused, unexpired -- and deliberately said nothing about whether the CALLER was
-- eligible to claim it (already has a household, already a member of this one, was removed
-- from it, or the target row is already claimed). That was a deliberate simplification at the
-- time ("a preview that showed you can't join this... would need to duplicate accept_invite's
-- entire guard surface"), but it has a real cost: an INELIGIBLE token holder now reads "Join
-- Household B as Charlie?" -- a real household name and a real child's name -- and is only
-- turned away after pressing the button. The PRE-round-3 flow revealed nothing to an
-- ineligible caller (a single generic rejection, no names). Fix round 3 traded that away
-- without meaning to.
--
-- Fix: preview_invite() now runs the EXACT SAME eligibility checks accept_invite() does, via a
-- new shared helper, assert_invite_claimable(). Both RPCs call it with the invite row they've
-- already looked up (preview_invite via a plain SELECT; accept_invite via its existing
-- `for update` lock) plus the caller's uid; it raises the appropriate exception, or returns
-- normally if the caller is genuinely eligible. This is a real factoring, not a "keep these two
-- copies in sync by comment" promise -- there is exactly one place these checks are written,
-- so preview_invite and accept_invite CANNOT independently drift on what counts as eligible.
--
-- assert_invite_claimable() is intentionally NOT `security definer` and NOT granted execute to
-- `authenticated`: it only ever needs to run inside a caller that has ALREADY escalated (both
-- accept_invite and preview_invite are `security definer`, so a plain function call from
-- within them keeps that escalated context -- entering a NEW security definer function is what
-- changes privilege, not a plain function call). If it were ever invoked directly by a client
-- instead, it would run under RLS as the caller's own role and simply see incomplete/filtered
-- data -- a safe failure mode, not a privilege-escalation surface -- rather than becoming a
-- second independent entry point worth securing on its own.
--
-- What's genuinely shared vs. what stays separate: every check that decides "is this
-- token+caller combination claimable" -- token validity, same-household active/removed member,
-- any-household active member, and (for a claim invite) whether the target row is still
-- login-less and active -- moves into the helper. What does NOT move: accept_invite's advisory
-- lock (a per-CALLER TOCTOU guard that only matters when something is about to be WRITTEN --
-- preview_invite writes nothing, so it has no analogous race to close), the actual
-- INSERT/UPDATE, and the post-UPDATE null check that remains accept_invite's OWN backstop
-- against a genuinely concurrent claim of the SAME target row by a DIFFERENT caller (the
-- advisory lock only serializes repeat calls from the SAME uid, not two different callers
-- racing the same row -- assert_invite_claimable's check and the subsequent UPDATE are not
-- atomic with each other, so that backstop is still required, not redundant).
create function assert_invite_claimable(p_invite household_invites, p_uid uuid)
  returns void
  language plpgsql set search_path = public, pg_temp as $$
  begin
    if p_invite.id is null then
      raise exception 'invitation not found' using errcode = '22023';
    end if;
    if p_invite.accepted_at is not null then
      raise exception 'invitation already used' using errcode = '22023';
    end if;
    if p_invite.expires_at < now() then
      raise exception 'invitation expired' using errcode = '22023';
    end if;

    -- Active vs. removed, same household -- see 0013_accept_invite_removed_member_message.sql.
    if exists (
      select 1 from household_members
      where household_id = p_invite.household_id and user_id = p_uid and is_active
    ) then
      raise exception 'you are already a member of this household' using errcode = '22023';
    end if;

    if exists (
      select 1 from household_members
      where household_id = p_invite.household_id and user_id = p_uid and not is_active
    ) then
      raise exception 'you were removed from this household -- ask an owner or parent to restore your membership'
        using errcode = '22023';
    end if;

    -- Any OTHER household, active only -- see 0012_accept_invite_one_household_guard.sql.
    if exists (
      select 1 from household_members where user_id = p_uid and is_active
    ) then
      raise exception 'you already have a household' using errcode = '22023';
    end if;

    -- Claim path only: the target row must still be a login-less, active member of THIS
    -- household. A member_id from a DIFFERENT household (0012's cross-household guard,
    -- pgTAP-covered by supabase/tests/020_bootstrap.sql) is reported as 'invitation not found'
    -- -- the same message an unknown token gets -- rather than confirming a row with that id
    -- exists at all. A member_id in the RIGHT household that already has a user_id, or is
    -- inactive, is 'profile already claimed'.
    if p_invite.member_id is not null then
      if not exists (
        select 1 from household_members
        where id = p_invite.member_id and household_id = p_invite.household_id
      ) then
        raise exception 'invitation not found' using errcode = '22023';
      end if;

      if exists (
        select 1 from household_members
        where id = p_invite.member_id and household_id = p_invite.household_id
          and (user_id is not null or not is_active)
      ) then
        raise exception 'profile already claimed' using errcode = '22023';
      end if;
    end if;
  end;
  $$;

revoke execute on function assert_invite_claimable(household_invites, uuid) from public;

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

    perform assert_invite_claimable(v_invite, v_uid);

    select display_name into v_display_name from profiles where id = v_uid;

    if v_invite.member_id is not null then
      -- assert_invite_claimable() already confirmed this row belongs to the right household
      -- and is still login-less and active. The UPDATE's own WHERE clause (user_id is null and
      -- is_active) plus this null check remain the atomic test-and-set backstop against a
      -- genuinely concurrent claim of the SAME row by a DIFFERENT caller -- see this
      -- migration's header comment for why that race is not closed by the advisory lock above.
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

create or replace function preview_invite(p_token text)
  returns jsonb
  language plpgsql security definer set search_path = public, pg_temp, extensions as $$
  declare
    v_uid uuid := auth.uid();
    v_invite household_invites%rowtype;
    v_household_name text;
    v_member_name text;
  begin
    if v_uid is null then
      raise exception 'not authenticated' using errcode = '42501';
    end if;

    -- Read-only -- no `for update`, and deliberately no advisory lock (see this migration's
    -- header comment): nothing here is written, so there is no TOCTOU window to close.
    select * into v_invite from household_invites
    where token_hash = encode(digest(p_token, 'sha256'), 'hex');

    perform assert_invite_claimable(v_invite, v_uid);

    select name into v_household_name from households where id = v_invite.household_id;

    if v_invite.member_id is not null then
      select display_name into v_member_name
      from household_members
      where id = v_invite.member_id and household_id = v_invite.household_id;
    end if;

    return jsonb_build_object('household_name', v_household_name, 'member_display_name', v_member_name);
  end;
  $$;
