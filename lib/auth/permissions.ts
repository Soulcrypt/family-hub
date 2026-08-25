import type { AuthorityRole, MemberRole } from "@/lib/constants/roles";

/**
 * AUTHORITY helpers. `isAdmin`, `canManageMembers`, `canEditSettings`, and `canInvite` each
 * answer "may the CALLER do this?" and take an `AuthorityRole`, not a plain `MemberRole` —
 * the type system, not just this comment, is what stops a role from `getActiveMember()`
 * (UI-attribution-only) from being fed into an authorization check: passing a plain
 * `MemberRole` directly to any of the four functions above fails to compile. That guarantee
 * additionally depends on an ESLint rule (`@typescript-eslint/method-signature-style`,
 * eslint.config.mjs) that closes a TypeScript method-shorthand bivariance gap — see the
 * `AuthorityRole` doc comment in lib/constants/roles.ts for the full mechanism. Only
 * `getAccountMembership()` / `requireAccountMembership()` (lib/auth/active-member.ts) can
 * produce an `AuthorityRole`.
 *
 * `requiresPin` is deliberately NOT branded — it asks "does switching *into this profile*
 * require a PIN?", a question about the TARGET member being switched into, not about the
 * caller's own authority. It is meant to be called with a role read straight off any member
 * row (see Task 12's profile switcher).
 *
 * These mirror the database's own rules: the `household_members` BEFORE UPDATE trigger
 * (migrations 0004+) blocks non-admins from changing role/points_balance/is_active/
 * household_id, and admin means exactly `owner` or `parent`. If this list ever disagrees
 * with the trigger, the trigger wins — fix this file, not the database.
 */
const ADMIN_ROLES: readonly MemberRole[] = ["owner", "parent"];

function isAdminRole(role: MemberRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function isAdmin(role: AuthorityRole): boolean {
  return isAdminRole(role);
}

export function canManageMembers(role: AuthorityRole): boolean {
  return isAdminRole(role);
}

export function canEditSettings(role: AuthorityRole): boolean {
  return isAdminRole(role);
}

export function canInvite(role: AuthorityRole): boolean {
  return isAdminRole(role);
}

/** A PIN gates *switching into* an admin profile. It is a convenience lock, not the security boundary. */
export function requiresPin(role: MemberRole): boolean {
  return isAdminRole(role);
}

/**
 * UI-ONLY helper for a page that intentionally renders "as" whichever profile is currently
 * ATTRIBUTED on a shared device -- e.g. Settings (Task 15), where a household switched (via
 * lib/auth/active-member.ts's `getActiveMember()`) to a non-admin member's profile should show
 * a read-only view even though the AUTHENTICATED account underneath might still be an
 * owner/parent. This is deliberately NOT a security boundary: every mutating Server Action in
 * this file's callers still gates on `requireAccountMembership()` + `canEditSettings()` /
 * `canManageMembers()` alone, exactly as everywhere else in the codebase, regardless of what
 * this function says. Pass it whichever profile the page wants to render as -- typically
 * `getActiveMember()?.role ?? account.role`, so a session that has never switched (or whose
 * cookie was cleared) falls back to rendering as the account's own row.
 *
 * Intentionally a separate function from `requiresPin` even though both currently reduce to
 * the same `isAdminRole` check: `requiresPin` answers a switcher-specific question ("does
 * entering this profile need a PIN?"); this answers a display question ("should THIS profile
 * see admin controls?"). Keeping them distinct means a future divergence between "needs a PIN"
 * and "is admin-like for display" doesn't require re-auditing every call site of the other.
 */
export function isAdminProfile(role: MemberRole): boolean {
  return isAdminRole(role);
}
