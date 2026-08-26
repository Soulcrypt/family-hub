import { describe, expect, it } from "vitest";
import { DEFAULT_WIDGETS, type WidgetKey } from "@/lib/constants/features";
import {
  addWidget,
  isFirstInGroup,
  isLastInGroup,
  moveWithinGroup,
  parseWidgetLayout,
  remainingWidgets,
  removeWidget,
  sanitizeWidgetKeys,
} from "@/lib/dashboard/layout";

describe("parseWidgetLayout", () => {
  it("falls back to DEFAULT_WIDGETS for a non-array value", () => {
    expect(parseWidgetLayout(null)).toEqual([...DEFAULT_WIDGETS]);
    expect(parseWidgetLayout(undefined)).toEqual([...DEFAULT_WIDGETS]);
    expect(parseWidgetLayout("weather")).toEqual([...DEFAULT_WIDGETS]);
    expect(parseWidgetLayout({ schedule: true })).toEqual([...DEFAULT_WIDGETS]);
  });

  it("falls back to DEFAULT_WIDGETS for an empty array", () => {
    expect(parseWidgetLayout([])).toEqual([...DEFAULT_WIDGETS]);
  });

  it("drops unknown keys but keeps known ones, preserving order", () => {
    expect(parseWidgetLayout(["weather", "budget", "news"])).toEqual(["weather", "news"]);
  });

  it("de-duplicates, keeping the first occurrence", () => {
    expect(parseWidgetLayout(["news", "weather", "news"])).toEqual(["news", "weather"]);
  });

  it("falls back to DEFAULT_WIDGETS when every element is unknown", () => {
    expect(parseWidgetLayout(["budget", "chores", 42, null])).toEqual([...DEFAULT_WIDGETS]);
  });

  it("passes through a valid full layout untouched", () => {
    const layout = ["dinner", "schedule", "photos", "news", "weather"];
    expect(parseWidgetLayout(layout)).toEqual(layout);
  });
});

describe("sanitizeWidgetKeys", () => {
  it("preserves a genuinely empty result rather than falling back to defaults", () => {
    expect(sanitizeWidgetKeys([])).toEqual([]);
  });

  it("drops unknown keys and dedupes, same as parseWidgetLayout", () => {
    expect(sanitizeWidgetKeys(["weather", "budget", "weather"])).toEqual(["weather"]);
  });

  it("degrades a non-array input to [] rather than throwing", () => {
    expect(sanitizeWidgetKeys(null)).toEqual([]);
    expect(sanitizeWidgetKeys("weather")).toEqual([]);
  });
});

describe("remainingWidgets", () => {
  it("returns widgets not present in the current layout, in catalogue order", () => {
    expect(remainingWidgets(["schedule", "dinner", "weather"])).toEqual(["photos", "news"]);
  });

  it("returns an empty list when every widget is present", () => {
    expect(remainingWidgets([...DEFAULT_WIDGETS])).toEqual([]);
  });
});

describe("addWidget / removeWidget", () => {
  it("removes a widget by key", () => {
    expect(removeWidget(["schedule", "dinner", "weather"], "dinner")).toEqual(["schedule", "weather"]);
  });

  it("removing an absent key is a no-op", () => {
    expect(removeWidget(["schedule"], "weather")).toEqual(["schedule"]);
  });

  it("adds a widget to the end", () => {
    expect(addWidget(["schedule"], "weather")).toEqual(["schedule", "weather"]);
  });

  it("adding an already-present widget is a no-op (no duplicate)", () => {
    expect(addWidget(["schedule", "weather"], "weather")).toEqual(["schedule", "weather"]);
  });
});

describe("moveWithinGroup", () => {
  // schedule/dinner = primary; weather/photos/news = secondary (widget-meta.ts).
  const layout: WidgetKey[] = ["schedule", "dinner", "weather", "photos", "news"];

  it("swaps a primary widget earlier with its primary neighbor", () => {
    expect(moveWithinGroup(layout, "dinner", "earlier")).toEqual(["dinner", "schedule", "weather", "photos", "news"]);
  });

  it("swaps a secondary widget later with its secondary neighbor", () => {
    expect(moveWithinGroup(layout, "weather", "later")).toEqual(["schedule", "dinner", "photos", "weather", "news"]);
  });

  it("is a no-op moving the first item in its group earlier", () => {
    expect(moveWithinGroup(layout, "schedule", "earlier")).toEqual(layout);
  });

  it("is a no-op moving the last item in its group later", () => {
    expect(moveWithinGroup(layout, "news", "later")).toEqual(layout);
  });

  it("never crosses group boundaries -- moving the last secondary later never touches a primary", () => {
    const secondaryOnly: WidgetKey[] = ["weather", "photos", "news"];
    expect(moveWithinGroup(secondaryOnly, "news", "later")).toEqual(secondaryOnly);
  });

  it("reorders correctly even when groups are interleaved in the stored array", () => {
    // A layout that (however it got this way) interleaves groups -- moveWithinGroup must still
    // only ever swap same-group members with each other.
    const interleaved: WidgetKey[] = ["schedule", "weather", "dinner", "photos", "news"];
    expect(moveWithinGroup(interleaved, "dinner", "earlier")).toEqual([
      "dinner",
      "weather",
      "schedule",
      "photos",
      "news",
    ]);
  });

  it("a key not present in the layout is a no-op", () => {
    expect(moveWithinGroup(["schedule", "weather"], "dinner", "earlier")).toEqual(["schedule", "weather"]);
  });
});

describe("isFirstInGroup / isLastInGroup", () => {
  const layout: WidgetKey[] = ["schedule", "dinner", "weather", "photos", "news"];

  it("identifies group boundaries for disabling reorder buttons", () => {
    expect(isFirstInGroup(layout, "schedule")).toBe(true);
    expect(isFirstInGroup(layout, "dinner")).toBe(false);
    expect(isLastInGroup(layout, "dinner")).toBe(true);
    expect(isLastInGroup(layout, "schedule")).toBe(false);

    expect(isFirstInGroup(layout, "weather")).toBe(true);
    expect(isLastInGroup(layout, "news")).toBe(true);
    expect(isFirstInGroup(layout, "photos")).toBe(false);
    expect(isLastInGroup(layout, "photos")).toBe(false);
  });
});
