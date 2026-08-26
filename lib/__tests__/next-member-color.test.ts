import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEMBER_COLOR,
  MEMBER_COLOR_SWATCHES,
  nextAvailableMemberColor,
} from "@/lib/constants/member-color-swatches";

// The behaviour under test is not "returns a colour" -- it is "a parent who adds three children
// in a row, accepting the default every time, ends up with three DIFFERENT children". Member
// colour exists solely to tell people apart at a glance across a kitchen; a default that repeats
// defeats it silently, and nobody notices until the family strip is a row of identical circles.
describe("nextAvailableMemberColor", () => {
  it("starts at the first swatch for an empty household", () => {
    expect(nextAvailableMemberColor([])).toBe(DEFAULT_MEMBER_COLOR);
  });

  it("skips a colour that is already taken", () => {
    const [first, second] = MEMBER_COLOR_SWATCHES;
    expect(nextAvailableMemberColor([first.hex])).toBe(second.hex);
  });

  it("gives every member a DISTINCT colour when the defaults are accepted in a row", () => {
    const chosen: string[] = [];
    for (let i = 0; i < MEMBER_COLOR_SWATCHES.length; i++) {
      chosen.push(nextAvailableMemberColor(chosen));
    }
    expect(new Set(chosen).size).toBe(MEMBER_COLOR_SWATCHES.length);
  });

  it("ignores gaps -- picks the first FREE swatch, not the one after the last used", () => {
    const [first, second, third] = MEMBER_COLOR_SWATCHES;
    // second is free even though a later swatch is taken.
    expect(nextAvailableMemberColor([first.hex, third.hex])).toBe(second.hex);
  });

  it("matches case-insensitively, since a stored hex may be lower-case", () => {
    const [first, second] = MEMBER_COLOR_SWATCHES;
    expect(nextAvailableMemberColor([first.hex.toLowerCase()])).toBe(second.hex);
  });

  it("ignores colours that are not in the palette at all", () => {
    // A member whose colour predates the palette (or was set by an older build) must not
    // consume a slot -- otherwise the first real swatch gets skipped for no reason.
    expect(nextAvailableMemberColor(["#C4643C"])).toBe(DEFAULT_MEMBER_COLOR);
  });

  it("cycles rather than failing once every swatch is taken", () => {
    const all = MEMBER_COLOR_SWATCHES.map((swatch) => swatch.hex);
    const next = nextAvailableMemberColor(all);
    expect(MEMBER_COLOR_SWATCHES.some((swatch) => swatch.hex === next)).toBe(true);
  });
});
