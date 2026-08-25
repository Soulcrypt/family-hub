import { describe, expect, it } from "vitest";
import { navItemsFor } from "@/components/shell/nav-items";
import type { NavItem } from "@/components/shell/nav-items";
import { splitBottomNavItems } from "@/components/shell/bottom-nav";

/**
 * The invariant BottomNav must hold: every item navItemsFor() returns must be reachable
 * from the bottom navigation -- either as one of the directly-visible tabs, or through
 * whatever "More" discloses. Declaration order in nav-items.ts's `ALL` must never be able to
 * push an item out of BOTH.
 *
 * This is a reachability check, not a rendering check: BottomNav has no route mounted under
 * it yet (Task 13 is the first), so this exercises the same pure split BottomNav renders
 * from, rather than the component tree itself.
 *
 * Since the `hasScreen` fix (lib/constants/features.ts, nav-items.ts), every combo below
 * produces at most 3 real items, so none of them actually exercises the overflow/slicing
 * branch anymore -- the synthetic-data test below this describe block covers that directly.
 */
describe("BottomNav reachability", () => {
  const combos: Array<Record<string, boolean>> = [
    {},
    { family: true, settings: true },
    { family: true, settings: true, calendar: true },
    { family: true, settings: true, calendar: true, meals: true, chores: true },
    { family: true, settings: true, calendar: true, meals: true, chores: true, habits: true },
  ];

  it.each(combos)("every item is reachable for features=%o", (features) => {
    const items = navItemsFor(features);
    const { visible, overflow } = splitBottomNavItems(items);
    const reachableHrefs = new Set([...visible, ...overflow].map((item) => item.href));
    for (const item of items) {
      expect(reachableHrefs.has(item.href)).toBe(true);
    }
  });

  // As of this task's fix (gating every nav link on `hasScreen` -- lib/constants/features.ts,
  // components/shell/nav-items.ts), the real app can never produce more than 3 nav items
  // (Home, Family, Settings), so none of the combos above ever exercise the actual
  // overflow/slicing branch of splitBottomNavItems -- every real combo now fits within
  // MAX_VISIBLE. That's correct (no screen-less feature should ever force an overflow), but it
  // would leave the slicing logic itself untested until SP2+ adds a screen. This exercises it
  // directly with synthetic items, independent of what navItemsFor() can currently produce.
  it("splits into visible + overflow once item count exceeds MAX_VISIBLE, with every item reachable", () => {
    const synthetic: NavItem[] = Array.from({ length: 7 }, (_, i) => ({
      href: `/synthetic-${i}`,
      label: `Synthetic ${i}`,
      icon: "home",
      feature: null,
    }));

    const { visible, overflow } = splitBottomNavItems(synthetic);

    expect(visible.length + overflow.length).toBe(synthetic.length);
    expect(visible.length).toBeLessThanOrEqual(5);
    expect(overflow.length).toBeGreaterThan(0);

    const reachableHrefs = new Set([...visible, ...overflow].map((item) => item.href));
    for (const item of synthetic) {
      expect(reachableHrefs.has(item.href)).toBe(true);
    }
  });
});
