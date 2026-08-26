/**
 * The dashboard's one and only `<h1>` -- Design-Spec §8.1/§3: a time-aware greeting ("Good
 * morning / afternoon / evening, {firstName}.") at `Display` size (42/700 desktop) plus a
 * generated daily-summary subline. Ref: docs/design/hearth/mockups/2a.png ("Good evening,
 * Cody." / "Wednesday, August 26 · 2 events left · dinner at 6:30 · Ivy napped 1h 40m").
 *
 * SP1 Foundation's earlier dashboard greeted the whole HOUSEHOLD by name ("Good evening, The
 * Riveras") with a hero family-strip of avatars below it (components/dashboard/family-strip.tsx,
 * removed in this rebuild). The imported design supersedes that: mocks 2a/2f/3a greet whichever
 * PERSON the screen is currently attributed to (getActiveMember() -- lib/auth/active-member.ts
 * -- falling back to the signed-in account's own member row), and the top bar
 * (components/shell/top-bar.tsx) already carries the family's stacked avatars, so a second
 * avatar row on the page body would be redundant. `app/(app)/dashboard/page.tsx` passes just
 * the first token of that member's `display_name`.
 *
 * The long-name robustness this heading always needed (a household's chosen name could be
 * arbitrarily long; so can a person's) is unchanged from the previous build: no `truncate`
 * (white-space: nowrap already lost that fight against `break-words` once, clipping mid-word --
 * see the git history of this file), `text-balance` so a forced two-line wrap doesn't strand a
 * one-word widow, and a `lg:` type scale distinct from the phone size for the wall-mounted
 * kitchen tablet this is primarily read on from ~1.5m away.
 */

export type Greeting = "Good morning" | "Good afternoon" | "Good evening";

/**
 * Pure function, deliberately separated from any clock/timezone lookup so it can be unit
 * tested on fixed integers rather than "whatever hour it happens to be when the suite runs" --
 * see lib/dashboard/__tests__ conventions generally, and this file's own tests.
 *
 * Boundaries: morning is [5, 12), afternoon is [12, 18), evening is everything else --
 * [18, 24) and [0, 5), i.e. evening wraps across midnight rather than there being a separate
 * "night" greeting.
 */
export function greetingFor(hour: number): Greeting {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The first whitespace-separated token of a display name ("Elizabeth Garthwaite" -> "Elizabeth").
 * Spreads by Unicode code point rather than splitting on a plain space regex only because the
 * simplest correct implementation already is one -- `.split(" ")[0]` handles every real name
 * this app will see. A blank/whitespace-only name (should never happen -- household_members.
 * display_name has a non-empty CHECK constraint -- but this is UI code, not the database)
 * degrades to the full trimmed string rather than rendering "Good evening, ." with nothing
 * after the comma.
 */
export function firstNameOf(displayName: string): string {
  const trimmed = displayName.trim();
  const [first] = trimmed.split(/\s+/);
  return first && first.length > 0 ? first : trimmed;
}

export type DashboardGreetingProps = {
  firstName: string;
  /** The current hour (0-23) in the household's own timezone -- see `hourInTimeZone`. */
  hour: number;
  /** The generated daily-summary line -- see `buildDailySummary`, lib/dashboard/summary.ts. */
  summary: string;
};

export function DashboardGreeting({ firstName, hour, summary }: DashboardGreetingProps) {
  return (
    <header className="mb-8 text-center md:mb-10 md:text-left">
      <h1 className="min-w-0 text-balance break-words text-3xl font-bold tracking-tight sm:text-4xl lg:text-[42px]">
        {greetingFor(hour)}, {firstName}.
      </h1>
      <p className="mt-2 text-base text-text-secondary sm:text-lg lg:mt-3">{summary}</p>
    </header>
  );
}
