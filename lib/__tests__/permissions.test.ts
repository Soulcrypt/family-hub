import { describe, expect, it } from "vitest";
import { canEditSettings, canInvite, canManageMembers, isAdmin, requiresPin } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/constants/roles";

describe("permissions", () => {
  it("treats owner and parent as administrators", () => {
    expect(isAdmin("owner")).toBe(true);
    expect(isAdmin("parent")).toBe(true);
    expect(isAdmin("teen")).toBe(false);
    expect(isAdmin("child")).toBe(false);
  });

  it("restricts member management, settings, and invites to administrators", () => {
    for (const role of ROLES) {
      const admin = role === "owner" || role === "parent";
      expect(canManageMembers(role)).toBe(admin);
      expect(canEditSettings(role)).toBe(admin);
      expect(canInvite(role)).toBe(admin);
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
      expect(typeof isAdmin(role)).toBe("boolean");
    }
  });
});
