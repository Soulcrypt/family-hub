/**
 * Picks a column count for the profile switcher's tile grid (app/switch/page.tsx) that stays
 * balanced for a realistic household size (2-6 members), rather than a fixed
 * `grid-cols-2 sm:grid-cols-3` breakpoint that happens to look fine at some counts and leaves a
 * single orphaned tile on its own row at others — 4 members in 3-per-row is exactly 3 + 1, the
 * ragged layout this task's brief calls out by name.
 *
 * Not a general bin-packing solver — deliberately a small lookup for the range that matters
 * here (a wall-mounted household switcher), tuned so no row this table ever produces for 2-6
 * has a lone last tile:
 *   2 -> 2 (one row)        3 -> 3 (one row)         4 -> 2 (2x2, not 3+1)
 *   5 -> 3 (3+2)            6 -> 3 (3+3)
 * A single member (1) gets 1 column (nothing to balance), and anything larger than 6 falls back
 * to 3 — the switcher's realistic ceiling stops at 6, so this only needs to degrade sanely
 * beyond it, not stay perfectly balanced for arbitrarily large households.
 */
export function columnsForMemberCount(count: number): number {
  if (count <= 1) return 1;
  if (count === 4) return 2;
  if (count <= 3) return count;
  return 3;
}
