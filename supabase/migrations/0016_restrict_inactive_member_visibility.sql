-- Task 15 fix round 1, Finding 1: the app hid removed members from a non-admin
-- (app/(app)/settings/members/page.tsx gates the removed-members QUERY itself on
-- canManageMembers, and every other read of household_members already filters
-- `is_active = true`), but the database never agreed with that intent. `members_select_household`
-- (0002_rls.sql) has always been `using (is_household_member(household_id))` -- it does not, and
-- never has, filtered by `is_active` or by the CALLER's own role. Any authenticated member of a
-- household -- a teen, a child with a login -- could query
--   select * from household_members where household_id = :mine and is_active = false
-- directly through PostgREST with their own session (no service_role key, no RPC, just the
-- ordinary anon-key client this app already ships) and read the display name of everyone an
-- owner/parent has removed. The mutation path (flipping is_active back on) was already correctly
-- blocked by the guard trigger for a non-admin -- this closes the READ side to match.
--
-- This project has ruled twice already that an app-level gate is not sufficient on its own:
-- Task 12 (service_role's standing grants) and Task 14 (preview_invite's eligibility check,
-- 0015_shared_invite_eligibility_check.sql) both moved the real control down to where a client
-- could reach it directly. Leaving this one app-only would be an arbitrary exception to that
-- rule, not a principled one -- the sensitivity here is low (a name, within your own household,
-- probably already known to a teen), but the code already treats "who has been removed" as
-- admin-only information, so the database should say so too.
--
-- Fix: a non-admin's SELECT is restricted to active rows; an owner/parent keeps seeing
-- everything (active and inactive) in their own household, since managing removed members is
-- exactly what they need this table for. `household_role(household_id)` already resolves to
-- NULL for a caller with no active membership in that household at all (see its own definition,
-- 0002_rls.sql), and `is_household_member(household_id)` -- unchanged, still the first clause --
-- already excludes such a caller before the is_active/role clause is ever evaluated, so there is
-- no analogous "NULL not in (...) is NULL, not TRUE" fail-open gap here the way there was in the
-- guard trigger before 0005 (that fix does not need repeating: this is an RLS `using` clause
-- evaluated per-row for an ALREADY-a-member caller, not a boolean the trigger has to coalesce).
--
-- Verified before writing this migration (see this task's report) that every existing read of
-- `household_members` still gets everything it needs: the ordinary family roster
-- (app/(app)/family/page.tsx), the profile switcher (app/switch/page.tsx), and the active-member
-- lookups in lib/auth/active-member.ts all already filter `is_active = true` in the query itself
-- regardless of caller role, so they are unaffected either way. app/(app)/settings/members/page.tsx's
-- admin-only removed-members query needs exactly the rows this policy now grants an owner/parent.
-- app/(app)/family/[memberId]/page.tsx has no is_active filter of its own -- a non-admin visiting
-- a removed member's profile page directly by a known/guessed id now gets nothing back (falls
-- through to notFound()) instead of the row, which is a disclosure fix, not a regression: nothing
-- in the app ever links to that URL for a removed member.
drop policy members_select_household on household_members;
create policy members_select_household on household_members for select to authenticated
  using (
    is_household_member(household_id)
    and (is_active or household_role(household_id) in ('owner', 'parent'))
  );
