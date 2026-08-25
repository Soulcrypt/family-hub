import { describe, expect, it } from "vitest";
import { hashPin, verifyPin } from "@/lib/auth/pin";

describe("pin hashing", () => {
  it("verifies a correct pin", async () => {
    const hash = await hashPin("4821");
    expect(await verifyPin("4821", hash)).toBe(true);
  });

  it("rejects an incorrect pin", async () => {
    const hash = await hashPin("4821");
    expect(await verifyPin("1234", hash)).toBe(false);
  });

  it("never stores the pin in plaintext", async () => {
    const hash = await hashPin("4821");
    expect(hash).not.toContain("4821");
  });

  it("produces a different hash for the same pin each time", async () => {
    expect(await hashPin("4821")).not.toBe(await hashPin("4821"));
  });

  it("returns false for a null hash rather than throwing", async () => {
    expect(await verifyPin("4821", null)).toBe(false);
  });
});
