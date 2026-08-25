import { describe, expect, it } from "vitest";
import { ROLES, type MemberRole } from "@/lib/constants/roles";

describe("member roles", () => {
  it("has exactly the four spec roles in privilege order", () => {
    expect(ROLES).toEqual(["owner", "parent", "teen", "child"]);
  });

  it("does not include the removed adult role", () => {
    expect(ROLES as readonly string[]).not.toContain("adult");
  });

  it("assigns MemberRole from the generated database enum", () => {
    const r: MemberRole = "owner";
    expect(ROLES).toContain(r);
  });
});
