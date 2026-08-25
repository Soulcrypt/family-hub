import { describe, expect, it } from "vitest";
import { formatBirthday } from "@/lib/utils";

describe("formatBirthday", () => {
  it("formats a stored date without shifting a day, unlike a formatter that isn't pinned to UTC", () => {
    // household_members.birthday is a plain `date` column (e.g. "2015-03-03"), which
    // `new Date(...)` parses as UTC midnight. Formatting that WITHOUT pinning
    // `timeZone: "UTC"` -- e.g. from any negative-offset zone such as America/Los_Angeles
    // (UTC-8) -- prints the day BEFORE the stored date, because UTC midnight there is still
    // "yesterday, 4pm" local time. This is the exact regression formatBirthday exists to
    // prevent -- the second assertion reproduces what the bug looks like if the UTC pin were
    // ever removed, so this test fails loudly if that pin is ever dropped.
    expect(formatBirthday("2015-03-03")).toBe("March 3, 2015");

    const naiveWithoutUtcPin = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Los_Angeles",
    }).format(new Date("2015-03-03"));
    expect(naiveWithoutUtcPin).toBe("March 2, 2015");
  });

  it("returns null when there is no birthday", () => {
    expect(formatBirthday(null)).toBeNull();
  });

  it("returns null for a malformed value rather than throwing", () => {
    expect(formatBirthday("not-a-date")).toBeNull();
  });
});
