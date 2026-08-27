import { describe, expect, it } from "vitest";
import { daysInMonth, isoFromParts, partsFromIso } from "@/lib/family/birthday-parts";

/**
 * The picker's arithmetic, separated from its rendering so the awkward cases can be tested as
 * data rather than driven through three comboboxes.
 *
 * The case that matters most is the one a native `<input type="date">` never has to face:
 * because month, day and year are chosen independently and in any order, a valid selection can
 * be invalidated by a LATER change — pick 31 January, then switch the month to February. The
 * date must not silently become 3 March (what `new Date(2000, 1, 31)` does) and must not be
 * stored as an impossible "2000-02-31".
 */
describe("daysInMonth", () => {
  it("knows the short months", () => {
    expect(daysInMonth(4, 2024)).toBe(30);
    expect(daysInMonth(6, 2024)).toBe(30);
    expect(daysInMonth(9, 2024)).toBe(30);
    expect(daysInMonth(11, 2024)).toBe(30);
    expect(daysInMonth(1, 2024)).toBe(31);
  });

  it("handles February across the leap-year rules, including the century exceptions", () => {
    expect(daysInMonth(2, 2024)).toBe(29); // divisible by 4
    expect(daysInMonth(2, 2023)).toBe(28);
    expect(daysInMonth(2, 1900)).toBe(28); // divisible by 100, not 400 -- not a leap year
    expect(daysInMonth(2, 2000)).toBe(29); // divisible by 400 -- is a leap year
  });

  it("offers the 29th before a year is known, rather than hiding a day that may be valid", () => {
    // Someone filling month-first must still be able to pick 29 February; narrowing to 28
    // before the year exists would make a real birthday unselectable in that order.
    expect(daysInMonth(2, null)).toBe(29);
  });

  it("falls back to 31 with no month chosen, so the day list is never artificially short", () => {
    expect(daysInMonth(null, null)).toBe(31);
    expect(daysInMonth(null, 2024)).toBe(31);
  });
});

describe("isoFromParts", () => {
  it("composes a complete selection", () => {
    expect(isoFromParts({ year: "1985", month: "03", day: "07" })).toBe("1985-03-07");
  });

  it("returns empty for any incomplete selection, never a half-date", () => {
    expect(isoFromParts({ year: "1985", month: "03", day: "" })).toBe("");
    expect(isoFromParts({ year: "1985", month: "", day: "07" })).toBe("");
    expect(isoFromParts({ year: "", month: "03", day: "07" })).toBe("");
    expect(isoFromParts({ year: "198", month: "03", day: "07" })).toBe("");
  });

  it("refuses a day the chosen month cannot have, instead of rolling into the next one", () => {
    // 31 January -> switch to February. `new Date(2000, 1, 31)` would silently give 2 March.
    expect(isoFromParts({ year: "2000", month: "02", day: "31" })).toBe("");
    expect(isoFromParts({ year: "2023", month: "02", day: "29" })).toBe("");
    expect(isoFromParts({ year: "2024", month: "02", day: "29" })).toBe("2024-02-29");
    expect(isoFromParts({ year: "2024", month: "04", day: "31" })).toBe("");
  });
});

describe("partsFromIso", () => {
  it("round-trips a stored value so an existing birthday loads into the fields", () => {
    expect(partsFromIso("2025-12-18")).toEqual({ year: "2025", month: "12", day: "18" });
    expect(isoFromParts(partsFromIso("2025-12-18"))).toBe("2025-12-18");
  });

  it("treats a missing or malformed value as empty rather than throwing", () => {
    expect(partsFromIso(null)).toEqual({ year: "", month: "", day: "" });
    expect(partsFromIso("")).toEqual({ year: "", month: "", day: "" });
    expect(partsFromIso("18/12/2025")).toEqual({ year: "", month: "", day: "" });
    expect(partsFromIso("2025-12-18T00:00:00Z")).toEqual({ year: "", month: "", day: "" });
  });
});
