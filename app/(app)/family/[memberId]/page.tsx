import { notFound } from "next/navigation";
import { requireAccountMembership } from "@/lib/auth/active-member";
import { canManageMembers } from "@/lib/auth/permissions";
import { createServerClient } from "@/lib/supabase/server";
import { MemberForm } from "@/components/family/member-form";

/**
 * A single member's profile -- editable by an admin (any field) or by the member themselves
 * (name/color only), read-only for anyone else. See MemberForm for how those three cases
 * render, and app/(app)/family/actions.ts's updateMemberAction for the matching server-side
 * enforcement -- the UI here must never offer a control the server would reject.
 */
export default async function MemberDetailPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const account = await requireAccountMembership();
  const supabase = await createServerClient();

  const { data: member } = await supabase
    .from("household_members")
    .select("id, display_name, role, color, avatar_url, birthday, points_balance")
    .eq("id", memberId)
    .eq("household_id", account.household_id)
    .maybeSingle();

  if (!member) notFound();

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-10">
      <MemberForm member={member} canManage={canManageMembers(account.role)} isSelf={account.id === member.id} />
    </div>
  );
}
