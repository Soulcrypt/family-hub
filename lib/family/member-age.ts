/**
 * Age captions for a member row — Design-Spec §8.10/§11: "numbers over words," and the spec's
 * own correction note (docs/design/hearth/Design-Spec.md header): Ivy's age must be COMPUTED
 * from her real birthday (2025-12-18), never copied from the mock's "age 2" text. Every caller
 * that needs to show a member's age passes the current time explicitly rather than calling
 * `new Date()` internally, so this stays pure and unit-testable.
 */

/** Whole calendar months between `birthday` and `now`, not rounded — a day short of the next
 * month stays at the lower count. Returns `null` for a birthday string that doesn't parse. */
function monthsOld(birthday: string, now: Date): number | null {
  const born = new Date(birthday);
  if (Number.isNaN(born.getTime())) return null;

  let months = (now.getUTCFullYear() - born.getUTCFullYear()) * 12 + (now.getUTCMonth() - born.getUTCMonth());
  if (now.getUTCDate() < born.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * A human caption for a member's age, in the largest unit that reads naturally — spec §11
 * ("numbers over words"): "8 months old", "11 years old", or "< 1 month old" for a newborn who
 * hasn't reached a full month yet. `null` for a birthday that doesn't parse, matching
 * `formatBirthday`'s degrade-rather-than-throw convention (lib/utils.ts).
 */
export function ageCaption(birthday: string, now: Date): string | null {
  const months = monthsOld(birthday, now);
  if (months === null) return null;

  if (months < 1) return "< 1 month old";
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"} old`;

  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "year" : "years"} old`;
}

export type MemberCaptionInput = { birthday: string | null; hasLogin: boolean };

/**
 * The one-line caption a family-roster row shows under a member's name (mock 4h: "e-mail or a
 * descriptive caption"). This app has no way to read a member's email today — `household_members`
 * carries no email column, and `auth.users` isn't exposed to the client — so a member with their
 * own login gets a login-status caption instead of a fabricated address; a login-less member
 * with a birthday on file gets a computed age; anyone else gets a plain "no login yet" note,
 * matching the wording `components/settings/member-invite-list.tsx` already used.
 */
export function memberCaption(member: MemberCaptionInput, now: Date): string {
  if (member.hasLogin) return "Has their own login";
  if (member.birthday) {
    const age = ageCaption(member.birthday, now);
    if (age) return age;
  }
  return "No login yet";
}
