"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { requireAccountMembership } from "@/lib/auth/active-member";
import { canEditSettings } from "@/lib/auth/permissions";
import { householdSchema, appearanceSchema } from "@/lib/validation/schemas";
import { isFeatureKey, type EnabledFeatures } from "@/lib/constants/features";
import type { Json } from "@/lib/supabase/types";

export type SettingsState = { error: string | null };

/**
 * See app/(app)/family/actions.ts's identical `genericErrorFor` for why: a raw Postgres/
 * PostgREST `error.message` (constraint names, RLS "permission denied" text, connection
 * errors) must never reach the UI verbatim. Each action below already special-cases the one
 * error it can say something specific and useful about; everything else falls through to one
 * generic, always-safe message per action.
 */
function genericErrorFor(action: "household" | "features" | "appearance"): string {
  switch (action) {
    case "household":
      return "We couldn't save your household settings. Please try again.";
    case "features":
      return "We couldn't save your features. Please try again.";
    case "appearance":
      return "We couldn't save your appearance settings. Please try again.";
  }
}

/**
 * Updates the household's name, timezone, and week-start day. Gated on `canEditSettings`,
 * derived SOLELY from `requireAccountMembership()`'s authoritative role -- never from the
 * `fh_active_member` attribution cookie (see that module's doc comment). The `households`
 * table's own `households_update_admins` RLS policy enforces the identical rule at the
 * database layer; the 42501 branch below is a backstop for that, not the primary control.
 */
export async function updateHouseholdAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const parsed = householdSchema.safeParse({
    name: formData.get("name"),
    timezone: formData.get("timezone") || "UTC",
    weekStart: formData.get("weekStart") ?? 0,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details" };

  const account = await requireAccountMembership();
  if (!canEditSettings(account.role)) {
    return { error: "You do not have permission to change household settings" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("households")
    .update({ name: parsed.data.name, timezone: parsed.data.timezone, week_start: parsed.data.weekStart })
    .eq("id", account.household_id);

  if (error) {
    if (error.code === "42501") return { error: "You do not have permission to change that" };
    return { error: genericErrorFor("household") };
  }

  revalidatePath("/settings/household");
  // Refreshes the shared (app) layout too -- the sidebar/bottom-nav render the household name
  // and (via updateFeaturesAction below) the nav item list, both stale otherwise.
  revalidatePath("/settings/household", "layout");
  return { error: null };
}

/**
 * Updates the household's optional feature flags. `family` and `settings` are forced to `true`
 * regardless of what was submitted -- they are `locked: true` in the FEATURES catalogue
 * (lib/constants/features.ts) and navigation (components/shell/nav-items.ts) assumes both are
 * always on; disabling either here would strand the household with no way back to Family or
 * Settings. Every OTHER submitted key is validated against `isFeatureKey()` before being
 * written, so a crafted POST naming an unrecognized key can't land in
 * `household_settings.enabled_features` at all.
 */
export async function updateFeaturesAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const account = await requireAccountMembership();
  if (!canEditSettings(account.role)) {
    return { error: "You do not have permission to change features" };
  }

  const enabled: EnabledFeatures = { family: true, settings: true };
  for (const key of formData.getAll("features")) {
    if (typeof key === "string" && isFeatureKey(key)) enabled[key] = true;
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("household_settings")
    .update({ enabled_features: enabled as Json })
    .eq("household_id", account.household_id);

  if (error) {
    if (error.code === "42501") return { error: "You do not have permission to change that" };
    return { error: genericErrorFor("features") };
  }

  revalidatePath("/settings/household");
  revalidatePath("/settings/household", "layout");
  return { error: null };
}

/**
 * Updates the household's accent-color override, stored as `{ accent }` inside
 * `household_settings.theme_defaults` (a `Json` column with no other reserved shape today).
 * Purely a stored preference for now -- nothing in the app reads it back into the rendered
 * palette yet (the pinned brand accent in app/globals.css is still what actually paints), so
 * this action's only job is to validate and persist it for a future task to wire up.
 */
export async function updateAppearanceAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const parsed = appearanceSchema.safeParse({ accent: formData.get("accent") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Pick a valid color" };

  const account = await requireAccountMembership();
  if (!canEditSettings(account.role)) {
    return { error: "You do not have permission to change appearance settings" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("household_settings")
    .update({ theme_defaults: { accent: parsed.data.accent } as Json })
    .eq("household_id", account.household_id);

  if (error) {
    if (error.code === "42501") return { error: "You do not have permission to change that" };
    return { error: genericErrorFor("appearance") };
  }

  revalidatePath("/settings/appearance");
  return { error: null };
}
