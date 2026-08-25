"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { requireAccountMembership, setActiveMember } from "@/lib/auth/active-member";
import { requiresPin } from "@/lib/auth/permissions";
import { verifyPin } from "@/lib/auth/pin";

export type SwitchState = { error: string | null };

/**
 * Switches ATTRIBUTION only -- which member the shared-tablet UI credits/displays as "you"
 * right now. It never grants AUTHORITY: every privileged Server Action independently
 * re-resolves the caller's own role via `requireAccountMembership()` (lib/auth/active-member.ts),
 * which reads fresh from the database by the authenticated `user_id` and is never influenced
 * by the `fh_active_member` cookie this function writes. See that module's doc comment for
 * the full attribution/authority split this design depends on.
 *
 * `requireAccountMembership()` below exists only to prove a signed-in account with a
 * household is making this request (so `account.household_id` is trustworthy for scoping the
 * lookup) -- its returned role is intentionally unused for any decision in this function.
 *
 * The PIN check is a convenience lock, not the security boundary: it stops a child from
 * wandering into a parent's profile on a shared kitchen tablet. Verified entirely
 * server-side, from a hash read fresh from the database -- never trust a client-side check.
 */
export async function switchToMemberAction(_prev: SwitchState, formData: FormData): Promise<SwitchState> {
  const memberId = String(formData.get("memberId") ?? "");
  const pin = String(formData.get("pin") ?? "");

  const account = await requireAccountMembership();
  const supabase = await createServerClient();

  // RLS restricts this read to the caller's household, so a foreign id yields nothing --
  // the .eq("household_id", ...) below is redundant with RLS but kept explicit rather than
  // relying solely on it.
  const { data: target } = await supabase
    .from("household_members")
    .select("id, role, pin_hash, household_id")
    .eq("id", memberId)
    .eq("household_id", account.household_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!target) return { error: "That profile is not available" };

  if (requiresPin(target.role)) {
    if (!pin) return { error: "This profile needs a PIN" };
    if (!(await verifyPin(pin, target.pin_hash))) return { error: "Incorrect PIN" };
  }

  await setActiveMember(target.id);
  // redirect() throws -- keep it outside any try/catch, or the switch silently does nothing.
  redirect("/dashboard");
}
