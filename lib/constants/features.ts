/**
 * The household feature catalogue chosen during onboarding (Task 10) and later editable in
 * Settings (Task 15+). `family` and `settings` are always on — every household needs a
 * member roster and a place to change preferences — so they're `locked: true` and rendered
 * as checked, disabled checkboxes rather than real choices.
 *
 * Everything past `family`/`settings` has no screens yet (SP2–SP5 build them); they're
 * listed here so a household's choice is recorded now and the navigation lights up the
 * moment those sub-projects land, instead of forcing a second onboarding-style prompt later.
 *
 * `hasScreen` records that same fact explicitly — whether THIS codebase actually has a route
 * for the feature yet — independently of `enabled_features` (a household's choice) and
 * `locked` (whether that choice is real). A feature can be enabled with no screen (the
 * everyday state for calendar/meals/chores/habits right now): the choice is still recorded,
 * but nothing that reads this catalogue should ever turn that into a navigable link before
 * the screen exists. `components/shell/nav-items.ts`'s `navItemsFor()` is the consumer this
 * matters for — see its doc comment for what broke when a feature could be "enabled" without
 * `hasScreen` gating the link.
 */
export const FEATURES = [
  { key: "family", label: "Family", description: "Profiles, roles and birthdays", locked: true, hasScreen: true },
  { key: "settings", label: "Settings", description: "Household preferences", locked: true, hasScreen: true },
  { key: "calendar", label: "Calendar", description: "Shared family schedule", locked: false, hasScreen: false },
  { key: "meals", label: "Meals", description: "Recipes and weekly planning", locked: false, hasScreen: false },
  { key: "chores", label: "Chores", description: "Tasks, points and rewards", locked: false, hasScreen: false },
  { key: "habits", label: "Habits", description: "Daily streaks", locked: false, hasScreen: false },
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

/**
 * Narrows `household_settings.enabled_features` (a `Json` column — untyped at the database
 * boundary) into `EnabledFeatures` without an `any`/unsafe cast. Anything that isn't a plain
 * object, or isn't one of `FEATURES`'s own keys with a boolean value, is dropped rather than
 * trusted — this only ever reads a value this app itself wrote, but a stale or hand-edited
 * row should degrade to "nothing chosen yet," not throw.
 */
export function parseEnabledFeatures(value: unknown): EnabledFeatures {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const result: EnabledFeatures = {};
  for (const feature of FEATURES) {
    const raw = record[feature.key];
    if (typeof raw === "boolean") result[feature.key] = raw;
  }
  return result;
}
