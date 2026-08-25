"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Json } from "@/lib/supabase/types";
import { createServerClient } from "@/lib/supabase/server";
import { householdSchema, memberSchema } from "@/lib/validation/schemas";
import { getAccountMembership, requireAccountMembership, setActiveMember } from "@/lib/auth/active-member";
import { canManageMembers } from "@/lib/auth/permissions";
import { isFeatureKey, type EnabledFeatures } from "@/lib/constants/features";

export type ActionState = { error: string | null };

// The exact message create_household() (supabase/migrations/0010_create_household_toctou_guard.sql)
// raises when the caller already has an active household -- kept as one constant so the
// comparison in createHouseholdAction below can't silently drift from what the database
// actually raises.
const DUPLICATE_HOUSEHOLD_MESSAGE = "you already have a household";

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
    name: formData.get("name"),
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
    // authenticated) falls through to the generic surface-the-message branch below --
    // create_household()'s own messages for those are already clean enough to show directly,
    // unlike GoTrue's auth errors elsewhere in this app.
    if (error.message === DUPLICATE_HOUSEHOLD_MESSAGE) {
      const membership = await requireAccountMembership();
      await setActiveMember(membership.id);
      redirect("/onboarding?step=members");
    }
    return { error: error.message };
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
    displayName: formData.get("displayName"),
    role: formData.get("role"),
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
  if (error) return { error: error.message };

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
  if (error) return { error: error.message };

  revalidatePath("/onboarding");
  return { error: null };
}

export async function finishOnboardingAction(): Promise<void> {
  redirect("/dashboard");
}
