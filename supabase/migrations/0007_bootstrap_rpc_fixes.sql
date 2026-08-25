-- Task 6 fix round 1: two Important findings and several smaller ones
-- against 0006_bootstrap_rpc.sql, all inside handle_new_user(),
-- create_household(), and accept_invite(). 0006 has already been applied
-- and is not edited (migrations are append-only, same convention as
-- Task 5's fix rounds 0003-0005); each function is redefined here with
-- `create or replace function`, same signature, so callers and grants
-- (0006's revoke/grant execute) are unaffected.

-- ---------------------------------------------------------------------
-- I-1 (Important): profiles.display_name has no length cap, but
-- household_members.display_name is capped at 40
-- (household_members_display_name_check). handle_new_user copied
-- client-supplied metadata -- or the email local part -- into profiles
-- uncapped, and both RPCs then copied that value into household_members.
-- Anyone signing up with a display name or email local part over 40
-- characters got a profile and could then never create a household and
-- never accept an invite -- accept_invite is the only legitimate way in,
-- so that account was dead on arrival with a raw 23514 dumping the
-- failing row. Fixed at the source (capped with left(..., 40) here) and
-- defensively at both copy sites below, since profiles_update_self
-- (Task 5) lets a user edit their own display_name later with no length
-- constraint at all.
--
-- M-8: split_part(null, '@', 1) is null, so a null email (unreachable
-- today -- anonymous/SMS signup are both disabled in config.toml -- but
-- not guaranteed to stay that way) left display_name null and aborted
-- the whole auth.users insert, silently breaking all signups. A final
-- literal fallback guarantees a non-null, non-empty value regardless of
-- what metadata or email the caller supplies.
-- ---------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
  begin
    insert into profiles (id, display_name)
    values (
      new.id,
      left(
        coalesce(
          nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
          nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
          'Member'
        ),
        40
      )
    )
    on conflict (id) do nothing;
    return new;
  end;
  $$;

-- ---------------------------------------------------------------------
-- M-6 / M-7 (both inherited from the plan, not introduced by round 0):
-- p_name was only checked for emptiness, not the 1-80 bound
-- households.name itself enforces (households_name_check), so an
-- over-long name raised a raw 23514 with a row dump instead of a clean
-- 22023. p_timezone was not validated at all -- "Mars/Olympus_Mons"
-- stored fine and would feed garbage into Task 16+'s date math.
-- ---------------------------------------------------------------------
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

    -- Defensive re-cap (see handle_new_user's comment above): profiles.display_name
    -- can have grown past 40 characters since signup via profiles_update_self.
    insert into household_members (household_id, user_id, display_name, role)
    values (v_household_id, v_uid, left(v_display_name, 40), 'owner');

    insert into household_settings (household_id) values (v_household_id);

    return v_household_id;
  end;
  $$;

-- ---------------------------------------------------------------------
-- I-2 (Important): the claim UPDATE filtered on id and user_id is null
-- but not is_active. Claiming a deactivated row returned a member id and
-- marked the invite accepted, yet is_household_member()/household_role()
-- are both false/null for a deactivated row, so the user landed in an
-- empty app -- and now occupied the (household_id, user_id) unique slot,
-- silently blocking any other invite for that household too, with no
-- recovery path short of an admin. "and is_active" makes the claim fall
-- through to the same "profile already claimed" a truly-claimed row
-- produces.
--
-- M-3: the cross-household exists() check (added in round 0) read
-- without locking, then the UPDATE filtered only on id and user_id is
-- null -- a check-then-write. Repeating
-- "household_id = v_invite.household_id" on the UPDATE's own WHERE makes
-- the mismatch guard and the write one atomic statement, closing that
-- TOCTOU window.
--
-- M-4: the insert path was previously stopped only by
-- household_members_user_unique (0001_schema.sql's partial unique index
-- on (household_id, user_id) where user_id is not null) -- fails closed,
-- so not a hole, but the sole barrier was an implicit dependency on an
-- index defined in another migration and unmentioned here, the exact
-- pattern eliminated from the guard trigger in Task 5 round 3. Named
-- explicitly and checked up front for both the claim and insert paths,
-- with a clear message instead of a raw 23505.
-- ---------------------------------------------------------------------
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
      -- Defense in depth (round 0): household_invites.household_id and
      -- the household_id of the member row it targets are two
      -- independent columns with no DB constraint tying them together,
      -- and invites_insert_admins only checks that the caller
      -- administers the invite's OWN household_id -- not that member_id
      -- belongs to it. Reuses the generic "invitation not found" so a
      -- mismatch does not reveal that a member row exists elsewhere.
      if not exists (
        select 1 from household_members
        where id = v_invite.member_id and household_id = v_invite.household_id
      ) then
        raise exception 'invitation not found' using errcode = '22023';
      end if;

      -- Claim: attach this account to the existing row, preserving its
      -- history. Only user_id and role are written. household_id is
      -- repeated here (M-3) and is_active is added (I-2) -- see this
      -- migration's header comment.
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
      -- Defensive re-cap (see handle_new_user's comment above): profiles.display_name
      -- can have grown past 40 characters since signup via profiles_update_self.
      insert into household_members (household_id, user_id, display_name, role)
      values (v_invite.household_id, v_uid, left(coalesce(v_display_name, 'Member'), 40), v_invite.role)
      returning id into v_member_id;
    end if;

    update household_invites set accepted_at = now() where id = v_invite.id;
    return v_member_id;
  end;
  $$;
