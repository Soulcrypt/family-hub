import type { Database } from "@/lib/supabase/types";

export type MemberRole = Database["public"]["Enums"]["member_role"];

export const ROLES = ["owner", "parent", "teen", "child"] as const satisfies readonly MemberRole[];

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Owner",
  parent: "Parent",
  teen: "Teen",
  child: "Child",
};

declare const AUTHORITY: unique symbol;

/**
 * A MemberRole proven to belong to the AUTHENTICATED ACCOUNT — read fresh from the database
 * by `requireAccountMembership()` (lib/auth/active-member.ts), keyed by the caller's own
 * `user_id`. This is a NOMINAL brand, not a structural one: an ordinary `MemberRole` (e.g.
 * the one on `getActiveMember()`'s result, which is UI-attribution-only) does not satisfy
 * this type without an explicit cast, and `requireAccountMembership()` is the only place in
 * the codebase permitted to perform that cast — see the comment at its mint site for why.
 *
 * The authority predicates in lib/auth/permissions.ts (isAdmin, canManageMembers,
 * canEditSettings, canInvite) require this type specifically so that feeding them a role
 * from the wrong source fails to COMPILE, not just fails a code review.
 */
export type AuthorityRole = MemberRole & { readonly [AUTHORITY]: true };
