import { requireAccountMembership } from "@/lib/auth/active-member";
import { canInvite, canManageMembers } from "@/lib/auth/permissions";
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
  const supabase = await createServerClient();
  const canManage = canManageMembers(account.role);

  const { data: members } = await supabase
    .from("household_members")
    .select("id, display_name, role, color, avatar_url, user_id")
    .eq("household_id", account.household_id)
    .eq("is_active", true)
    .order("created_at");

  // Only an admin may even see who has been removed. `household_members`'s own
  // `members_select_household` RLS policy does NOT filter by `is_active` or by admin status --
  // an inactive row is just as visible to a plain member's SELECT as an active one -- so this
  // `canManage` check is the ONLY thing standing between a removed member's continued
  // existence and a non-admin viewer of this page. Never lift this query above that check.
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
      <div className="flex flex-col gap-8">
        <MemberInviteList members={members ?? []} canInvite={canInvite(account.role)} />
        {canManage ? <RemovedMemberList members={removedMembers ?? []} /> : null}
      </div>
    </div>
  );
}
