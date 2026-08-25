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
