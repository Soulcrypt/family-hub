"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireAccountMembership } from "@/lib/auth/active-member";
import { canManageMembers } from "@/lib/auth/permissions";
import { memberSchema, pinSchema } from "@/lib/validation/schemas";

export type MemberState = { error: string | null };

/**
 * See app/onboarding/actions.ts's identical `genericErrorFor` for why: a raw Postgres/
 * PostgREST `error.message` (constraint names, RLS "permission denied" text, connection
 * errors) must never reach the UI verbatim. Each action below already special-cases the one
 * error it can say something specific and useful about; everything else falls through to one
 * generic, always-safe message per action.
 */
function genericErrorFor(action: "update" | "add" | "deactivate" | "pin"): string {
  switch (action) {
    case "update":
      return "We couldn't save these changes. Please try again.";
    case "add":
      return "We couldn't add this family member. Please try again.";
    case "deactivate":
      return "We couldn't remove this member. Please try again.";
    case "pin":
      return "We couldn't save this pin. Please try again.";
  }
}

/**
 * Updates a member's presentation (and, for an admin, their role and birthday too).
 *
 * Authority split, mirroring every other action in this codebase: `requireAccountMembership()`
 * resolves the AUTHENTICATED account's own role fresh from the database -- never the
 * `fh_active_member` attribution cookie -- and `canManageMembers()` gates on that alone. The
 * role restriction for a non-admin is enforced HERE, not just by RLS, because Postgres
 * policies can only allow/deny a whole row, never restrict which COLUMNS an UPDATE touches:
 * `members_update_self` lets a member update their own row at all, and it is this action's
 * `patch` object -- built to omit role/birthday entirely for a non-admin -- that keeps them
 * from smuggling a role change through it. The household_members BEFORE UPDATE trigger
 * (0004/0005_trigger_fail_closed_and_freeze_identity.sql) is a backstop behind that, not the
 * primary control: it independently blocks the same fields for a caller who isn't an
 * owner/parent of the row's household, and would raise (SQLSTATE 42501, mapped below to a
 * form error) if this action's own restriction were ever removed or bypassed.
 */
export async function updateMemberAction(_prev: MemberState, formData: FormData): Promise<MemberState> {
  const memberId = String(formData.get("memberId") ?? "");
  const parsed = memberSchema.omit({ hasLogin: true, email: true }).safeParse({
    displayName: formData.get("displayName"),
    role: formData.get("role"),
    color: formData.get("color"),
    birthday: formData.get("birthday") || "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details" };

  const account = await requireAccountMembership();
  const isSelf = account.id === memberId;
  const isAdmin = canManageMembers(account.role);

  if (!isAdmin && !isSelf) return { error: "You do not have permission to edit this member" };

  const patch = isAdmin
    ? {
        display_name: parsed.data.displayName,
        role: parsed.data.role,
        color: parsed.data.color,
        birthday: parsed.data.birthday || null,
      }
    : { display_name: parsed.data.displayName, color: parsed.data.color };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("household_members")
    .update(patch)
    .eq("id", memberId)
    .eq("household_id", account.household_id);

  if (error) {
    if (error.code === "42501") return { error: "You do not have permission to change that" };
    return { error: genericErrorFor("update") };
  }

  revalidatePath("/family");
  revalidatePath("/family/[memberId]", "page");
  return { error: null };
}

/** Adds a login-less member directly -- the same shape as app/onboarding/actions.ts's
 * `addMemberAction`, kept as a separate copy (rather than imported) so this route revalidates
 * its OWN path rather than "/onboarding". Login-attached members only ever arrive via
 * `accept_invite` (Task 14). */
export async function addMemberAction(_prev: MemberState, formData: FormData): Promise<MemberState> {
  const parsed = memberSchema.safeParse({
    displayName: formData.get("displayName"),
    role: formData.get("role"),
    color: formData.get("color") || "#C4643C",
    birthday: formData.get("birthday") || "",
    hasLogin: false,
    email: "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details" };

  const account = await requireAccountMembership();
  if (!canManageMembers(account.role)) return { error: "You do not have permission to add members" };

  const supabase = await createServerClient();
  const { error } = await supabase.from("household_members").insert({
    household_id: account.household_id,
    display_name: parsed.data.displayName,
    role: parsed.data.role,
    color: parsed.data.color,
    birthday: parsed.data.birthday || null,
    user_id: null,
  });
  if (error) return { error: genericErrorFor("add") };

  revalidatePath("/family");
  return { error: null };
}

/**
 * Deactivates a member -- soft-delete via `is_active = false`, never a hard DELETE, so their
 * history (chores, points, etc. in later tasks) stays attributable. Admin-only, and an admin
 * may not deactivate themselves (that would strand the household with a live session but no
 * membership row to authorize anything against).
 */
export async function deactivateMemberAction(_prev: MemberState, formData: FormData): Promise<MemberState> {
  const memberId = String(formData.get("memberId") ?? "");
  const account = await requireAccountMembership();
  if (!canManageMembers(account.role)) return { error: "You do not have permission to remove members" };
  if (memberId === account.id) return { error: "You cannot remove yourself" };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("household_members")
    .update({ is_active: false })
    .eq("id", memberId)
    .eq("household_id", account.household_id);

  if (error) {
    if (error.code === "42501") return { error: "You do not have permission to remove this member" };
    return { error: genericErrorFor("deactivate") };
  }

  revalidatePath("/family");
  revalidatePath("/family/[memberId]", "page");
  return { error: null };
}

/**
 * Sets a member's PIN via the `set_member_pin` SECURITY DEFINER RPC
 * (supabase/migrations/0011_member_pin_verification.sql) -- never by writing `pin_hash`
 * directly. That column isn't even SELECTable by `authenticated` any more (Task 12 fix round
 * 2), and hashing it here with anything other than pgcrypto (e.g. bcryptjs, which this repo
 * deliberately does NOT depend on) would store a hash `verify_member_pin` can never match --
 * PINs would appear to save successfully and then silently never work.
 *
 * Authority for WHO may set WHOSE pin is derived entirely inside `set_member_pin` from
 * `auth.uid()` -- a member may set their own, an owner/parent may set one for any member of
 * their own household, and everyone else is rejected with `not permitted to set this pin`
 * (SQLSTATE 42501). This action does not re-implement that check; it only calls
 * `requireAccountMembership()` first to confirm a signed-in account with a household is
 * making the request at all (matching every other action in this file), then surfaces
 * whatever the RPC decides.
 *
 * There is deliberately no way to show whether a member already has a PIN set: `pin_hash`
 * cannot be read by the client at all, so the UI cannot distinguish "setting a PIN for the
 * first time" from "changing an existing one" -- see this task's report.
 */
export async function setPinAction(_prev: MemberState, formData: FormData): Promise<MemberState> {
  const memberId = String(formData.get("memberId") ?? "");
  const parsed = pinSchema.safeParse({ pin: formData.get("pin") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter a 4-digit PIN" };

  await requireAccountMembership();

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("set_member_pin", { p_member_id: memberId, p_pin: parsed.data.pin });
  if (error) {
    if (error.code === "42501") return { error: "You do not have permission to set this pin" };
    return { error: genericErrorFor("pin") };
  }

  revalidatePath("/family/[memberId]", "page");
  return { error: null };
}
