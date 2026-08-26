-- Design-Spec §8.1: "Widget system: per-member layout stored as jsonb." This is the dashboard
-- rebuild's own layout table -- which widgets a given household_members row has on its
-- dashboard, and in what order, edited through the "Edit widgets" flow (remove badges, "+ Add"
-- drawer, keyboard reorder). One row per member, not per authenticated account: the household
-- runs on a shared kiosk tablet where the attributed member (fh_active_member, see
-- lib/auth/active-member.ts) can be a login-less child, so the layout has to key off the
-- member row everyone already agrees is "who this screen is for" -- never off auth.uid(),
-- which a member like Ivy does not have.
--
-- household_id is denormalized onto this table (rather than joined through member_id) purely
-- so `is_household_member(household_id)` -- the same SECURITY DEFINER helper every other
-- policy in this schema uses -- can scope access here directly, without every policy needing a
-- correlated subquery into household_members. The insert/update checks below independently
-- verify member_id actually belongs to that household_id, so the denormalization can never
-- drift into "household_id lies about which household owns this row."
create table member_dashboard_layouts (
  member_id    uuid primary key references household_members(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  widgets      jsonb not null default '["schedule","dinner","weather","photos","news"]'::jsonb,
  updated_at   timestamptz not null default now()
);

create index member_dashboard_layouts_household_idx on member_dashboard_layouts (household_id);

-- The widget catalogue lives in TypeScript (lib/constants/features.ts's DEFAULT_WIDGETS) and
-- is genuinely small and fixed for this build (schedule/dinner/weather/photos/news) -- there
-- is no admin UI that invents new widget keys, so hardcoding the same five here is validating
-- against reality, not duplicating a value that is expected to change often. A jsonb CHECK
-- constraint cannot express "every element of this array is one of five strings, and none
-- repeat" (Postgres disallows sub-SELECTs, including ones over set-returning functions like
-- jsonb_array_elements_text, inside a CHECK expression -- see 0017_household_timezone_guard.sql's
-- identical reasoning for why that migration used a trigger instead of a CHECK), so this is a
-- BEFORE INSERT OR UPDATE trigger, same shape as guard_household_timezone().
create function guard_dashboard_widget_layout() returns trigger
  language plpgsql set search_path = public, pg_temp as $$
  declare
    v_key text;
    v_seen text[] := '{}';
  begin
    if jsonb_typeof(new.widgets) is distinct from 'array' then
      raise exception 'widgets must be a jsonb array' using errcode = '22023';
    end if;

    for v_key in select jsonb_array_elements_text(new.widgets) loop
      if v_key not in ('schedule', 'dinner', 'weather', 'photos', 'news') then
        raise exception 'unknown widget key: %', v_key using errcode = '22023';
      end if;
      if v_key = any(v_seen) then
        raise exception 'duplicate widget key: %', v_key using errcode = '22023';
      end if;
      v_seen := array_append(v_seen, v_key);
    end loop;

    return new;
  end;
  $$;

create trigger dashboard_widget_layout_guard
  before insert or update of widgets on member_dashboard_layouts
  for each row execute function guard_dashboard_widget_layout();

alter table member_dashboard_layouts enable row level security;

-- Read: any active member of the household (matches settings_select_members's scoping in
-- 0002_rls.sql) -- a household's whole point is that everyone in it can see how everyone
-- else's dashboard is laid out, the same way they can already see each other's names/colors.
create policy dashboard_layouts_select_household on member_dashboard_layouts for select to authenticated
  using (is_household_member(household_id));

-- Write: deliberately NOT restricted to admins (unlike household_settings_update_admins) or to
-- "your own row" (unlike members_update_self) -- a kid or a login-less toddler cannot open an
-- edit-widgets drawer for themselves, so any signed-in member of the SAME household must be
-- able to rearrange any member's layout, exactly like the kiosk itself already lets a parent
-- act on behalf of whoever the tablet is currently attributed to. The `exists` clause is what
-- stops the denormalized household_id from lying: it must name the household member_id ACTUALLY
-- belongs to, not an arbitrary household the caller happens to also be in.
create policy dashboard_layouts_insert_household on member_dashboard_layouts for insert to authenticated
  with check (
    is_household_member(household_id)
    and exists (
      select 1 from household_members m
      where m.id = member_dashboard_layouts.member_id and m.household_id = member_dashboard_layouts.household_id
    )
  );

create policy dashboard_layouts_update_household on member_dashboard_layouts for update to authenticated
  using (is_household_member(household_id))
  with check (
    is_household_member(household_id)
    and exists (
      select 1 from household_members m
      where m.id = member_dashboard_layouts.member_id and m.household_id = member_dashboard_layouts.household_id
    )
  );

create policy dashboard_layouts_delete_household on member_dashboard_layouts for delete to authenticated
  using (is_household_member(household_id));

-- auto_expose_new_tables is off locally (see 0002_rls.sql's identical comment) -- without this
-- GRANT, every query above 403s on "permission denied for table" before RLS is ever evaluated.
grant select, insert, update, delete on member_dashboard_layouts to authenticated;
