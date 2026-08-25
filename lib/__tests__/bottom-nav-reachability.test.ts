import { describe, expect, it } from "vitest";
import { navItemsFor } from "@/components/shell/nav-items";
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
});
