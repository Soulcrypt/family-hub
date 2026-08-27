import { requireAccountMembership, getActiveMember } from "@/lib/auth/active-member";
import { canManageMembers, isAdminProfile } from "@/lib/auth/permissions";
import { createServerClient } from "@/lib/supabase/server";
import { MemberGrid } from "@/components/family/member-grid";

/**
 * The family roster -- every active member of the household. `requireAccountMembership()` is
 * safe here (rather than the nullable `getAccountMembership()`) because `app/(app)/layout.tsx`
 * already redirects to `/onboarding` for any account without a household before this page ever
 * renders; an absent membership at this point would be a bug, not a normal state to branch on.
 *
 * `canManage` (which gates "Add a family member" -- see MemberGrid's doc comment) combines two
 * things, on purpose, mirroring app/(app)/settings/household/page.tsx's `canEdit` derivation:
 *  - `canManageMembers(account.role)` -- the AUTHENTICATED account's real authority. This is
 *    the actual security boundary; `addMemberAction` (app/(app)/family/actions.ts) re-checks
 *    it independently regardless of what this page renders.
 *  - `isAdminProfile(activeMember?.role ?? account.role)` -- a display-only nicety for the
 *    "shared device switched to a non-admin profile" case (lib/auth/active-member.ts): a
 *    household switched to a child's profile must not be OFFERED a control it will only be
 *    told "no" after tapping into (SP1 Foundation design review, Finding 1).
 * See lib/auth/permissions.ts's `isAdminProfile` doc comment for why these stay separate
 * checks rather than one.
 */
export default async function FamilyPage() {
  const account = await requireAccountMembership();
  const activeMember = await getActiveMember();
  const supabase = await createServerClient();

  const { data: members } = await supabase
    .from("household_members")
    .select("id, display_name, role, color, avatar_url, birthday, points_balance")
    .eq("household_id", account.household_id)
    .eq("is_active", true)
    .order("created_at");

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-[30px] font-bold tracking-[-0.02em] text-text">Family</h1>
        <p className="mt-1 text-[14px] text-text-secondary">Everyone in your household.</p>
      </header>
      <MemberGrid
        members={members ?? []}
        canManage={canManageMembers(account.role) && isAdminProfile(activeMember?.role ?? account.role)}
      />
    </div>
  );
}
