import { getActiveMember, requireAccountMembership } from "@/lib/auth/active-member";
import { canInvite, canManageMembers, isAdminProfile } from "@/lib/auth/permissions";
import { createServerClient } from "@/lib/supabase/server";
import { MemberInviteList } from "@/components/settings/member-invite-list";
import { RemovedMemberList } from "@/components/settings/removed-member-list";

/**
 * Where the hybrid identity model pays off: a login-less member (a child who's used the app
 * for months, points and history intact) gets an "Invite them to log in" link that attaches a
 * real login to their EXISTING `household_members` row instead of creating a new one.
 *
 * Also the ONLY place a removed member becomes visible again (Task 15 addition): Task 13
 * shipped `deactivateMemberAction` with no counterpart, and Task 14's "you were removed --
 * ask an owner or parent to restore your membership" error was advice nobody could act on
 * without one. See app/(app)/settings/members/actions.ts's `reactivateMemberAction` doc
 * comment for the full rationale and why it lives here rather than app/(app)/family/actions.ts.
 *
 * Lives under `(app)/settings/` (Task 15 owns `/settings` proper -- no index page or nav entry
 * is added here, only this one page). `requireAccountMembership()` is safe here for the same
 * reason it is on `app/(app)/family/page.tsx`: `app/(app)/layout.tsx` already redirects any
 * account without a household to `/onboarding` before this page ever renders.
 */
export default async function SettingsMembersPage() {
  const account = await requireAccountMembership();
  const activeMember = await getActiveMember();
  const supabase = await createServerClient();

  // Two independent things, combined exactly as app/(app)/settings/household/page.tsx does:
  // `canManageMembers(account.role)` is the real boundary (the server actions re-check it
  // themselves), and `isAdminProfile(...)` covers the shared-device case where an admin's
  // session is currently attributed to a child. The settings index stopped LINKING here for a
  // non-admin profile, but this page was still reachable by typing the URL, and on a shared
  // tablet the person standing there is whoever the screen says they are.
  const viewingAsAdmin = isAdminProfile(activeMember?.role ?? account.role);
  const canManage = canManageMembers(account.role) && viewingAsAdmin;

  const { data: members } = await supabase
    .from("household_members")
    .select("id, display_name, role, color, avatar_url, user_id")
    .eq("household_id", account.household_id)
    .eq("is_active", true)
    .order("created_at");

  // Only an admin may even see who has been removed. This used to be the ONLY control: the
  // `members_select_household` RLS policy did not filter by `is_active`, so an inactive row was
  // as visible to a plain member's SELECT as an active one. Task 15 closed that at the database
  // (the policy now reads `is_active or household_role(...) in ('owner','parent')`), so the two
  // agree -- but keep this check anyway rather than leaning on RLS alone: the account underneath
  // a switched-to-child profile IS an admin as far as Postgres is concerned, so RLS would hand
  // these rows over quite correctly. Never lift this query above the check.
  const { data: removedMembers } = canManage
    ? await supabase
        .from("household_members")
        .select("id, display_name, role, color, avatar_url")
        .eq("household_id", account.household_id)
        .eq("is_active", false)
        .order("created_at")
    : { data: [] };

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl">Members</h1>
        <p className="mt-1 text-muted-foreground">
          Give a family member their own login without losing their points or history.
        </p>
      </header>
      {viewingAsAdmin ? null : (
        <p className="mb-8 rounded-[14px] bg-sunken px-4 py-3 text-sm text-muted-foreground">
          You’re viewing as {activeMember?.display_name ?? "this profile"}. Switch to an adult’s
          profile to invite or restore members.
        </p>
      )}
      <div className="flex flex-col gap-8">
        <MemberInviteList members={members ?? []} canInvite={canInvite(account.role) && viewingAsAdmin} />
        {canManage ? <RemovedMemberList members={removedMembers ?? []} /> : null}
      </div>
    </div>
  );
}
