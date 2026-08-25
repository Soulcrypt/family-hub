import { beforeAll, describe, expect, it } from "vitest";
import { signMemberId, verifyMemberId } from "@/lib/auth/active-member";

beforeAll(() => {
  process.env.ACTIVE_MEMBER_COOKIE_SECRET = "test-secret-not-used-in-production";
});

const ID = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1";

describe("active member cookie signing", () => {
  it("round-trips a member id", () => {
    expect(verifyMemberId(signMemberId(ID))).toBe(ID);
  });

  it("rejects a tampered member id", () => {
    const signed = signMemberId(ID);
    const tampered = signed.replace(ID, "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2");
    expect(verifyMemberId(tampered)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const signed = signMemberId(ID);
    expect(verifyMemberId(`${signed}x`)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifyMemberId("")).toBeNull();
    expect(verifyMemberId("no-separator")).toBeNull();
    expect(verifyMemberId("..")).toBeNull();
  });
});
