import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/lib/constants/roles";

/**
 * This module implements the app's central security split: ATTRIBUTION vs. AUTHORITY.
 *
 * - Attribution — "who gets credit for this action, whose stuff shows in the UI right now."
 *   Carried by the signed `fh_active_member` cookie and resolved by `getActiveMember()`.
 *   A shared kitchen tablet can be signed in as one parent's account while the UI displays
 *   a different family member ("you are Ivy") — that's attribution, and it is allowed to be
 *   wrong-ish (a forged/expired cookie just falls back to null, nothing breaks).
 *
 * - Authority — "what is this request allowed to do." Determined SOLELY by the
 *   authenticated account's own row, looked up fresh from the database by
 *   `requireAccountMembership()`. The active-member cookie is NEVER consulted for this,
 *   because it is client-suppliable UI state, not proof of who is authenticated.
 *
 * Do not use `getActiveMember()`'s `.role` to gate a privileged operation — it answers
 * "who does the UI say this is," not "who is allowed to do this." Feed roles into
 * lib/auth/permissions.ts (isAdmin, canManageMembers, ...) ONLY when they came from
 * `requireAccountMembership()`.
 */

const COOKIE = "fh_active_member";
const SEPARATOR = ".";

/**
 * A household member row, shaped identically whether it came from `getActiveMember()`
 * (attribution — trust it for display only) or `requireAccountMembership()` (authority —
 * trust its `.role` for permission checks). The type itself does not distinguish the two;
 * which function you called is what determines whether `.role` is safe to authorize with.
 */
export type ActiveMember = {
  id: string;
  user_id: string | null;
  display_name: string;
  role: MemberRole;
  color: string;
  avatar_url: string | null;
  household_id: string;
};

function secret(): string {
  const value = process.env.ACTIVE_MEMBER_COOKIE_SECRET;
  if (!value) throw new Error("ACTIVE_MEMBER_COOKIE_SECRET is not set");
  return value;
}

/** Signs a member id with an HMAC so the cookie cannot be hand-edited to name a different member. */
export function signMemberId(id: string): string {
  const mac = createHmac("sha256", secret()).update(id).digest("base64url");
  return `${id}${SEPARATOR}${mac}`;
}

/**
 * Verifies a signed member id, returning the id if the signature is valid and null otherwise.
 * A valid signature only proves the cookie was issued by this server — it says nothing about
 * whether the named member still exists, is active, or belongs to a household the current
 * account can see. `getActiveMember()` checks all of that with a database read.
 */
export function verifyMemberId(signed: string): string | null {
  const index = signed.lastIndexOf(SEPARATOR);
  if (index <= 0) return null;

  const id = signed.slice(0, index);
  const mac = signed.slice(index + 1);
  if (!id || !mac) return null;

  const expected = createHmac("sha256", secret()).update(id).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on mismatched lengths rather than returning false, so the
  // length check must happen first.
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? id : null;
}

export async function setActiveMember(id: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, signMemberId(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearActiveMember(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/**
 * Resolves the active member for ATTRIBUTION ONLY — never for authorization.
 *
 * Two checks gate the result, and both matter:
 *  1. The HMAC signature proves the cookie was issued by this server, not hand-edited by
 *     the client to name an arbitrary member id.
 *  2. The database read (through the caller's own RLS-scoped session) proves the member is
 *     genuinely active and in a household this authenticated account belongs to. A forged
 *     or stale cookie naming a stranger's member id comes back as `null` here — RLS simply
 *     will not return a row the caller's session cannot see — rather than leaking that
 *     member's data.
 *
 * Use the result to decide whose name/avatar/points to show, or whose chore an action
 * should credit. NEVER use the returned `.role` to gate a privileged operation — that is
 * exactly the mistake this module exists to prevent. For authorization, call
 * `requireAccountMembership()` instead and feed ITS role into lib/auth/permissions.ts.
 */
export async function getActiveMember(): Promise<ActiveMember | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;

  const id = verifyMemberId(raw);
  if (!id) return null;

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("household_members")
    .select("id, user_id, display_name, role, color, avatar_url, household_id")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  return data ?? null;
}

/**
 * Resolves the AUTHENTICATED ACCOUNT's own membership, looked up fresh from the database
 * by `user_id` (never from the `fh_active_member` cookie). This is the only membership row
 * whose `.role` may gate a privileged operation — pass it to lib/auth/permissions.ts
 * (isAdmin, canManageMembers, canEditSettings, canInvite).
 *
 * Throws rather than returning null: every caller of this function is already committed to
 * requiring authentication and membership, so forcing a try/catch (or letting the error
 * propagate to an error boundary) is safer than a silently-ignorable null.
 */
export async function requireAccountMembership(): Promise<ActiveMember> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data } = await supabase
    .from("household_members")
    .select("id, user_id, display_name, role, color, avatar_url, household_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) throw new Error("No household membership");
  return data;
}
