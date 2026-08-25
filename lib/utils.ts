import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats a `household_members.birthday` (a plain `date`-typed column, e.g. "2015-03-03") for
 * display, or `null` when none is set. `timeZone: "UTC"` is required, not cosmetic: a bare
 * `"2015-03-03"` string parses as UTC midnight, and formatting that in any negative-offset
 * local time zone (most of the Americas) would print the day BEFORE the stored date.
 */
export function formatBirthday(birthday: string | null): string | null {
  if (!birthday) return null;
  const parsed = new Date(birthday);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    parsed,
  );
}

/**
 * The current wall-clock hour (0-23) IN a household's own timezone -- never the server's.
 * `households.timezone` is validated at write time against `Intl.supportedValuesOf("timeZone")`
 * plus "UTC" (lib/validation/schemas.ts's `TIME_ZONES`), so a bad zone name reaching here would
 * mean stored data has drifted from that invariant, not a normal runtime condition -- still,
 * this degrades to the server's own local hour rather than throwing and 500ing every visitor's
 * dashboard over one household's malformed row.
 *
 * `hourCycle: "h23"` (not the locale default, which can be 12-hour with an AM/PM part) is what
 * makes `formatToParts` hand back a plain "00".."23" string for the "hour" part -- exactly the
 * boundary values `greetingFor` (components/dashboard/greeting.tsx) switches on.
 */
export function hourInTimeZone(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).formatToParts(
      date,
    );
    const hourPart = parts.find((part) => part.type === "hour")?.value;
    const hour = hourPart ? Number.parseInt(hourPart, 10) : Number.NaN;
    return Number.isNaN(hour) ? date.getHours() : hour;
  } catch {
    return date.getHours();
  }
}

/**
 * "Today's date" for display, pinned to a household's own timezone -- the same reasoning as
 * `formatBirthday`'s UTC pin above, but for "right now" rather than a stored `date` column: a
 * household in a timezone behind the server's would otherwise see tomorrow's (or yesterday's)
 * date on its own dashboard. Falls back to the server's local rendering for a malformed zone,
 * matching `hourInTimeZone`'s degrade-rather-than-throw behavior above.
 */
export function formatDateInTimeZone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(
      date,
    );
  }
}
