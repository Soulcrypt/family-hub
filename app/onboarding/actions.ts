"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Json } from "@/lib/supabase/types";
import { createServerClient } from "@/lib/supabase/server";
import { householdSchema, memberSchema } from "@/lib/validation/schemas";
import { getAccountMembership, requireAccountMembership, setActiveMember } from "@/lib/auth/active-member";
import { canManageMembers } from "@/lib/auth/permissions";
import { isFeatureKey, DEFAULT_WIDGETS, type EnabledFeatures, type WidgetKey } from "@/lib/constants/features";
import { formField } from "@/lib/validation/form-field";

export type ActionState = { error: string | null };

// The exact message create_household() (supabase/migrations/0010_create_household_toctou_guard.sql)
// raises when the caller already has an active household -- kept as one constant so the
// comparison in createHouseholdAction below can't silently drift from what the database
// actually raises.
const DUPLICATE_HOUSEHOLD_MESSAGE = "you already have a household";

/**
 * The same defect app/(auth)/actions.ts's `mapSignUpError` exists to fix, applied here: a raw
 * Postgres/PostgREST `error.message` (constraint names, internal column references, RLS
 * "permission denied for table X" text, connection/timeout errors -- none of it written for an
 * end user) must never reach the UI verbatim. Every call site below has already special-cased
 * the one error it can say something specific and useful about (the duplicate-household race
 * in createHouseholdAction); everything else -- including anything unrecognized -- falls
 * through to this one generic, always-safe message per action.
 */
function genericErrorFor(action: "household" | "member" | "features" | "location" | "widgets"): string {
  switch (action) {
    case "household":
      return "We couldn't create your household. Please try again.";
    case "member":
      return "We couldn't add this family member. Please try again.";
    case "features":
      return "We couldn't save your features. Please try again.";
    case "location":
      return "We couldn't save your location. Please try again.";
    case "widgets":
      return "We couldn't save your widgets. Please try again.";
  }
}

