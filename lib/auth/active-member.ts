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
 *   `getAccountMembership()` / `requireAccountMembership()`. The active-member cookie is
 *   NEVER consulted for this, because it is client-suppliable UI state, not proof of who is
 *   authenticated. Use `getAccountMembership()` (returns `null`) where "no membership yet"
 *   is a normal, branchable state — e.g. a redirect gate on an onboarding page. Use
 *   `requireAccountMembership()` (throws) only where a membership is already known to exist
 *   and its absence would be a bug. Both resolve the same row; they differ only in how they
 *   report "there isn't one."
 *
 * This split is enforced by the TYPE SYSTEM plus one ESLint rule, not just by convention:
 * `getActiveMember()` returns a role typed `MemberRole`, `getAccountMembership()` and
 * `requireAccountMembership()` return a role typed the nominally-branded `AuthorityRole`
 * (lib/constants/roles.ts), and every authority predicate in lib/auth/permissions.ts
 * (isAdmin, canManageMembers, canEditSettings, canInvite) only accepts `AuthorityRole`.
 * Feeding `getActiveMember()`'s role directly into any of them fails to compile;
 * `@typescript-eslint/method-signature-style` (eslint.config.mjs) closes a separate
 * TypeScript gap — method-shorthand signatures are bivariant under `strictFunctionTypes` and
 * could otherwise launder a plain role past the brand with no cast. See the `AuthorityRole`
 * doc comment in lib/constants/roles.ts for the full mechanism, and the single cast site
 * inside `lookupAccountMembership()` below for where (and only where) a role is permitted to
 * become authoritative.
 */

const COOKIE = "fh_active_member";
const SEPARATOR = ".";

/**
 * A household member row resolved via the `fh_active_member` cookie — ATTRIBUTION ONLY.
 * `.role` is a plain `MemberRole` and cannot be passed to an authority predicate in
 * lib/auth/permissions.ts; that rejection is enforced by the type system and the
 * `@typescript-eslint/method-signature-style` ESLint rule together (see the module doc
 * comment above), not just this comment. Use it to decide whose name/avatar/points to show,
 * never to gate an action.
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
 * should credit. Its `.role` is a plain `MemberRole`, which the type system and this repo's
 * ESLint rules together refuse to let reach an authority predicate in
 * lib/auth/permissions.ts (see the module doc comment above for the full mechanism). For
 * authorization, call `requireAccountMembership()` instead.
 */
export async function getActiveMember(): Promise<ActiveMember | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;

  const id = verifyMemberId(raw);
  if (!id) return null;

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("household_members")
    .select("id, user_id, display_name, role, color, avatar_url, household_id")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    // Attribution is allowed to be wrong-ish (see the module doc comment), so a lookup
    // failure still just falls back to null rather than breaking the page — but a discarded
    // error leaves no trace when the cause is a genuine network/RLS fault rather than a
    // stale cookie. Log it so that failure mode is diagnosable.
    console.error("[active-member] getActiveMember() household_members lookup failed", error);
    return null;
  }

  return data ?? null;
}

/** Thrown by `requireAccountMembership()` when there is no signed-in user at all. */
export class NotAuthenticatedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "NotAuthenticatedError";
  }
}

/**
 * Thrown by `requireAccountMembership()` when the authenticated account has no active
 * household membership yet — e.g. mid-signup, before `create_household`/`accept_invite` has
 * run. Callers that expect this as a normal, branchable state (redirecting to `/onboarding`)
 * should use `getAccountMembership()` instead, which returns `null` for this case rather
 * than throwing.
 */
export class NoHouseholdMembershipError extends Error {
  constructor() {
    super("This account has no active household membership");
    this.name = "NoHouseholdMembershipError";
  }
}

/**
 * Thrown when an authenticated account has MORE THAN ONE active `household_members` row.
 * The schema permits this — `household_members_user_unique` is `(household_id, user_id)`,
 * not `(user_id)` alone — but SP1's product model assumes one household per account, so this
 * is always an anomaly here, never an expected state. Unlike `NoHouseholdMembershipError`,
 * `getAccountMembership()` does NOT swallow this into `null`: silently treating "which
 * household?" as "no household yet" would route the account back through onboarding, where
 * they could create a THIRD household instead of surfacing the ambiguity.
 */
