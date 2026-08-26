import { describe, expect, it } from "vitest";
import { buildDailySummary } from "@/lib/dashboard/summary";

describe("buildDailySummary", () => {
  it("includes the date label and honest (never-fake) schedule/dinner fragments", () => {
    const summary = buildDailySummary("Wednesday, August 26");
    expect(summary).toBe("Wednesday, August 26 · no events yet · dinner not planned yet");
  });

  it("never invents specific counts or times, since no calendar/meal data exists yet", () => {
    const summary = buildDailySummary("Monday, January 5");
    expect(summary).not.toMatch(/\d+ events?/i);
    expect(summary).not.toMatch(/dinner at \d/i);
  });
});
