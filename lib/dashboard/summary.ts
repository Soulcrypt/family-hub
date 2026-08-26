/**
 * Design-Spec §8.1/§3: "Subline is a generated daily summary sentence (events left · dinner
 * status · Ivy's nap)." The mock (docs/design/hearth/mockups/2a.png) shows real numbers
 * because it's mocking a fully-built app -- this build has no calendar or meal-plan tables
 * (lib/constants/features.ts: `calendar`/`meals` both `hasScreen: false`), and no Ivy tracker
 * widget exists at all in the default five. This task's brief is explicit: "Never fake data."
 * So the honest version of this sentence names exactly the two things the dashboard's OTHER
 * widgets also render as empty states -- no events, no dinner planned -- and says nothing
 * about Ivy, since there is no naps/bedtime data source to summarize yet.
 *
 * A single function rather than three independent honesty checks scattered across widgets:
 * when a calendar/meal-plan data source exists, this is the one place that sentence's wording
 * needs to change, in sync with schedule-widget.tsx/dinner-widget.tsx's own empty-vs-real
 * branches.
 */
export function buildDailySummary(dateLabel: string): string {
  return `${dateLabel} · no events yet · dinner not planned yet`;
}
