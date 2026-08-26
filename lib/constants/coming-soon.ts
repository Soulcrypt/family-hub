import { FEATURES, isFeatureEnabled, type EnabledFeatures, type FeatureKey } from "@/lib/constants/features";

/**
 * Copy is written per feature (not a single templated string) so the grammar reads naturally
 * regardless of whether the feature's own label is singular ("Calendar arrives"/"is") or
 * plural ("Meals arrive"/"are") -- see FEATURES, lib/constants/features.ts.
 *
 * Each feature carries TWO variants because "has no screen yet" and "is enabled" are
 * independent facts (Task 16's brief, point 2) -- a household can have turned a feature on
 * with no screen behind it yet, which is a genuinely different state from never having turned
 * it on at all, and deserves copy that says so instead of repeating advice that's already
 * stale:
 *   - `disabled`: the household hasn't turned this on. Reads as deliberately-not-yet-enabled
 *     rather than broken or empty -- it should understand it can turn the feature on in
 *     Settings, not wonder why the card is blank.
 *   - `enabled`: the household already turned this on. "Turn it on in Settings" would be
 *     actively wrong advice here -- it's already on, only the screen is still coming.
 *
 * SP1 Foundation design review collapsed the four "Coming soon" CARDS this copy used to fill
 * (app/(app)/dashboard/page.tsx) into a single quiet line (`comingSoonLine()` below) -- these
 * per-feature strings are preserved unchanged and still used verbatim whenever exactly one
 * feature falls in a given enabled/disabled group, so the exact wording a household has
 * already seen doesn't change out from under it.
 */
export const COMING_SOON_COPY: Partial<Record<FeatureKey, { enabled: string; disabled: string }>> = {
  calendar: {
    disabled: "Calendar arrives soon — turn it on in Settings when you’re ready.",
    enabled: "Calendar is on — its screen is still on the way.",
  },
  meals: {
    disabled: "Meals arrive soon — turn it on in Settings when you’re ready.",
    enabled: "Meals are on — their screen is still on the way.",
  },
  chores: {
    disabled: "Chores arrive soon — turn it on in Settings when you’re ready.",
    enabled: "Chores are on — their screen is still on the way.",
  },
  habits: {
    disabled: "Habits arrive soon — turn it on in Settings when you’re ready.",
    enabled: "Habits are on — their screen is still on the way.",
  },
};

function joinWithAnd(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

type UnbuiltFeature = { key: FeatureKey; label: string };

/**
 * Builds one clause of the coming-soon line for a GROUP of features that share the same
 * enabled/disabled state. A single-feature group reuses `COMING_SOON_COPY`'s existing,
 * already-shipped per-feature sentence verbatim (falling back to a generic sentence for any
 * feature `COMING_SOON_COPY` doesn't cover, exactly as `ComingSoonCard` used to). A
 * multi-feature group needs a genuinely different sentence shape -- "Calendar and Meals ARE
 * on", not each feature's own singular/plural verb repeated -- so it gets one generic,
 * grammatically-plural sentence naming every feature in the group instead.
 */
function groupSentence(features: UnbuiltFeature[], variant: "enabled" | "disabled"): string {
  if (features.length === 0) return "";
  if (features.length === 1) {
    const feature = features[0]!;
    const copy = COMING_SOON_COPY[feature.key];
    if (copy) return copy[variant];
    return variant === "enabled"
      ? `${feature.label} is on — its screen is still on the way.`
      : `${feature.label} isn’t turned on yet.`;
  }
  const labels = joinWithAnd(features.map((feature) => feature.label));
  return variant === "enabled"
    ? `${labels} are on — their screens are still on the way.`
    : `${labels} aren’t turned on yet — turn them on in Settings when you’re ready.`;
}

/**
 * SP1 Foundation design review: the dashboard's four "Coming soon" CARDS (roughly half the
 * visible canvas on a wall tablet, saying nothing is here yet) collapse into this single
 * quiet line. The honesty the four cards carried is preserved rather than dropped: a feature
 * a household already turned ON in onboarding (just has no screen yet) gets DIFFERENT copy
 * from one that was never turned on at all (see `COMING_SOON_COPY`'s doc comment) -- so when
 * both groups are non-empty this returns TWO sentences, one per group, rather than silently
 * collapsing the distinction into a single generic "on their way" line. When every unbuilt
 * feature shares one state, this is a single sentence -- see `groupSentence()`.
 */
export function comingSoonLine(unbuiltFeatures: readonly UnbuiltFeature[], enabledFeatures: EnabledFeatures): string {
  const enabled = unbuiltFeatures.filter((feature) => isFeatureEnabled(enabledFeatures, feature.key));
  const disabled = unbuiltFeatures.filter((feature) => !isFeatureEnabled(enabledFeatures, feature.key));
  return [groupSentence(enabled, "enabled"), groupSentence(disabled, "disabled")].filter(Boolean).join(" ");
}

/** Every `FEATURES` entry with no screen yet -- see lib/constants/features.ts's `hasScreen`. */
export const UNBUILT_FEATURES: readonly UnbuiltFeature[] = FEATURES.filter((feature) => !feature.hasScreen);
