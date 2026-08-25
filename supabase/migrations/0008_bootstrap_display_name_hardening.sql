-- Task 6 fix round 2: I-1 was only partially closed in 0007. The two
-- defensive copy sites (create_household's owner insert,
-- accept_invite's new-member insert) capped with a bare
-- left(v_display_name, 40). profiles.display_name has no CHECK of its
-- own (only NOT NULL), and profiles_update_self lets any authenticated
-- user set it to anything, including 45 spaces -- an entirely ordinary
-- self-edit. left(...) truncates 45 spaces to 40 spaces, and
-- length(trim(...)) of that is 0, which violates the LOWER bound of
-- household_members_display_name_check -- the same permanent lockout as
-- the original over-length bug (accept_invite is the only legitimate way
-- into a household), entered through a different door.
--
-- Two fixes, both requested and both applied:
--
-- Fix 1: make both copy sites total -- truncate, then re-trim, then fall
-- back to 'Member' if that leaves nothing. Both functions are redefined
-- here with `create or replace function`, same signatures, so callers
-- and 0006's grants are unaffected (0006 and 0007 have already been
-- applied and are not edited).
--
-- Fix 2: the root cause is that a column feeding a constrained column
-- (household_members.display_name) has no constraint of its own. Adds
-- `check (length(trim(display_name)) between 1 and 80)` to
-- profiles.display_name, matching the bound households.name already
-- enforces on itself.
--
-- The two bounds (profiles: 80, household_members: 40) differ
-- deliberately, which is exactly why fix 1's truncation still has to
-- exist even with fix 2's CHECK in place: a name can satisfy
-- profiles' 80-character bound as a WHOLE (e.g. 40 spaces followed by
-- real content) while its first 40 characters -- exactly what the copy
-- sites take via left(..., 40) -- are still all whitespace. Fix 2 closes
-- off the *purely* whitespace case (no longer constructible via any
-- UPDATE at all, self-edit or otherwise, once the CHECK exists); fix 1
-- closes the case fix 2 cannot reach.

-- ---------------------------------------------------------------------
-- Fix 2, verified safe before being applied (see the commit report for
-- the full verification): every path that can write profiles.display_name
-- already produces a value that satisfies
-- length(trim(display_name)) between 1 and 80:
--   * handle_new_user (0007): the stored value is
--     left(coalesce(nullif(trim(meta_name), ''), nullif(split_part(email, '@', 1), ''), 'Member'), 40).
--     The chosen candidate is always non-empty *before* truncation (the
--     meta_name branch is pre-trimmed by its own nullif(trim(...), ''),
--     and the final fallback is the literal 'Member') and is never
--     leading-whitespace (trim() already strips leading whitespace from
--     the meta_name branch; the email-local-part and 'Member' branches
--     cannot start with whitespace either), so left(..., 40) can never
--     produce an entirely-whitespace prefix here -- unlike the general
--     profiles.display_name case this CHECK now also has to cover,
--     handle_new_user's own output was never the vector for the residual
--     bug. length <= 40 <= 80 trivially satisfies the upper bound.
--   * profiles_update_self (Task 5): any authenticated user can set their
--     own display_name to anything NOT NULL today; this migration is what
--     first constrains it, and no fixture, seed, or test row currently
--     violates the new bound (profiles rows are created only by
--     handle_new_user, which always satisfies it as above; this ALTER
--     TABLE runs before any test file's data exists in a fresh
--     `db reset`, so there is nothing pre-existing to validate against).
-- ---------------------------------------------------------------------
alter table profiles add check (length(trim(display_name)) between 1 and 80);

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

    -- Fix 1: truncate, then re-trim, then fall back -- a bare
    -- left(v_display_name, 40) could still land on an all-whitespace
    -- prefix even once profiles.display_name is CHECK-constrained (see
    -- this migration's header comment for why).
    insert into household_members (household_id, user_id, display_name, role)
    values (v_household_id, v_uid, coalesce(nullif(trim(left(v_display_name, 40)), ''), 'Member'), 'owner');

    insert into household_settings (household_id) values (v_household_id);

    return v_household_id;
  end;
  $$;

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

    if exists (
      select 1 from household_members
      where household_id = v_invite.household_id and user_id = v_uid
    ) then
      raise exception 'you are already a member of this household' using errcode = '22023';
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
      -- Fix 1: truncate, then re-trim, then fall back -- see
      -- create_household's copy above and this migration's header
      -- comment.
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
