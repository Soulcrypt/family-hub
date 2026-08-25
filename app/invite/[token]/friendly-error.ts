/**
 * Maps `accept_invite`'s and `preview_invite`'s own error text
 * (supabase/migrations/0008_bootstrap_display_name_hardening.sql,
 * supabase/migrations/0012_accept_invite_one_household_guard.sql,
 * supabase/migrations/0013_accept_invite_removed_member_message.sql,
 * supabase/migrations/0014_invite_preview_rpc.sql, pgTAP-covered by
 * supabase/tests/020_bootstrap.sql, supabase/tests/040_claim.sql, and
 * supabase/tests/050_invite_preview.sql) to user-facing copy. These are Postgres RAISE
 * EXCEPTION messages, not written for an end user, so each one this flow can say something
 * specific and useful about is named explicitly here; anything unrecognized falls through to
 * one generic, always-safe message -- same pattern as every other action in this codebase (see
 * e.g. app/(app)/family/actions.ts's genericErrorFor).
 *
 * Shared between `app/invite/[token]/page.tsx` (maps `preview_invite`'s errors -- a strict
 * subset of the cases below) and `app/invite/[token]/actions.ts` (maps `accept_invite`'s, the
 * full set) so the two RPCs' overlapping error text is translated identically wherever it
 * surfaces, rather than two copies of this switch drifting apart.
 *
 * Every string below uses a plain ASCII apostrophe, matching genericErrorFor's own convention
 * (app/(app)/family/actions.ts) and not the typographic ’ this codebase's headings/paragraphs
 * otherwise use -- these are string literals returned from a function, not literal JSX text
 * nodes, so `react/no-unescaped-entities` (the actual reason JSX copy elsewhere uses curly
 * quotes) does not apply to them, and consistency with the OTHER error-message function in the
 * codebase matters more here than matching prose style.
 */
export function friendlyClaimError(message: string): string {
  switch (message) {
    case "invitation not found":
      return "This invitation link isn't valid. Ask whoever invited you to send a new one.";
    case "invitation already used":
      return "This invitation has already been used.";
    case "invitation expired":
      return "This invitation has expired. Ask whoever invited you to send a new one.";
    case "profile already claimed":
      return "This family member already has their own login.";
    case "you are already a member of this household":
      return "You're already a member of this household.";
    case "you already have a household":
      // 0012_accept_invite_one_household_guard.sql: raised for an account that already has an
      // ACTIVE membership in a DIFFERENT household -- see that migration's header comment for
      // why this is enforced in the RPC itself, not just here.
      return "You already belong to a household, so this invitation can't be accepted from this account.";
    case "you were removed from this household -- ask an owner or parent to restore your membership":
      // 0013_accept_invite_removed_member_message.sql: raised for a caller whose row in THIS
      // invite's own household still exists but is inactive (Task 13's soft-delete). There is
      // no reactivation UI yet -- restoring a removed member belongs to Task 15's member
      // management -- so this message names a capability the product doesn't have yet on
      // purpose (see that migration's header comment), rather than leaving the dead end
      // "you are already a member" produced before this fix.
      return "You were removed from this household. Ask an owner or parent to add you back before using this invitation.";
    default:
      return "We couldn't add you to this household. Please try again.";
  }
}
