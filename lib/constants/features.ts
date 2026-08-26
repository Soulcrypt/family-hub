/**
 * The household feature catalogue — Design-Spec §5 (navigation) and §8 (screens).
 *
 * `family` and `settings` are always on: every household needs a member roster and a place to
 * change preferences, so they're `locked: true` and render as checked, disabled rows during
 * onboarding rather than as real choices.
 *
 * `hasScreen` records whether THIS codebase has built the feature's screen yet, independently
 * of `enabled_features` (a household's choice) and `locked` (whether that choice is real).
 *
 * The three are genuinely independent, and conflating any two of them has already shipped a
 * bug here: gating nav links purely on "enabled" meant a household that turned Calendar on in
 * onboarding got a sidebar link straight to a 404. What replaced it is stricter than
 * `hasScreen` alone — every feature below now has a real route, and the ones that aren't built
 * render an honest "not yet" screen (`components/shell/coming-soon.tsx`) in the spec's own
 * empty-state language. So the navigation can show the full spec'd set without ever offering a
 * link that doesn't resolve, and `hasScreen` decides what that route SAYS rather than whether
 * the link exists.
 */
export const FEATURES = [
  { key: "meals", label: "Meals", description: "Recipes, planning and cook mode", locked: false, hasScreen: false },
  { key: "calendar", label: "Calendar", description: "Everyone's week in one place", locked: false, hasScreen: false },
  { key: "chores", label: "Chores", description: "Tasks, stars and rewards", locked: false, hasScreen: false },
  { key: "ivy", label: "Ivy", description: "Naps, milestones and bedtime", locked: false, hasScreen: false },
  { key: "photos", label: "Photos", description: "The family album", locked: false, hasScreen: false },
  { key: "budget", label: "Budget", description: "Mirrored from Rocket Money", locked: false, hasScreen: false },
  { key: "family", label: "Family", description: "Profiles, roles and colours", locked: true, hasScreen: true },
  { key: "settings", label: "Settings", description: "Household preferences", locked: true, hasScreen: true },
] as const;

export type FeatureKey = (typeof FEATURES)[number]["key"];

export type EnabledFeatures = Partial<Record<FeatureKey, boolean>>;

const FEATURE_KEYS: ReadonlySet<string> = new Set(FEATURES.map((feature) => feature.key));

/**
 * Narrows an arbitrary string to `FeatureKey`. `saveFeaturesAction` (app/onboarding/actions.ts)
 * uses this to filter `formData.getAll("features")` before writing — without it, a crafted
 * POST could write an arbitrary key (e.g. `{ arbitraryJunk: true }`) into
 * `household_settings.enabled_features`. Confined to the caller's own household by RLS, and
 * `parseEnabledFeatures()` below already filters unknown keys back out on read, but validating
 * on write is tighter than relying on every future reader to filter.
 */
export function isFeatureKey(value: string): value is FeatureKey {
  return FEATURE_KEYS.has(value);
}

export function isFeatureEnabled(features: EnabledFeatures, key: FeatureKey): boolean {
  return features[key] === true;
}

/** The catalogue entry for a key, or undefined. Callers that need the label/description. */
export function featureFor(key: FeatureKey) {
  return FEATURES.find((feature) => feature.key === key);
}

/**
 * Reads an arbitrary `household_settings.enabled_features` jsonb value into a typed map,
 * dropping anything that isn't a recognized key with a boolean value. A missing row, an empty
 * object, a hand-edit, or a value written by an older build all degrade to "nothing enabled"
 * rather than throwing.
 */
export function parseEnabledFeatures(value: unknown): EnabledFeatures {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: EnabledFeatures = {};
  for (const [key, flag] of Object.entries(value as Record<string, unknown>)) {
    if (isFeatureKey(key) && typeof flag === "boolean") out[key] = flag;
  }
  return out;
}

/** The five widgets a new household starts with — Design-Spec §8.1 and §8.11 step 6. */
export const DEFAULT_WIDGETS = ["schedule", "dinner", "weather", "photos", "news"] as const;
export type WidgetKey = (typeof DEFAULT_WIDGETS)[number];
