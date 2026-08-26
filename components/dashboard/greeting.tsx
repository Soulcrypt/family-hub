/**
 * The dashboard's one and only `<h1>` (app/(app)/dashboard/page.tsx renders no other heading at
 * that level) -- a time-appropriate greeting plus the household's name, with today's date (in
 * the household's own timezone -- see `formatDateInTimeZone`, lib/utils.ts) underneath.
 *
 * SP1 Foundation design review: the primary surface for this whole app is a wall-mounted
 * kitchen tablet, glanced at from ~1.5m away -- so this heading carries its OWN type scale
 * (`lg:text-6xl`/`sm:text-4xl`) rather than the single `text-3xl` it used to render at every
 * width from a 390px phone up through a 1280px kitchen display. It also used to `truncate`
 * (white-space: nowrap) alongside `break-words` -- `truncate` wins that fight, so the
 * household's own name (the warmest string in the product) clipped mid-word on every phone
 * ("Good afternoon, The Ri…", measured scrollWidth 473 vs clientWidth 342 at 390px). `truncate`
 * is gone; `break-words`/`min-w-0` alone let a long name wrap onto a second line instead of
 * overflowing -- see tests/e2e/responsive.spec.ts's "nothing overflows horizontally" sweep,
 * which this must stay green against.
 */

export type Greeting = "Good morning" | "Good afternoon" | "Good evening";

/**
 * Pure function, deliberately separated from any clock/timezone lookup so it can be unit
 * tested on fixed integers rather than "whatever hour it happens to be when the suite runs" --
 * see lib/__tests__/greeting.test.ts, which pins every boundary this switches on (5, 11, 12,
 * 17, 18, 23, and the midnight wrap at 0) rather than trusting them to hold by inspection.
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

export type DashboardGreetingProps = {
  householdName: string;
  /** The current hour (0-23) in the household's own timezone -- see `hourInTimeZone`. */
  hour: number;
  /** Today's date, already formatted in the household's own timezone -- see `formatDateInTimeZone`. */
  dateLabel: string;
};

export function DashboardGreeting({ householdName, hour, dateLabel }: DashboardGreetingProps) {
  return (
    <header className="mb-8 text-center">
      <h1 className="min-w-0 break-words text-3xl sm:text-4xl lg:text-6xl">
        {greetingFor(hour)}, {householdName}
      </h1>
      <p className="mt-2 text-base text-muted-foreground sm:text-lg lg:mt-3 lg:text-2xl">{dateLabel}</p>
    </header>
  );
}
