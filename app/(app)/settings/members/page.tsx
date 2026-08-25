import { requireAccountMembership } from "@/lib/auth/active-member";
import { canInvite } from "@/lib/auth/permissions";
import { createServerClient } from "@/lib/supabase/server";
import { MemberInviteList } from "@/components/settings/member-invite-list";

/**
 * Where the hybrid identity model pays off: a login-less member (a child who's used the app
 * for months, points and history intact) gets an "Invite them to log in" link that attaches a
 * real login to their EXISTING `household_members` row instead of creating a new one.
 *
 * Lives under `(app)/settings/` (Task 15 owns `/settings` proper -- no index page or nav entry
 * is added here, only this one page). `requireAccountMembership()` is safe here for the same
 * reason it is on `app/(app)/family/page.tsx`: `app/(app)/layout.tsx` already redirects any
 * account without a household to `/onboarding` before this page ever renders.
 */
export default async function SettingsMembersPage() {
  const account = await requireAccountMembership();
  const supabase = await createServerClient();

  const { data: members } = await supabase
    .from("household_members")
    .select("id, display_name, role, color, avatar_url, user_id")
    .eq("household_id", account.household_id)
    .eq("is_active", true)
    .order("created_at");

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl">Members</h1>
        <p className="mt-1 text-muted-foreground">
          Give a family member their own login without losing their points or history.
        </p>
      </header>
      <MemberInviteList members={members ?? []} canInvite={canInvite(account.role)} />
    </div>
  );
}
