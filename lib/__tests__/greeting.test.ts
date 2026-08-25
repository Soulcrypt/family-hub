import { describe, expect, it } from "vitest";
import { greetingFor } from "@/components/dashboard/greeting";

describe("greetingFor", () => {
  // Pinning the exact boundaries rather than a handful of "obviously morning/afternoon/evening"
  // hours: 5 and 11 are the first and last hour of "morning", 12 and 17 are the first and last
  // hour of "afternoon", 18 and 23 are the first and last hour of "evening", and 0 exercises the
  // wrap-around back to "evening" at midnight -- each one asserts the transition is exactly
  // where it's supposed to be, not merely "somewhere around there."
  it("returns 'Good morning' at the start of the morning window (5)", () => {
    expect(greetingFor(5)).toBe("Good morning");
  });

  it("returns 'Good morning' at the end of the morning window (11)", () => {
    expect(greetingFor(11)).toBe("Good morning");
  });

  it("returns 'Good afternoon' at the start of the afternoon window (12)", () => {
    expect(greetingFor(12)).toBe("Good afternoon");
  });

  it("returns 'Good afternoon' at the end of the afternoon window (17)", () => {
    expect(greetingFor(17)).toBe("Good afternoon");
  });

  it("returns 'Good evening' at the start of the evening window (18)", () => {
    expect(greetingFor(18)).toBe("Good evening");
  });

  it("returns 'Good evening' at the end of the evening window (23)", () => {
    expect(greetingFor(23)).toBe("Good evening");
  });

  it("returns 'Good evening' at midnight (0), wrapping around from 23", () => {
    expect(greetingFor(0)).toBe("Good evening");
  });
});
