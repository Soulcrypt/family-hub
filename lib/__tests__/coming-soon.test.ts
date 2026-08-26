import { describe, expect, it } from "vitest";
import { comingSoonLine, UNBUILT_FEATURES } from "@/lib/constants/coming-soon";
import type { EnabledFeatures } from "@/lib/constants/features";

/**
 * SP1 Foundation design review collapsed the dashboard's four "Coming soon" CARDS into one
 * quiet line (app/(app)/dashboard/page.tsx) -- these tests pin that the line still tells the
 * truth the cards told: a feature the household already turned ON in onboarding (just has no
 * screen yet) reads differently from one that was NEVER turned on at all. See
 * lib/constants/coming-soon.ts's doc comments for the full "why".
 */
describe("comingSoonLine", () => {
  it("returns empty for no unbuilt features", () => {
    expect(comingSoonLine([], {})).toBe("");
  });

  it("uses the existing single-feature sentence verbatim when only one feature is unbuilt and disabled", () => {
    const line = comingSoonLine([{ key: "calendar", label: "Calendar" }], {});
    expect(line).toBe("Calendar arrives soon — turn it on in Settings when you’re ready.");
  });

  it("uses the existing single-feature sentence verbatim when only one feature is unbuilt and enabled", () => {
    const enabledFeatures: EnabledFeatures = { calendar: true };
    const line = comingSoonLine([{ key: "calendar", label: "Calendar" }], enabledFeatures);
    expect(line).toBe("Calendar is on — its screen is still on the way.");
  });

  it("names every feature when all unbuilt features share the disabled state, matching the demo household's default", () => {
    const line = comingSoonLine(UNBUILT_FEATURES, {});
    expect(line).toBe("Calendar, Meals, Chores and Habits aren’t turned on yet — turn them on in Settings when you’re ready.");
  });

  it("preserves the enabled-vs-never-enabled distinction as two clauses when both groups are non-empty", () => {
    const enabledFeatures: EnabledFeatures = { calendar: true, meals: true };
    const line = comingSoonLine(UNBUILT_FEATURES, enabledFeatures);

    expect(line).toContain("Calendar and Meals are on — their screens are still on the way.");
    expect(line).toContain("Chores and Habits aren’t turned on yet — turn them on in Settings when you’re ready.");
    // Genuinely distinct wording -- not the same clause repeated for both groups.
    expect(line).not.toContain("Calendar and Meals aren’t turned on yet");
    expect(line).not.toContain("Chores and Habits are on");
  });
});
