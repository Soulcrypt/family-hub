import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateInTimeZone, hourInTimeZone } from "@/lib/utils";

// A single fixed instant, deliberately chosen (like format-birthday.test.ts's UTC-pin
// regression test) so this suite is deterministic rather than depending on "whatever `now()`
// happens to be when it runs" -- and so it exercises a REAL cross-timezone day boundary, not
// just a same-day hour shift: 02:30 UTC on 2026-08-25 is still Tuesday the 25th in Tokyo
// (UTC+9) but has already rolled back to Monday the 24th, 19:30, in Los Angeles (UTC-7 in
// August) -- a household west of UTC and one east of it disagree about both the hour AND the
// calendar day for the exact same instant. `hourInTimeZone`/`formatDateInTimeZone` exist
// precisely so the dashboard (app/(app)/dashboard/page.tsx) renders each household's own
// timezone's answer, not the server's -- the same reasoning `formatBirthday`'s UTC pin
// documents for a stored `date` column.
const INSTANT = new Date("2026-08-25T02:30:00Z");

// Each malformed-zone test uses a DISTINCT bad zone name on purpose: the report is deduped by
// zone for the lifetime of the process (so a broken row cannot flood the logs on every render),
// which means reusing one name here would make whichever test ran second silently see no call
// and pass for the wrong reason.
afterEach(() => {
  vi.restoreAllMocks();
});

describe("hourInTimeZone", () => {
  it("returns the UTC hour when the zone is UTC", () => {
    expect(hourInTimeZone(INSTANT, "UTC")).toBe(2);
  });

  it("returns the earlier local hour for a zone WEST of UTC (Los Angeles, UTC-7 in August)", () => {
    expect(hourInTimeZone(INSTANT, "America/Los_Angeles")).toBe(19);
  });

  it("returns the later local hour for a zone EAST of UTC (Tokyo, UTC+9)", () => {
    expect(hourInTimeZone(INSTANT, "Asia/Tokyo")).toBe(11);
  });

  it("falls back to the server's local hour for a malformed timezone rather than throwing", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(hourInTimeZone(INSTANT, "Not/AZone")).toBe(INSTANT.getHours());
    // The fallback must not be SILENT: a household whose stored zone has drifted from the
    // validated set would otherwise see server-local time forever with no signal anywhere.
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]?.[0]).toContain("Not/AZone");
  });

  it("reports a given bad zone only once, so a broken row cannot flood the logs on every render", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    hourInTimeZone(INSTANT, "Repeat/BadZone");
    hourInTimeZone(INSTANT, "Repeat/BadZone");
    hourInTimeZone(INSTANT, "Repeat/BadZone");
    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe("formatDateInTimeZone", () => {
  it("formats the UTC calendar date", () => {
    expect(formatDateInTimeZone(INSTANT, "UTC")).toBe("Tuesday, August 25, 2026");
  });

  it("formats the PREVIOUS calendar day for a zone west of UTC, at the same instant UTC has already turned over", () => {
    // This is the exact regression this helper exists to prevent: rendering the instant
    // without pinning `timeZone` (or pinning the server's zone instead of the household's)
    // would print "Tuesday" here, a day ahead of what a household actually in Los Angeles is
    // living through at 7:30pm Monday evening.
    expect(formatDateInTimeZone(INSTANT, "America/Los_Angeles")).toBe("Monday, August 24, 2026");
  });

  it("formats the same calendar date for a zone east of UTC that hasn't rolled over yet", () => {
    expect(formatDateInTimeZone(INSTANT, "Asia/Tokyo")).toBe("Tuesday, August 25, 2026");
  });

  it("falls back to the server's local rendering for a malformed timezone rather than throwing", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const fallback = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(INSTANT);
    expect(formatDateInTimeZone(INSTANT, "Other/NotAZone")).toBe(fallback);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]?.[0]).toContain("Other/NotAZone");
  });
});
