import { describe, expect, it } from "vitest";
import { canEditSettings, canInvite, canManageMembers, isAdmin, requiresPin } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/constants/roles";
import type { AuthorityRole, MemberRole } from "@/lib/constants/roles";

/**
 * Test-only constructor for AuthorityRole. In application code, ONLY
 * requireAccountMembership() (lib/auth/active-member.ts) may mint one, because that is the
 * one place a role has been proven to belong to the authenticated caller. These tests exist
 * to exercise the pure admin-detection logic in lib/auth/permissions.ts across every role —
 * they never touch real authentication — so asserting the role is authoritative here is not
 * the same trust decision production code makes, and does not weaken the guard.
 */
function asAuthority(role: MemberRole): AuthorityRole {
  return role as AuthorityRole;
}

describe("permissions", () => {
  it("treats owner and parent as administrators", () => {
    expect(isAdmin(asAuthority("owner"))).toBe(true);
    expect(isAdmin(asAuthority("parent"))).toBe(true);
    expect(isAdmin(asAuthority("teen"))).toBe(false);
    expect(isAdmin(asAuthority("child"))).toBe(false);
  });

  it("restricts member management, settings, and invites to administrators", () => {
    for (const role of ROLES) {
      const admin = role === "owner" || role === "parent";
      const authRole = asAuthority(role);
      expect(canManageMembers(authRole)).toBe(admin);
      expect(canEditSettings(authRole)).toBe(admin);
      expect(canInvite(authRole)).toBe(admin);
    }
  });

  it("requires a PIN to switch into administrator profiles only", () => {
    expect(requiresPin("owner")).toBe(true);
    expect(requiresPin("parent")).toBe(true);
    expect(requiresPin("teen")).toBe(false);
    expect(requiresPin("child")).toBe(false);
  });

  it("covers every role with no gaps", () => {
    for (const role of ROLES) {
      expect(typeof isAdmin(asAuthority(role))).toBe("boolean");
    }
  });
});

describe("permissions — authority branding", () => {
  it("rejects a plain MemberRole at compile time", () => {
    // This test asserts nothing meaningful at runtime — its entire purpose is the type
    // suppression directive just below. If isAdmin() ever starts accepting a plain
    // MemberRole again, that directive stops suppressing a real type error, tsc reports it
    // as unused, and `npm run build` fails. That is deliberate: losing the
    // attribution/authority split shows up as a build failure, not something a reviewer has
    // to catch by reading closely.
    const plainRole: MemberRole = "owner";
    // @ts-expect-error isAdmin must only accept an AuthorityRole minted by
    // requireAccountMembership(); a plain MemberRole (e.g. from getActiveMember()) must not
    // be assignable here.
    isAdmin(plainRole);
  });
});
