/**
 * The household feature catalogue chosen during onboarding (Task 10) and later editable in
 * Settings (Task 15+). `family` and `settings` are always on — every household needs a
 * member roster and a place to change preferences — so they're `locked: true` and rendered
 * as checked, disabled checkboxes rather than real choices.
 *
 * Everything past `family`/`settings` has no screens yet (SP2–SP5 build them); they're
 * listed here so a household's choice is recorded now and the navigation lights up the
 * moment those sub-projects land, instead of forcing a second onboarding-style prompt later.
 */
export const FEATURES = [
  { key: "family", label: "Family", description: "Profiles, roles and birthdays", locked: true },
  { key: "settings", label: "Settings", description: "Household preferences", locked: true },
  { key: "calendar", label: "Calendar", description: "Shared family schedule", locked: false },
  { key: "meals", label: "Meals", description: "Recipes and weekly planning", locked: false },
  { key: "chores", label: "Chores", description: "Tasks, points and rewards", locked: false },
  { key: "habits", label: "Habits", description: "Daily streaks", locked: false },
] as const;

export type FeatureKey = (typeof FEATURES)[number]["key"];

export type EnabledFeatures = Partial<Record<FeatureKey, boolean>>;

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
