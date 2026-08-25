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

  it("includes a feature as soon as its flag is on", () => {
    const hrefs = navItemsFor({ family: true, settings: true, meals: true }).map((i) => i.href);
    expect(hrefs).toContain("/meals");
  });

  it("keeps settings last", () => {
    const items = navItemsFor({ family: true, settings: true, meals: true, calendar: true });
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
