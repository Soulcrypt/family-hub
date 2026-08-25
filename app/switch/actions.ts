"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { requireAccountMembership, setActiveMember } from "@/lib/auth/active-member";
import { requiresPin } from "@/lib/auth/permissions";

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
 * household is making this request (so `account.household_id`/`account.user_id` are
 * trustworthy for scoping the lookup and the self-switch check below) -- its returned role is
 * intentionally unused for any decision in this function.
 *
 * The PIN itself is verified entirely server-side, via the `verify_member_pin` SECURITY
 * DEFINER function (supabase/migrations/0011_member_pin_verification.sql) -- never by reading
 * `pin_hash` here. `authenticated` has no SELECT privilege on that column at all: any
 * household member with their own login could otherwise read another member's hash off the
 * wire and crack a 4-digit PIN offline in minutes. `verify_member_pin` hashes/compares with
 * pgcrypto (bcryptjs cannot verify a pgcrypto hash or vice versa -- they use incompatible
 * bcrypt variant tags) and collapses "wrong pin"/"no pin set"/"not your household" into the
 * same `false`, so this function never learns which case it hit.
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
    .select("id, role, household_id, user_id")
    .eq("id", memberId)
    .eq("household_id", account.household_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!target) return { error: "That profile is not available" };

  // Skip the PIN when switching into the authenticated account's OWN row. The PIN exists to
  // stop someone switching into ANOTHER person's admin profile -- requiring one to become
  // yourself would ask you to prove you're the person you're already authenticated as, and
  // (since onboarding never sets a PIN) would permanently lock every owner out of their own
  // profile the moment they first switched away from it, with no in-app escape.
  const isOwnRow = target.user_id !== null && target.user_id === account.user_id;

  if (!isOwnRow && requiresPin(target.role)) {
    if (!pin) return { error: "This profile needs a PIN" };
    const { data: verified, error } = await supabase.rpc("verify_member_pin", {
      p_member_id: target.id,
      p_pin: pin,
    });
    if (error || !verified) return { error: "Incorrect PIN" };
  }

  await setActiveMember(target.id);
  // redirect() throws -- keep it outside any try/catch, or the switch silently does nothing.
  redirect("/dashboard");
}
