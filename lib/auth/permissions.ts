import type { AuthorityRole, MemberRole } from "@/lib/constants/roles";

/**
 * AUTHORITY helpers. `isAdmin`, `canManageMembers`, `canEditSettings`, and `canInvite` each
 * answer "may the CALLER do this?" and take an `AuthorityRole`, not a plain `MemberRole` —
 * the type system, not just this comment, is what stops a role from `getActiveMember()`
 * (UI-attribution-only) from being fed into an authorization check: passing a plain
 * `MemberRole` to any of the four functions above fails to compile. Only
 * `requireAccountMembership()` (lib/auth/active-member.ts) can produce an `AuthorityRole`.
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
