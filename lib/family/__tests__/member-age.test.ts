import { describe, expect, it } from "vitest";
import { ageCaption, memberCaption } from "@/lib/family/member-age";

describe("ageCaption", () => {
  // Design-Spec correction (docs/design/hearth/Design-Spec.md header): Ivy is born 2025-12-18,
  // not the mock's "age 2" — every age-derived string must be COMPUTED from the real birthday,
  // never copied from the mocks. As of 2026-08-26 she is 8 months old.
  it("computes whole months for an infant, matching the spec's corrected age", () => {
    expect(ageCaption("2025-12-18", new Date("2026-08-26T12:00:00Z"))).toBe("8 months old");
  });

  it("does not round up to the next month until the day-of-month is reached", () => {
    // One day short of 8 full months.
    expect(ageCaption("2025-12-18", new Date("2026-08-17T12:00:00Z"))).toBe("7 months old");
  });

  it("uses singular phrasing for exactly 1 month", () => {
    expect(ageCaption("2026-06-18", new Date("2026-07-18T12:00:00Z"))).toBe("1 month old");
  });

  it("reports newborns in weeks rather than '0 months old'", () => {
    expect(ageCaption("2026-08-20", new Date("2026-08-26T12:00:00Z"))).toBe("< 1 month old");
  });

  it("switches to whole years once a member has had a birthday", () => {
    expect(ageCaption("2015-03-03", new Date("2026-08-26T12:00:00Z"))).toBe("11 years old");
  });

  it("uses singular phrasing for exactly 1 year", () => {
    expect(ageCaption("2025-08-01", new Date("2026-08-26T12:00:00Z"))).toBe("1 year old");
  });

  it("returns null for a malformed birthday rather than throwing", () => {
    expect(ageCaption("not-a-date", new Date())).toBeNull();
  });
});

describe("memberCaption", () => {
  const now = new Date("2026-08-26T12:00:00Z");

  it("prefers a login caption over an age caption when the member has their own login", () => {
    expect(memberCaption({ birthday: "2025-12-18", hasLogin: true }, now)).toBe("Has their own login");
  });

  it("falls back to a computed age caption for a login-less member with a birthday", () => {
    expect(memberCaption({ birthday: "2025-12-18", hasLogin: false }, now)).toBe("8 months old");
  });

  it("falls back to a generic caption for a login-less member with no birthday on file", () => {
    expect(memberCaption({ birthday: null, hasLogin: false }, now)).toBe("No login yet");
  });
});
