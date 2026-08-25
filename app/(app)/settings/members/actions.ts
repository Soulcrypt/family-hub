"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireAccountMembership } from "@/lib/auth/active-member";
import { canManageMembers } from "@/lib/auth/permissions";

export type MemberManagementState = { error: string | null };

/**
 * Reactivates a member Task 13's `deactivateMemberAction` (app/(app)/family/actions.ts)
 * soft-removed -- the counterpart that was missing until now. Without this, the "you were
 * removed from this household -- ask an owner or parent to restore your membership" error a
 * removed member sees on a fresh invite (Task 14, supabase/migrations/0013) was advice nobody
 * could act on: there was no UI that could even see a deactivated row, let alone flip it back.
 *
 * Gated EXACTLY like `deactivateMemberAction` -- `requireAccountMembership()` resolves the
 * AUTHENTICATED account's own role fresh from the database, never the `fh_active_member`
 * attribution cookie, and `canManageMembers()` gates on that alone. The `household_members`
 * BEFORE UPDATE trigger (supabase/migrations/0004/0005) independently blocks any non-admin
 * caller from changing `is_active` at all -- a backstop behind this action's own check, not
 * the primary control -- and raises SQLSTATE 42501 rather than silently no-op'ing, which is
 * why that code is mapped to a clean form error below instead of a raw Postgres message
 * reaching the UI.
 *
 * Lives alongside the members list (`/settings/members`, where an admin can actually SEE a
 * removed member -- app/(app)/settings/members/page.tsx) rather than in
 * app/(app)/family/actions.ts: the ordinary family roster and the profile switcher both
 * deliberately keep deactivated members invisible (see those pages' own `is_active` filters),
 * so restoring one is a Settings-scoped member-management action, not a Family one.
 */
export async function reactivateMemberAction(
  _prev: MemberManagementState,
  formData: FormData,
): Promise<MemberManagementState> {
  const memberId = String(formData.get("memberId") ?? "");
  const account = await requireAccountMembership();
  if (!canManageMembers(account.role)) return { error: "You do not have permission to restore members" };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("household_members")
    .update({ is_active: true })
    .eq("id", memberId)
    .eq("household_id", account.household_id);

  if (error) {
    if (error.code === "42501") return { error: "You do not have permission to restore this member" };
    return { error: "We couldn't restore this member. Please try again." };
  }

  revalidatePath("/settings/members");
  revalidatePath("/family");
  return { error: null };
}
