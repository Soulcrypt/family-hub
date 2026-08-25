import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names and drops falsy values", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("lets later tailwind classes win over earlier conflicting ones", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