export async function createHouseholdAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Resumability guard, checked BEFORE validating the submitted form: a second tab, a double
  // submit, or a browser-back resubmission of a stale form could reach here after this
  // account already has a household. create_household() has no idempotency of its own --
  // calling it again would mint a SECOND household and leave the account with two active
  // household_members rows, which every AuthorityRole lookup afterward treats as an
  // unrecoverable ambiguity (MultipleHouseholdMembershipsError). Checking this first (rather
  // than after the zod parse below) means a stale/invalid resubmission from an already-
  // onboarded account gets bounced forward immediately instead of surfacing a pointless
  // validation error for data that's about to be discarded anyway.
  const existing = await getAccountMembership();
  if (existing) {
    await setActiveMember(existing.id);
    redirect("/onboarding?step=members");
  }

  const parsed = householdSchema.safeParse({
    name: formField(formData, "name"),
    timezone: formData.get("timezone") || "UTC",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details" };

  const supabase = await createServerClient();
  const { error } = await supabase.rpc("create_household", {
    p_name: parsed.data.name,
    p_timezone: parsed.data.timezone,
  });
  if (error) {
    // The getAccountMembership() guard above narrows this race but cannot fully close it:
    // two genuinely concurrent submissions (two tabs, or a double-click landing inside the
    // same event-loop tick before React disables the button) can both pass that read before
    // either transaction commits. create_household() itself now closes the window with an
    // advisory lock plus its own re-check (migration 0010) and raises this specific,
    // distinguishable message when it loses that race against an earlier call from the same
    // account. Treat it exactly like the pre-emptive guard above -- bounce forward, not an
    // error -- since from the user's point of view they DO have a household now, just not
    // the one this particular call tried to create; a double-click should land them on step
    // 3, not show them an error. Every other error (bad name, bad timezone, not
    // authenticated, a genuine DB/RLS fault) falls through to `genericErrorFor("household")`
    // below -- a raw `error.message` here is Postgres/PostgREST text, not user-facing copy
    // (see that function's doc comment).
    if (error.message === DUPLICATE_HOUSEHOLD_MESSAGE) {
      const membership = await requireAccountMembership();
      await setActiveMember(membership.id);
      redirect("/onboarding?step=members");
    }
    return { error: genericErrorFor("household") };
  }

  const membership = await requireAccountMembership();
  await setActiveMember(membership.id);

  // redirect() (like the sibling signUp()/signIn() actions in app/(auth)/actions.ts) rather
  // than returning success state for the client to router.push(): this page's own
  // resumability guard re-renders the CURRENT url the instant `membership` exists, and
  // revalidatePath() alone would let that swap this step's content out from under the
  // client before its own effect ever got to update the address bar -- leaving the URL
  // reading "step=household" while the screen already shows "step=members". redirect()
  // updates both atomically.
  redirect("/onboarding?step=members");
}

export async function addMemberAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = memberSchema.safeParse({
    displayName: formField(formData, "displayName"),
    role: formField(formData, "role"),
    color: formData.get("color") || "#C4643C",
    birthday: formData.get("birthday") || "",
    hasLogin: formData.get("hasLogin") === "on",
    email: formData.get("email") || "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details" };

  // Authority check against the ACCOUNT's role -- never the active-member cookie.
  const account = await requireAccountMembership();
  if (!canManageMembers(account.role)) return { error: "You do not have permission to add members" };

  // Onboarding only ever adds login-less members directly (accept_invite, Task 14, is the
  // only path that attaches a real account to a member row) -- user_id: null both matches
  // that and is required by members_insert_admins' own WITH CHECK.
  const supabase = await createServerClient();
  const { error } = await supabase.from("household_members").insert({
    household_id: account.household_id,
    display_name: parsed.data.displayName,
    role: parsed.data.role,
    color: parsed.data.color,
    birthday: parsed.data.birthday || null,
    user_id: null,
  });
  if (error) return { error: genericErrorFor("member") };

  revalidatePath("/onboarding");
  return { error: null };
}

export async function saveFeaturesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await requireAccountMembership();
  if (!canManageMembers(account.role)) return { error: "You do not have permission to change features" };

  const enabled: EnabledFeatures = { family: true, settings: true };
  for (const key of formData.getAll("features")) {
    // isFeatureKey() rejects anything not in FEATURES itself -- a crafted POST naming an
    // unknown key is dropped here rather than written into enabled_features and relying on
    // parseEnabledFeatures() to filter out again on every future read.
    if (typeof key === "string" && isFeatureKey(key)) enabled[key] = true;
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("household_settings")
    .update({ enabled_features: enabled as Json })
    .eq("household_id", account.household_id);
  if (error) return { error: genericErrorFor("features") };

  revalidatePath("/onboarding");
  return { error: null };
}

// Local rather than in lib/validation/schemas.ts -- this task's brief scopes file edits to
// app/onboarding/** and a short list of others, and lib/validation/schemas.ts isn't on it.
// A single freeform label is genuinely all this step can collect for real right now (see
// saveLocationAction's own doc comment), so a small local schema here doesn't cost the reuse
// a dedicated shared schema would normally buy.
const locationSchema = z.object({
  label: z
    .string()
    .trim()
    .max(100, "Keep it under 100 characters")
    .optional()
    .or(z.literal("")),
});

/**
 * Onboarding step 3/5 (mock 4d, "calendars & location"). Google Calendar OAuth and HEY's ICS
 * subscription (the other two controls the mock shows on this screen) don't exist in this
 * codebase yet -- Google's OAuth app isn't configured, and there is no ICS-fetching backend at
 * all -- so this action only ever persists the one piece of this step that's genuinely real: a
 * free-text "home location" label, written to `household_settings.weather_location` (an
 * existing, so-far-unused `Json` column -- this is what it was for). No lat/long, no geocoding,
 * no "detected" badge the mock shows: there's no geocoding service wired up to produce one.
 * An empty label is valid -- this step is skippable per spec, and "Skip for now"
 * (components/onboarding/step-location.tsx) is a plain navigation Link that never calls this
 * action at all, so a blank submit and a Skip both leave `weather_location` alone/empty.
 */
export async function saveLocationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await requireAccountMembership();
  if (!canManageMembers(account.role)) return { error: "You do not have permission to change household settings" };

  const parsed = locationSchema.safeParse({ label: formField(formData, "label") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details" };

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("household_settings")
    .update({ weather_location: (parsed.data.label ? { label: parsed.data.label } : null) as Json })
    .eq("household_id", account.household_id);
  if (error) return { error: genericErrorFor("location") };

  revalidatePath("/onboarding");
  return { error: null };
}

const WIDGET_KEYS: ReadonlySet<string> = new Set(DEFAULT_WIDGETS);

function isWidgetKey(value: string): value is WidgetKey {
  return WIDGET_KEYS.has(value);
}

/**
 * Onboarding step 5/5 (mock 4e, "pick widgets"). Writes the caller's own starter dashboard
 * layout into `member_dashboard_layouts` (supabase/migrations/0020_dashboard_widget_layout.sql)
 * -- the real widget-layout table another concurrent task built, keyed by `member_id` rather
 * than `household_id` (a shared kiosk can be attributed to a login-less child with no
 * dashboard of their own, so layouts are genuinely per-member). This is an upsert, not an
 * insert: the table's own column default already seeds every new row with the same five keys
 * `DEFAULT_WIDGETS` names, so a household that lands here without ever having a row yet still
 * gets a sane layout even if this action were skipped -- this just lets onboarding's own choice
 * (the pre-checked five, editable) win instead.
 *
 * The table's own `guard_dashboard_widget_layout()` trigger independently rejects any key
 * outside the same five and any duplicate -- `isWidgetKey` filtering here is a matching
 * application-layer check, not a substitute for it.
 */
export async function saveWidgetsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await requireAccountMembership();

  const widgets: WidgetKey[] = [];
  for (const key of formData.getAll("widgets")) {
    if (typeof key === "string" && isWidgetKey(key) && !widgets.includes(key)) widgets.push(key);
  }

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("member_dashboard_layouts")
    .upsert(
      { member_id: account.id, household_id: account.household_id, widgets: widgets as Json },
      { onConflict: "member_id" },
    );
  if (error) return { error: genericErrorFor("widgets") };

  revalidatePath("/onboarding");
  return { error: null };
}

export async function finishOnboardingAction(): Promise<void> {
  redirect("/dashboard");
}
