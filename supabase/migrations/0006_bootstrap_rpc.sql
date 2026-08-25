-- Task 6: bootstrap RPCs and profile trigger.
--
-- create_household and accept_invite both solve the same problem: a user
-- must create the very household_members row that RLS policies require
-- them to already have. Both are SECURITY DEFINER, so they bypass RLS
-- entirely and must perform every authorization check themselves.
--
-- Both functions are created here (running as this migration's role,
-- `postgres`, this project's table owner) so they are owned by `postgres`
-- and therefore execute with current_user = 'postgres'. That is exactly
-- what 0005_trigger_fail_closed_and_freeze_identity.sql's
-- guard_household_members_admin_columns() trigger checks to exempt
-- trusted server-side callers from its column freeze -- see that
-- migration's comment for the full reasoning. accept_invite's claim path
-- (UPDATE household_members set user_id = ..., role = ...) is exactly the
-- kind of write that trigger would otherwise block for a caller who is
-- not yet a member of the row's household; the exemption is what makes it
-- possible, and no extra bypass code is needed here beyond being a
-- postgres-owned SECURITY DEFINER function.
--
-- Being exempt means the trigger's protection is fully off inside these
-- functions, not just for the columns they mean to touch -- so each
-- writes only the columns its own claim genuinely requires.

create extension if not exists pgcrypto with schema extensions;

-- Profiles are created by trigger, never by the client, so profiles needs
-- no INSERT policy.
create function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
  begin
    insert into profiles (id, display_name)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1))
    )
    on conflict (id) do nothing;
    return new;
  end;
  $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Bootstrap 1: creating a household requires a membership that cannot
-- exist yet.
create function create_household(p_name text, p_timezone text default 'UTC')
  returns uuid
  language plpgsql security definer set search_path = public, pg_temp as $$
  declare
    v_uid uuid := auth.uid();
    v_household_id uuid;
    v_display_name text;
  begin
    if v_uid is null then
      raise exception 'not authenticated' using errcode = '42501';
    end if;
    if length(trim(coalesce(p_name, ''))) = 0 then
      raise exception 'household name is required' using errcode = '22023';
    end if;

    select display_name into v_display_name from profiles where id = v_uid;
    if v_display_name is null then
      raise exception 'profile missing' using errcode = '42501';
    end if;

    insert into households (name, timezone, created_by)
    values (trim(p_name), coalesce(nullif(trim(p_timezone), ''), 'UTC'), v_uid)
    returning id into v_household_id;

    insert into household_members (household_id, user_id, display_name, role)
    values (v_household_id, v_uid, v_display_name, 'owner');

    insert into household_settings (household_id) values (v_household_id);

    return v_household_id;
  end;
  $$;

-- Bootstrap 2: the accepting user is not yet a member, so satisfies no
-- policy. Two distinct, non-symmetric cases:
--   member_id is null      -> insert a new member row for this user.
--   member_id is not null  -> claim: attach this account to the existing
--                              row, preserving its history (points_balance
--                              etc). This is the login-less-child-gets-a-
--                              login path, so only user_id and role are
--                              ever written on the claimed row -- nothing
--                              else on it is touched.
create function accept_invite(p_token text)
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

    select display_name into v_display_name from profiles where id = v_uid;

    if v_invite.member_id is not null then
      -- Defense in depth: household_invites.household_id and the
      -- household_id of the member row it targets are two independent
      -- columns with no DB constraint tying them together, and
      -- invites_insert_admins only checks that the caller administers the
      -- invite's OWN household_id -- not that member_id belongs to it.
      -- Without this check, an owner/parent of ANY household could craft
      -- an invite whose household_id is their own (so it passes that
      -- policy) but whose member_id points at a login-less row in a
      -- household they do NOT administer, with a role of their own
      -- choosing -- letting whoever accepts it claim membership, at a
      -- self-chosen privilege level, in a household that never consented.
      -- Reuses the generic "invitation not found" so a mismatch does not
      -- reveal that a member row exists elsewhere.
      if not exists (
        select 1 from household_members
        where id = v_invite.member_id and household_id = v_invite.household_id
      ) then
        raise exception 'invitation not found' using errcode = '22023';
      end if;

      -- Claim: attach this account to the existing row, preserving its
      -- history. Only user_id and role are written.
      update household_members
      set user_id = v_uid, role = v_invite.role
      where id = v_invite.member_id and user_id is null
      returning id into v_member_id;

      if v_member_id is null then
        raise exception 'profile already claimed' using errcode = '22023';
      end if;
    else
      insert into household_members (household_id, user_id, display_name, role)
      values (v_invite.household_id, v_uid, coalesce(v_display_name, 'Member'), v_invite.role)
      returning id into v_member_id;
    end if;

    update household_invites set accepted_at = now() where id = v_invite.id;
    return v_member_id;
  end;
  $$;

revoke execute on function create_household(text, text) from public;
revoke execute on function accept_invite(text)          from public;
grant  execute on function create_household(text, text) to authenticated;
grant  execute on function accept_invite(text)          to authenticated;
