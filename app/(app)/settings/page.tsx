import { requireAccountMembership, getActiveMember } from "@/lib/auth/active-member";
import { canInvite, canManageMembers, isAdminProfile, requiresPin } from "@/lib/auth/permissions";
import { createServerClient } from "@/lib/supabase/server";
import { FamilyRoster, type RemovedRosterMember, type RosterMember } from "@/components/settings/family-roster";
import { SetPinForm } from "@/components/settings/set-pin-form";

/**
 * The Family section of Settings (mock 4h, Design-Spec §8.10) — now the default `/settings`
 * pane. Replaces the old index-of-cards page (Household/Appearance/Members) and absorbs what
 * used to live at `/settings/members`: the member roster, the invite affordances, and the
 * removed-members restore list all move here, matching the left section nav
 * (components/settings/settings-nav.tsx) this task's brief specifies.
 *
 * Admin gating is combined exactly the way every other privileged view in this app already
 * does: `canManageMembers(account.role)`/`canInvite(account.role)` — the AUTHENTICATED
 * account's real authority, which `createInviteAction`/`reactivateMemberAction` re-check
 * themselves regardless of what this page renders — AND `isAdminProfile(activeMember?.role ??
 * account.role)`, the display-only check for a shared device currently switched to a non-admin
 * profile (see lib/auth/permissions.ts's `isAdminProfile` doc comment). A household viewed as a
 * child must not be OFFERED "+ Invite member" or the removed-members list, even though the
 * account underneath genuinely could use them.
 */
export default async function SettingsFamilyPage() {
  const account = await requireAccountMembership();
  const activeMember = await getActiveMember();
  const supabase = await createServerClient();

  const viewingAsAdmin = isAdminProfile(activeMember?.role ?? account.role);
  const canManage = canManageMembers(account.role) && viewingAsAdmin;
  const canInviteHere = canInvite(account.role) && viewingAsAdmin;

  const [{ data: household }, { data: members }] = await Promise.all([
    supabase.from("households").select("name").eq("id", account.household_id).maybeSingle(),
    supabase
      .from("household_members")
      .select("id, display_name, role, color, avatar_url, user_id, birthday")
      .eq("household_id", account.household_id)
      .eq("is_active", true)
      .order("created_at"),
  ]);

  // Real "does this profile genuinely have a PIN set?" per member, not merely "could this role
  // have one" — mirrors app/switch/page.tsx's own reasoning (lib/auth/pin-gate.ts): claiming a
  // member is PIN-protected when no PIN was ever set would be the exact P0 the switcher's
  // gating logic exists to avoid, just relocated to a settings row instead of a switcher tile.
  const rosterMembers: RosterMember[] = await Promise.all(
    (members ?? []).map(async (member) => {
      let hasPin = false;
      if (requiresPin(member.role)) {
        const { data } = await supabase.rpc("member_has_pin", { p_member_id: member.id });
        hasPin = Boolean(data);
      }
      return { ...member, hasPin };
    }),
  );

  const { data: removedMembers } = canManage
    ? await supabase
        .from("household_members")
        .select("id, display_name, role, color, avatar_url")
        .eq("household_id", account.household_id)
        .eq("is_active", false)
        .order("created_at")
    : { data: [] as RemovedRosterMember[] };

  const pinMemberId = activeMember?.id ?? account.id;

  return (
    <div className="flex flex-col gap-8">
      <FamilyRoster
        householdName={household?.name ?? "Your household"}
        members={rosterMembers}
        removedMembers={removedMembers ?? []}
        canInvite={canInviteHere}
        canManage={canManage}
        viewingAsAdmin={viewingAsAdmin}
      />
      <SetPinForm memberId={pinMemberId} />
    </div>
  );
}
