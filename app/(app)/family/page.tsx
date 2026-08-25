import { requireAccountMembership } from "@/lib/auth/active-member";
import { canManageMembers } from "@/lib/auth/permissions";
import { createServerClient } from "@/lib/supabase/server";
import { MemberGrid } from "@/components/family/member-grid";

/**
 * The family roster -- every active member of the household. `requireAccountMembership()` is
 * safe here (rather than the nullable `getAccountMembership()`) because `app/(app)/layout.tsx`
 * already redirects to `/onboarding` for any account without a household before this page ever
 * renders; an absent membership at this point would be a bug, not a normal state to branch on.
 */
export default async function FamilyPage() {
  const account = await requireAccountMembership();
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
        <h1 className="text-3xl">Family</h1>
        <p className="mt-1 text-muted-foreground">Everyone in your household.</p>
      </header>
      <MemberGrid members={members ?? []} canManage={canManageMembers(account.role)} />
    </div>
  );
}
