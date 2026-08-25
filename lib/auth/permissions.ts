import type { MemberRole } from "@/lib/constants/roles";

/**
 * AUTHORITY helpers. Every function here answers "what may this ROLE do?" and must only
 * ever be called with a role that came from `requireAccountMembership()` (the authenticated
 * account's own, database-verified row) — never with the role on `getActiveMember()`'s
 * result, which exists for attribution/display only. See lib/auth/active-member.ts.
 *
 * These mirror the database's own rules: the `household_members` BEFORE UPDATE trigger
 * (migrations 0004+) blocks non-admins from changing role/points_balance/is_active/
 * household_id, and admin means exactly `owner` or `parent`. If this list ever disagrees
 * with the trigger, the trigger wins — fix this file, not the database.
 */
const ADMIN_ROLES: readonly MemberRole[] = ["owner", "parent"];

export function isAdmin(role: MemberRole): boolean {
  return ADMIN_ROLES.includes(role);
}

export function canManageMembers(role: MemberRole): boolean {
  return isAdmin(role);
}

export function canEditSettings(role: MemberRole): boolean {
  return isAdmin(role);
}

export function canInvite(role: MemberRole): boolean {
  return isAdmin(role);
}

/** A PIN gates *switching into* an admin profile. It is a convenience lock, not the security boundary. */
export function requiresPin(role: MemberRole): boolean {
  return isAdmin(role);
}
