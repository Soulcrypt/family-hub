-- pgTAP is required to run supabase/tests/*.sql via `supabase test db`.
-- It is not installed by default on a fresh local/remote database, so it is
-- enabled here (in a real migration) rather than relying on any transient
-- installation the test runner might perform for the duration of a single
-- test transaction.
create extension if not exists pgtap with schema extensions;

-- SECURITY DEFINER bypasses RLS internally, which is what prevents the
-- infinite recursion a plain subquery would cause in a policy ON household_members.
create function is_household_member(hid uuid) returns boolean
  language sql security definer stable set search_path = public, pg_temp as $$
    select exists (
      select 1 from household_members
      where household_id = hid and user_id = auth.uid() and is_active
    );
  $$;

create function household_role(hid uuid) returns member_role
  language sql security definer stable set search_path = public, pg_temp as $$
    select role from household_members
    where household_id = hid and user_id = auth.uid() and is_active
    limit 1;
  $$;

revoke execute on function is_household_member(uuid) from public;
revoke execute on function household_role(uuid)      from public;
grant  execute on function is_household_member(uuid) to authenticated;
grant  execute on function household_role(uuid)      to authenticated;

-- profiles
create policy profiles_select_self_and_household on profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from household_members m
      where m.user_id = profiles.id and is_household_member(m.household_id)
    )
  );
create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- households
create policy households_select_members on households for select to authenticated
  using (is_household_member(id));
create policy households_update_admins on households for update to authenticated
  using (household_role(id) in ('owner', 'parent'))
  with check (household_role(id) in ('owner', 'parent'));
create policy households_delete_owner on households for delete to authenticated
  using (household_role(id) = 'owner');

-- household_members
create policy members_select_household on household_members for select to authenticated
  using (is_household_member(household_id));
create policy members_insert_admins on household_members for insert to authenticated
  with check (household_role(household_id) in ('owner', 'parent'));
create policy members_update_admins on household_members for update to authenticated
  using (household_role(household_id) in ('owner', 'parent'))
  with check (household_role(household_id) in ('owner', 'parent'));
create policy members_update_self on household_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy members_delete_admins on household_members for delete to authenticated
  using (household_role(household_id) in ('owner', 'parent'));

-- household_invites
create policy invites_select_admins on household_invites for select to authenticated
  using (household_role(household_id) in ('owner', 'parent'));
create policy invites_insert_admins on household_invites for insert to authenticated
  with check (household_role(household_id) in ('owner', 'parent'));
create policy invites_delete_admins on household_invites for delete to authenticated
  using (household_role(household_id) in ('owner', 'parent'));

-- household_settings
create policy settings_select_members on household_settings for select to authenticated
  using (is_household_member(household_id));
create policy settings_update_admins on household_settings for update to authenticated
  using (household_role(household_id) in ('owner', 'parent'))
  with check (household_role(household_id) in ('owner', 'parent'));

-- Table-level GRANTs to `authenticated`.
--
-- RLS only filters rows that a role is otherwise allowed to touch: it does
-- not, by itself, grant table access. This project's local Postgres config
-- does not auto-expose newly created public-schema tables to the Data API
-- roles (see supabase/config.toml, `auto_expose_new_tables`), so without
-- these explicit GRANTs every query below would fail with "permission
-- denied for table ..." before RLS is ever evaluated.
--
-- Each grant is scoped to exactly the operations that have a matching
-- policy above, mirroring the deliberate omissions (no INSERT on
-- households/household_settings; no UPDATE on household_invites).
grant select, update              on profiles           to authenticated;
grant select, update, delete      on households          to authenticated;
grant select, insert, update, delete on household_members   to authenticated;
grant select, insert, delete      on household_invites   to authenticated;
grant select, update              on household_settings  to authenticated;
