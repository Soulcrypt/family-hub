import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import type { AuthorityRole, MemberRole } from "@/lib/constants/roles";

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
 * This split is enforced by the TYPE SYSTEM, not just by convention: `getActiveMember()`
 * returns a role typed `MemberRole`, `requireAccountMembership()` returns a role typed the
 * nominally-branded `AuthorityRole` (lib/constants/roles.ts), and every authority predicate
 * in lib/auth/permissions.ts (isAdmin, canManageMembers, canEditSettings, canInvite) only
 * accepts `AuthorityRole`. Feeding `getActiveMember()`'s role into any of them fails to
 * compile — see the single cast site inside `requireAccountMembership()` below for where
 * (and only where) a role is permitted to become authoritative.
 */

const COOKIE = "fh_active_member";
const SEPARATOR = ".";

/**
 * A household member row resolved via the `fh_active_member` cookie — ATTRIBUTION ONLY.
 * `.role` is a plain `MemberRole` and cannot be passed to an authority predicate in
 * lib/auth/permissions.ts; that rejection is enforced by the compiler, not just this
 * comment. Use it to decide whose name/avatar/points to show, never to gate an action.
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

/**
 * A household member row resolved from the AUTHENTICATED ACCOUNT's own `user_id` —
 * AUTHORITY. `.role` is an `AuthorityRole`, so it — and only it — may be passed to
 * lib/auth/permissions.ts's authority predicates. Field set is otherwise identical to
 * `ActiveMember`.
 */
export type AccountMembership = Omit<ActiveMember, "role"> & { role: AuthorityRole };

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
 * should credit. Its `.role` is a plain `MemberRole` and the compiler will refuse to let it
 * reach an authority predicate in lib/auth/permissions.ts. For authorization, call
 * `requireAccountMembership()` instead.
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
 * by `user_id` (never from the `fh_active_member` cookie). Its `.role` is the only role in
 * the codebase permitted to gate a privileged operation — pass it to
 * lib/auth/permissions.ts (isAdmin, canManageMembers, canEditSettings, canInvite).
 *
 * Throws rather than returning null: every caller of this function is already committed to
 * requiring authentication and membership, so forcing a try/catch (or letting the error
 * propagate to an error boundary) is safer than a silently-ignorable null.
 */
export async function requireAccountMembership(): Promise<AccountMembership> {
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

  // THE SINGLE TRUST BOUNDARY in this module. This row was looked up by
  // `user_id = auth.getUser().id` — the authenticated account's own row, verified by the
  // database a moment ago — so its `role` is proven to belong to the caller, not merely
  // displayed on their behalf. That is what justifies minting an AuthorityRole here.
  // Do NOT widen this cast, and do NOT add a second `as AuthorityRole` anywhere else in
  // APPLICATION code: doing so from any other row (e.g. one looked up by member id, or from
  // getActiveMember()'s result) hands out authority to a role nobody proved the caller owns,
  // and silently defeats the entire attribution/authority split this file exists to enforce.
  // (Test files may construct a synthetic AuthorityRole to exercise the pure permission
  // logic in lib/auth/permissions.ts directly — see lib/__tests__/permissions.test.ts — that
  // never touches real authentication and is not the trust boundary this comment guards.)
  return { ...data, role: data.role as AuthorityRole };
}
