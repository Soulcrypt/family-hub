import { describe, expect, it } from "vitest";
import { navItemsFor } from "@/components/shell/nav-items";

describe("navItemsFor", () => {
  it("always includes home, family and settings", () => {
    const hrefs = navItemsFor({ family: true, settings: true }).map((i) => i.href);
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/family");
    expect(hrefs).toContain("/settings");
  });

  it("omits features the household has not enabled", () => {
    const hrefs = navItemsFor({ family: true, settings: true }).map((i) => i.href);
    expect(hrefs).not.toContain("/meals");
    expect(hrefs).not.toContain("/calendar");
  });

  // Regression coverage for the shipping bug this task fixes: enabling a feature used to be
  // enough on its own to put a link in the nav, even though calendar/meals/chores/habits have
  // no screen built yet (SP2-SP5's job) -- so the moment a household turned one on, the nav
  // offered a link straight to a 404. `hasScreen` (lib/constants/features.ts) is the fact
  // that actually gates a nav link now; "enabled" alone is no longer sufficient.
  it("never includes a feature that has no screen yet, even when its flag is enabled", () => {
    const hrefs = navItemsFor({
      family: true,
      settings: true,
      calendar: true,
      meals: true,
      chores: true,
      habits: true,
    }).map((i) => i.href);
    expect(hrefs).toEqual(["/dashboard", "/family", "/settings"]);
  });

  it("keeps settings last even with every feature enabled", () => {
    const items = navItemsFor({
      family: true,
      settings: true,
      calendar: true,
      meals: true,
      chores: true,
      habits: true,
    });
    expect(items[items.length - 1]?.href).toBe("/settings");
  });

  it("still shows home, family and settings when enabled_features is empty", () => {
    // A hand-edited or partially-written household_settings row -- e.g. {} -- must not
    // strand the app with no way to reach Family or Settings. Locked features are always on
    // regardless of what the stored flags say.
    const hrefs = navItemsFor({}).map((i) => i.href);
    expect(hrefs).toEqual(["/dashboard", "/family", "/settings"]);
  });

  it("ignores an explicit false on a locked feature", () => {
    // Even a malformed row that explicitly turns off a locked feature can't remove it --
    // family/settings are not a real per-household choice.
    const hrefs = navItemsFor({ family: false, settings: false }).map((i) => i.href);
    expect(hrefs).toContain("/family");
    expect(hrefs).toContain("/settings");
  });
});