export class MultipleHouseholdMembershipsError extends Error {
  constructor() {
    super("This account belongs to more than one household, which is not supported yet");
    this.name = "MultipleHouseholdMembershipsError";
  }
}

type MembershipLookup =
  | { status: "unauthenticated" }
  | { status: "none" }
  | { status: "multiple" }
  | { status: "found"; membership: AccountMembership };

/**
 * Shared resolver behind both `getAccountMembership()` and `requireAccountMembership()`.
 * Looks up the AUTHENTICATED ACCOUNT's own membership by `user_id` — never from the
 * `fh_active_member` cookie — and classifies the result rather than deciding for the caller
 * whether an absent membership should be an error or a branchable state.
 */
async function lookupAccountMembership(): Promise<MembershipLookup> {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    console.error("[active-member] auth.getUser() failed", userError);
  }
  if (!user) return { status: "unauthenticated" };

  const { data, error } = await supabase
    .from("household_members")
    .select("id, user_id, display_name, role, color, avatar_url, household_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    // .maybeSingle() only ever produces an `error` here when MORE THAN ONE row matched
    // (PostgREST code PGRST116) — zero rows comes back as `{ data: null, error: null }`, not
    // an error. Ruling: keep `.maybeSingle()` rather than adding `.limit(1)` to make the
    // multi-row case "just work" — SP1 assumes one household per account, and an owner of
    // household A silently acting with whatever role they happen to hold in household B
    // (which `.limit(1)` would produce, non-deterministically) is a worse failure than
    // refusing outright. Log the real Postgres/network error either way — swallowing it here
    // would make a genuine DB fault indistinguishable from "no membership yet".
    console.error("[active-member] household_members lookup for account failed", error);
    if (error.code === "PGRST116") return { status: "multiple" };
    throw error;
  }

  if (!data) return { status: "none" };

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
  return { status: "found", membership: { ...data, role: data.role as AuthorityRole } };
}

/**
 * Resolves the AUTHENTICATED ACCOUNT's own membership, or `null` if there isn't one YET —
 * not signed in, or signed in but hasn't created/joined a household. Use this for redirect
 * gates where "no membership" is an expected, branchable UI state (e.g. `if (!membership)
 * redirect("/onboarding")` in `app/page.tsx`, `app/onboarding/page.tsx`, `app/layout.tsx`),
 * not an error.
 *
 * Still THROWS `MultipleHouseholdMembershipsError` for a genuinely ambiguous account, and
 * rethrows any other lookup failure — those are anomalies, not "not onboarded yet," and
 * silently mapping them to `null` would send an affected account back through onboarding
 * instead of surfacing the problem. See `lookupAccountMembership()`'s comment on why
 * `.limit(1)` is not the fix.
 */
export async function getAccountMembership(): Promise<AccountMembership | null> {
  const result = await lookupAccountMembership();
  switch (result.status) {
    case "unauthenticated":
    case "none":
      return null;
    case "multiple":
      throw new MultipleHouseholdMembershipsError();
    case "found":
      return result.membership;
  }
}

/**
 * Resolves the AUTHENTICATED ACCOUNT's own membership, throwing a specific error class
 * instead of returning a value when there isn't one. Its `.role` is the only role in the
 * codebase permitted to gate a privileged operation — pass it to lib/auth/permissions.ts
 * (isAdmin, canManageMembers, canEditSettings, canInvite).
 *
 * Use this ONLY where the caller has already established that a membership SHOULD exist
 * (e.g. immediately after `create_household`/`accept_invite` succeeds, or inside a Server
 * Action reachable only from a page that already redirected on `getAccountMembership() ===
 * null`) — so its absence is a bug worth a hard failure, not a UI state to branch on. A page
 * that renders for a not-yet-onboarded account (like `/onboarding` itself) should call
 * `getAccountMembership()` instead: this function throwing there turns a normal "redirect to
 * onboarding" state into an unhandled error.
 */
export async function requireAccountMembership(): Promise<AccountMembership> {
  const result = await lookupAccountMembership();
  switch (result.status) {
    case "unauthenticated":
      throw new NotAuthenticatedError();
    case "none":
      throw new NoHouseholdMembershipError();
    case "multiple":
      throw new MultipleHouseholdMembershipsError();
    case "found":
      return result.membership;
  }
}
