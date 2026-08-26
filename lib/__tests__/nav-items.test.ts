import { describe, expect, it } from "vitest";
import { dockItemsFor, navItemsFor } from "@/components/shell/nav-items";

/**
 * The invariant these protect is not "the right links appear" — it is that **the navigation
 * never offers a link that doesn't resolve**. That was a real shipping bug: a household that
 * enabled Calendar in onboarding got a nav link straight to a 404, while the features it left
 * OFF got a friendly placeholder. The reward for engaging with the product was a broken page.
 *
 * It is fixed structurally now rather than by gating: every feature in the catalogue has a real
 * route, and the unbuilt ones render an honest "not yet" screen. So these tests check the
 * shape Design-Spec §5 asks for, and `tests/e2e/family.spec.ts` checks that every href the
 * rendered nav actually offers resolves.
 */
describe("navItemsFor", () => {
  it("always offers Home, whatever the stored flags say", () => {
    expect(navItemsFor({}).map((i) => i.href)).toContain("/dashboard");
    // Even a malformed/empty settings row must not strand someone with no way home.
    expect(navItemsFor({ meals: false, calendar: false }).map((i) => i.href)).toContain("/dashboard");
  });

  it("hides an optional feature the household has not turned on", () => {
    const hrefs = navItemsFor({}).map((i) => i.href);
    expect(hrefs).not.toContain("/meals");
    expect(hrefs).not.toContain("/budget");
  });

  it("shows an optional feature as soon as its flag is on", () => {
    const hrefs = navItemsFor({ meals: true }).map((i) => i.href);
    expect(hrefs).toContain("/meals");
  });

  it("renders the spec §5 order when everything is enabled", () => {
    const hrefs = navItemsFor({
      meals: true,
      calendar: true,
      chores: true,
      ivy: true,
      photos: true,
      budget: true,
    }).map((i) => i.href);
    expect(hrefs).toEqual(["/dashboard", "/meals", "/calendar", "/chores", "/ivy", "/photos", "/budget"]);
  });

  it("keeps Family and Settings out of the feature nav — §5 puts them behind the avatar", () => {
    const hrefs = navItemsFor({ meals: true, calendar: true }).map((i) => i.href);
    expect(hrefs).not.toContain("/family");
    expect(hrefs).not.toContain("/settings");
  });
});

describe("dockItemsFor", () => {
  it("is at most the five §5 names, in the dock's own order", () => {
    const hrefs = dockItemsFor({
      meals: true,
      calendar: true,
      chores: true,
      ivy: true,
      photos: true,
      budget: true,
    }).map((i) => i.href);
    expect(hrefs).toEqual(["/dashboard", "/meals", "/calendar", "/chores", "/ivy"]);
  });

  it("never exceeds five, so the pill dock cannot overflow its fixed width", () => {
    const all = dockItemsFor({
      meals: true,
      calendar: true,
      chores: true,
      ivy: true,
      photos: true,
      budget: true,
    });
    expect(all.length).toBeLessThanOrEqual(5);
  });

  it("collapses to what is enabled, without leaving a gap", () => {
    expect(dockItemsFor({ ivy: true }).map((i) => i.href)).toEqual(["/dashboard", "/ivy"]);
  });

  it("only ever offers hrefs the full nav also offers", () => {
    const features = { meals: true, ivy: true };
    const nav = new Set(navItemsFor(features).map((i) => i.href));
    for (const item of dockItemsFor(features)) {
      expect(nav.has(item.href), item.href).toBe(true);
    }
  });
});
