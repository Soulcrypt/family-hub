import type { createServerClient } from "@/lib/supabase/server";
import { requiresPin } from "@/lib/auth/permissions";
import type { MemberRole } from "@/lib/constants/roles";

/**
 * The ONE place that decides whether switching INTO a given household member's profile should
 * demand a PIN first. Both `app/switch/page.tsx` (the full-screen switcher) and
 * `app/(app)/dashboard/page.tsx` (SP1 Foundation's "one tap switches" dashboard family strip --
 * see this task's brief) need this exact same decision to pick which of `PinDialog` or a plain
 * direct-switch tile to render for a member -- this function is the single source of truth so
 * neither surface can drift from the other, or from `switchToMemberAction`
 * (app/switch/actions.ts), which independently re-derives the identical two checks
 * server-side and is what actually enforces the gate; this function only decides what the UI
 * *offers* to tap.
 *
 * A member is gated when BOTH:
 *  1. `requiresPin(member.role)` -- only `owner`/`parent` are ever PIN-gated at all, and
 *  2. it is not the caller's own row -- switching into yourself never prompts (see
 *     `switchToMemberAction`'s doc comment for why: requiring a PIN to become yourself would
 *     ask you to prove you're the account you're already authenticated as), AND
 *  3. `member_has_pin` (SECURITY DEFINER, supabase/migrations/0019_member_pin_status_rpc.sql)
 *     says a PIN has genuinely been set -- `requiresPin()` alone says nothing about that;
 *     onboarding never sets one, so an admin profile that never had a PIN set would otherwise
 *     show a dialog that can only ever reject every guess (the P0 dead end the SP1 Foundation
 *     design review found -- Jamie Rivera in the seed is exactly this case).
 *
 * Deliberately NOT fail-closed on an RPC error (unlike `switchToMemberAction`'s own fail-closed
 * behavior at the point where a switch is actually performed): this only decides what a
 * render offers to tap, and `switchToMemberAction` independently re-checks and fails closed
 * regardless of what this function said, so a transient error here degrading to "show the
 * direct-switch tile" costs nothing -- the server still refuses the switch if a PIN is
 * genuinely set.
 */
export async function isMemberGated(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  member: { id: string; role: MemberRole; user_id: string | null },
  callerUserId: string | null,
): Promise<boolean> {
  const isOwnRow = member.user_id !== null && member.user_id === callerUserId;
  const gateable = requiresPin(member.role) && !isOwnRow;
  if (!gateable) return false;
  const { data: hasPin } = await supabase.rpc("member_has_pin", { p_member_id: member.id });
  return Boolean(hasPin);
}
