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
 * by `getAccountMembership()` / `requireAccountMembership()` (lib/auth/active-member.ts),
 * keyed by the caller's own `user_id`. This is a NOMINAL brand, not a structural one: an
 * ordinary `MemberRole` (e.g. the one on `getActiveMember()`'s result, which is
 * UI-attribution-only) does not satisfy this type without an explicit cast, and
 * `lookupAccountMembership()` (the shared internal resolver behind both of the above) is the
 * only place in the codebase permitted to perform that cast — see the comment at its mint
 * site for why.
 *
 * The authority predicates in lib/auth/permissions.ts (isAdmin, canManageMembers,
 * canEditSettings, canInvite) require this type specifically so that feeding them a role
 * from the wrong source fails at every direct call site or plain function-typed variable —
 * TypeScript's ordinary contravariant parameter checking rejects it with no cast or lint
 * needed. There is one documented TypeScript gap this alone does NOT close: method-shorthand
 * signatures (`interface X { m(role: MemberRole): boolean }`) are bivariant, not
 * contravariant, under `strictFunctionTypes`, and can launder a plain MemberRole through
 * without error. This repo closes that with the `@typescript-eslint/method-signature-style:
 * ["error", "property"]` ESLint rule (eslint.config.mjs), which forces every method
 * signature into property form project-wide. The brand's guarantee depends on BOTH the type
 * and that rule — do not remove the rule without re-verifying this brand still holds.
 */
export type AuthorityRole = MemberRole & { readonly [AUTHORITY]: true };
