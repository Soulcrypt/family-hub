"use server";

import { randomBytes, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireAccountMembership } from "@/lib/auth/active-member";
import { canInvite } from "@/lib/auth/permissions";
import { roleSchema } from "@/lib/validation/schemas";
import { formField } from "@/lib/validation/form-field";

export type InviteState = { error: string | null; token: string | null };

/**
 * Creates a household invite -- either a CLAIM invite, attached to an existing login-less
 * `household_members` row via `memberId` (the flow this task exists to deliver: a member who
 * has used the app for months -- points, history, everything -- gains a login without losing
 * any of it), or a brand-new-member invite when `memberId` is omitted (`accept_invite`'s
 * new-member path, already covered by Task 6/pgTAP).
 *
 * Every security-relevant guard for REDEEMING an invite (expiry, reuse, cross-household
 * member_id mismatch, already-claimed, already-a-member) lives entirely inside `accept_invite`
 * (supabase/migrations/0008_bootstrap_display_name_hardening.sql, pgTAP-covered by
 * supabase/tests/020_bootstrap.sql and supabase/tests/040_claim.sql) -- this action does not
 * reimplement any of that. Its own job is just: mint the token and its hash correctly, and
 * refuse up front to hand out a claim link that could never possibly succeed (a memberId that
 * isn't a login-less, active member of the caller's OWN household) -- a UX/quality check, not
 * the security boundary.
 */
export async function createInviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const account = await requireAccountMembership();
  if (!canInvite(account.role)) return { error: "You do not have permission to invite", token: null };
  // requireAccountMembership() resolves this row by user_id, so it is non-null by
  // construction here -- narrowed (not asserted) for the created_by FK this insert needs.
  if (!account.user_id) return { error: "You do not have permission to invite", token: null };

  const parsedRole = roleSchema.safeParse(formField(formData, "role"));
  if (!parsedRole.success) return { error: "Choose a role", token: null };

  const rawMemberId = formField(formData, "memberId");
  const memberId = typeof rawMemberId === "string" && rawMemberId ? rawMemberId : null;

  const rawEmail = formField(formData, "email");
  const email = typeof rawEmail === "string" && rawEmail.trim() ? rawEmail.trim() : null;

  const supabase = await createServerClient();

  if (memberId) {
    const { data: target } = await supabase
      .from("household_members")
      .select("id")
      .eq("id", memberId)
      .eq("household_id", account.household_id)
      .eq("is_active", true)
      .is("user_id", null)
      .maybeSingle();
    if (!target) return { error: "That member can't be invited to log in", token: null };
  }

  // The raw token is shown to the admin exactly once and never stored -- only its SHA-256
  // hash is persisted. `accept_invite` hashes the presented token identically with
  // `encode(digest(p_token, 'sha256'), 'hex')`; these two must stay byte-for-byte in step
  // (see lib/__tests__/create-invite-action.test.ts, which proves it independently).
  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { error } = await supabase.from("household_invites").insert({
    household_id: account.household_id,
    role: parsedRole.data,
    member_id: memberId,
    token_hash: tokenHash,
    email,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_by: account.user_id,
  });
  // Never surface error.message verbatim -- see app/(app)/family/actions.ts's genericErrorFor
  // for why (Postgres/PostgREST text is not user-facing copy).
  if (error) return { error: "We couldn't create this invitation. Please try again.", token: null };

  revalidatePath("/settings/members");
  return { error: null, token };
}
