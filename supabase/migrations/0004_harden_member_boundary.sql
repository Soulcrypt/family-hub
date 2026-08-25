-- Task 5 fix round 2: a `child` with their own session and the public
-- anon key can, via `members_update_self`, self-promote to `owner`,
-- inflate their own `points_balance`, and (per fix 2 below) rewrite their
-- own `household_id`. Postgres RLS cannot restrict *which columns* an
-- UPDATE touches -- USING/WITH CHECK only ever gate whole rows -- so
-- "self can only ever touch their own row" (0002_rls.sql's stated
-- rationale for `members_update_self` having no column restriction) does
-- not protect the dangerous columns living on that same row. Column-level
-- protection needs a trigger, which is what fix 1 adds.
--
-- Fixes 1-4 hold two households the client-facing roles must never be
-- able to cross or subvert from *inside* a household they legitimately
-- belong to. Fix 5 removes pgTAP from the production migration path.

-- ---------------------------------------------------------------------
-- Fix 1 (Critical): stop self-service privilege escalation.
--
-- `role`, `points_balance`, `is_active`, and `household_id` may only be
-- changed by an owner/parent of the row's (pre-update) household.
-- `pin_hash` is deliberately left out of the guarded set: a member sets
-- their own PIN (Task 13), and that is not a privilege-bearing column --
-- knowing your own PIN hash grants no access beyond what the row already
-- allows.
-- ---------------------------------------------------------------------
create function guard_household_members_admin_columns() returns trigger
  language plpgsql set search_path = public, pg_temp as $$
  begin
    if (new.role is distinct from old.role
        or new.points_balance is distinct from old.points_balance
        or new.is_active is distinct from old.is_active
        or new.household_id is distinct from old.household_id)
       and household_role(old.household_id) not in ('owner', 'parent')
    then
      raise exception
        'only an owner or parent may change role, points_balance, is_active, or household_id'
        using errcode = '42501';
    end if;
    return new;
  end;
  $$;

create trigger household_members_guard_admin_columns
  before update on household_members
  for each row
  execute function guard_household_members_admin_columns();

-- ---------------------------------------------------------------------
-- Fix 2 (Important): make cross-household containment explicit on
-- members_update_self, rather than relying on it as an unwritten side
-- effect of members_select_household being applied to the updated row
-- (which would silently stop holding if that SELECT policy is ever
-- widened in a later task).
-- ---------------------------------------------------------------------
drop policy members_update_self on household_members;
create policy members_update_self on household_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_household_member(household_id));

-- ---------------------------------------------------------------------
-- Fix 3 (Important): profile visibility must not survive removal from a
-- household. The subquery checked the *caller's* is_active (via
-- is_household_member) but never the *subject member row's* -- so a
-- profile stayed visible to former household-mates forever, including
-- edits made after the subject left.
-- ---------------------------------------------------------------------
drop policy profiles_select_self_and_household on profiles;
create policy profiles_select_self_and_household on profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from household_members m
      where m.user_id = profiles.id and m.is_active and is_household_member(m.household_id)
    )
  );

-- ---------------------------------------------------------------------
-- Fix 4 (Important): members_insert_admins must not accept an arbitrary
-- user_id. Without this, an owner/parent could insert
-- (household_id = mine, user_id = <any known uid>) and immediately read
-- that stranger's profile via profiles_select_self_and_household, with
-- the victim's own client then showing a household they never joined.
--
-- This is safe to tighten to user_id is null: admins only ever add
-- login-less members this way (a child with no account). A real
-- (user_id-attached) membership is only ever created by Task 6's
-- accept_invite(token) RPC, which is SECURITY DEFINER, bypasses RLS
-- entirely, and validates the token itself -- it does not go through
-- this policy at all, so tightening this WITH CHECK cannot break it.
-- ---------------------------------------------------------------------
drop policy members_insert_admins on household_members;
create policy members_insert_admins on household_members for insert to authenticated
  with check (household_role(household_id) in ('owner', 'parent') and user_id is null);

-- ---------------------------------------------------------------------
-- Fix 5 (Important): pgTAP does not belong in the production migration
-- path. 0002_rls.sql:6 installed it (needed locally to run
-- supabase/tests/*.sql via `supabase test db`), which ships ~1000
-- functions into the `extensions` schema -- a schema in PostgREST's
-- extra_search_path -- with EXECUTE granted to PUBLIC by Postgres'
-- default function privileges (i.e. to anon and authenticated too), and
-- these migrations are what deploys to production in Task 21.
--
-- 0002_rls.sql has already been applied and is not edited (migrations
-- are append-only); this migration removes what it installed. pgTAP is
-- re-enabled for local testing only via supabase/seed.sql, which runs
-- during `supabase db reset` but is never part of `supabase db push` /
-- the migration history that reaches a deployed project.
-- ---------------------------------------------------------------------
drop extension if exists pgtap;
