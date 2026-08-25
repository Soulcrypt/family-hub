-- Task 14 fix round 1: accept_invite() must itself enforce SP1's one-household-per-account
-- assumption, not rely on any application-layer page to do it.
--
-- app/invite/[token]/page.tsx (Task 14) added a check before calling this RPC: if the
-- signed-in caller already has ANY active household membership, refuse before ever calling
-- accept_invite. That does not close the gap -- accept_invite(text) is GRANT EXECUTE'd to
-- `authenticated` (0006_bootstrap_rpc.sql) and callable directly via the anon key and the
-- caller's own session, with no dependency on that page or any other application code ever
-- running. Confirmed live: an account that already owned household A called
-- accept_invite() directly for a claim invite targeting a login-less child in an unrelated
-- household B, and it succeeded -- the child's row came back attached to the attacker's own
-- uid.
--
-- Two consequences, both serious:
--   1. Cross-household data/identity access. The attacker now holds an ACTIVE membership in
--      B, with every RLS grant a member of B gets -- including that child's points and
--      history. The spec's hardest requirement is that an account must never reach another
--      household's data; this let it happen through the front door.
--   2. The attacker's OWN account breaks. Two active household_members rows for the same
--      user_id make lookupAccountMembership()'s .maybeSingle() (lib/auth/active-member.ts)
--      return PGRST116, which that module's own comments call an unrecoverable
--      MultipleHouseholdMembershipsError -- every subsequent authority-gated request fails,
--      for that account, everywhere.
--
-- The root cause: accept_invite's existing "already a member" check
-- (0006/0007/0008, unchanged below) is scoped to `household_id = v_invite.household_id` --
-- ONLY the invite's own household. It says nothing about whether the caller already belongs
-- to a DIFFERENT one. This migration adds exactly that: a second check, scoped to the
-- caller's uid across ALL households, mirroring create_household's own one-household guard
-- (0010_create_household_toctou_guard.sql) both in shape and in wording ("you already have a
-- household") -- both entry points into a household now enforce the same rule in the same
-- place, the database.
--
-- Placement matters, same reasoning as 0010's header comment: the existing per-household
-- check above is left completely unchanged (same query, same message, same position) so
-- 020_bootstrap.sql's existing assertion of it ('you are already a member of this household')
-- keeps passing unmodified -- this migration only ADDS a second, broader check, and only
-- after the narrow one, so a same-household match still gets the narrower, more specific
-- message it always has.
--
-- Deliberately NOT scoped by is_active on the query used for that narrower, pre-existing
-- check (unchanged from Task 6) -- but the NEW check below explicitly IS is_active-scoped,
-- same as create_household's: a previously-removed member (household_members.is_active =
-- false) must still be able to accept a fresh invite elsewhere. Locking out someone who no
-- longer has a real membership anywhere would be its own defect, not a security fix -- an
-- inactive row is exactly the "you don't currently belong anywhere" state this whole guard
-- exists to distinguish FROM.
--
-- The advisory lock closes the same TOCTOU race 0010 closes for create_household: two
-- concurrent accept_invite calls from the SAME account (two tabs, two different invite links
-- opened at once) must not both read "no active membership yet" before either commits. Taken
-- immediately after the authentication check, before ANY read this function's decisions
-- depend on -- including the invite row lookup itself -- exactly 0010's placement rule,
-- applied here for the first time to this function.
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

    -- Must happen before any read this function's decisions depend on -- see this
    -- migration's header comment, and 0010_create_household_toctou_guard.sql's identical
    -- rule for create_household.
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

    -- Unchanged from Task 6 (0006/0007/0008): scoped to the invite's OWN household only.
    if exists (
      select 1 from household_members
      where household_id = v_invite.household_id and user_id = v_uid
    ) then
      raise exception 'you are already a member of this household' using errcode = '22023';
    end if;

    -- NEW: scoped to ANY household, ACTIVE memberships only. See this migration's header
    -- comment for why this is required (closes the cross-household takeover this migration
    -- fixes) and why is_active matters (a previously-removed member must not be locked out).
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
