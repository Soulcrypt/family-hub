/**
 * The date arithmetic behind `components/family/birthday-picker.tsx`.
 *
 * Split out of the component so the awkward cases can be tested as data rather than driven
 * through three comboboxes — and there is one genuinely awkward case that a native
 * `<input type="date">` never has to handle. Because month, day and year are chosen
 * independently and in any order, a valid selection can be invalidated by a LATER change: pick
 * 31 January, then switch the month to February. JavaScript's own `Date` quietly rolls that
 * over (`new Date(2000, 1, 31)` is 2 March), which for a birthday means storing a date the
 * person did not choose. These functions refuse instead.
 */
export type BirthdayParts = { year: string; month: string; day: string };

/**
 * Days in a month, honouring the full leap-year rule (divisible by 4, except centuries, except
 * every 400th).
 *
 * With no year yet, February returns 29 rather than 28: someone filling the fields
 * month-first must still be able to pick 29 February, and narrowing the list early would make
 * a real birthday unselectable purely because of the order they happened to fill the form in.
 * With no month yet it returns 31, so the day list is never artificially short.
 */
export function daysInMonth(month: number | null, year: number | null): number {
  if (month === null) return 31;
  if (month === 2) {
    if (year === null) return 29;
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** Parses a stored `YYYY-MM-DD`. Anything else — null, empty, a localised format, a full
 * timestamp — is treated as "no birthday" rather than throwing. */
export function partsFromIso(iso: string | null | undefined): BirthdayParts {
  if (!iso) return { year: "", month: "", day: "" };
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return { year: "", month: "", day: "" };
  return { year: match[1] as string, month: match[2] as string, day: match[3] as string };
}

/**
 * Composes the three fields into the `YYYY-MM-DD` the form posts, or `""` when the selection is
 * incomplete or impossible.
 *
 * Empty is the right answer for both, and deliberately so: `memberSchema`
 * (lib/validation/schemas.ts) accepts `z.string().date()` or the empty string, birthday is
 * optional, and a half-filled or impossible date must never be stored as a real one.
 */
export function isoFromParts(parts: BirthdayParts): string {
  const { year, month, day } = parts;
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) return "";

  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (monthNumber < 1 || monthNumber > 12) return "";
  if (dayNumber < 1 || dayNumber > daysInMonth(monthNumber, Number(year))) return "";

  return `${year}-${month}-${day}`;
}
