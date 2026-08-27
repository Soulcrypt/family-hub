import { requireAccountMembership, getActiveMember } from "@/lib/auth/active-member";
import { canEditSettings, isAdminProfile } from "@/lib/auth/permissions";
import { createServerClient } from "@/lib/supabase/server";
import { parseEnabledFeatures } from "@/lib/constants/features";
import { TIME_ZONES } from "@/lib/validation/schemas";
import { HouseholdSettingsForm } from "@/components/settings/household-settings-form";

/**
 * Edits the household's name, timezone, week-start day, and optional features. All four
 * are `households`/`household_settings` columns scoped by `household_id`, updated by
 * app/(app)/settings/actions.ts's `updateHouseholdAction`/`updateFeaturesAction`.
 *
 * `canEdit` combines two independent things, on purpose:
 *  - `canEditSettings(account.role)` -- the AUTHENTICATED account's real authority. This is
 *    the actual security boundary; both server actions re-check it themselves regardless of
 *    what this page renders.
 *  - `isAdminProfile(activeMember?.role ?? account.role)` -- a display-only nicety for the
 *    "shared device switched to a child's profile" case (lib/auth/active-member.ts). Falls
 *    back to the account's own role when no profile has ever been switched to.
 * See lib/auth/permissions.ts's `isAdminProfile` doc comment for why these are kept separate
 * rather than folded into one check.
 */
export default async function SettingsHouseholdPage() {
  const account = await requireAccountMembership();
  const activeMember = await getActiveMember();
  const supabase = await createServerClient();

  const [{ data: household }, { data: settings }] = await Promise.all([
    supabase.from("households").select("name, timezone, week_start").eq("id", account.household_id).maybeSingle(),
    supabase
      .from("household_settings")
      .select("enabled_features")
      .eq("household_id", account.household_id)
      .maybeSingle(),
  ]);

  const canEdit = canEditSettings(account.role) && isAdminProfile(activeMember?.role ?? account.role);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="text-[20px] font-bold tracking-[-0.01em] text-text">Household</h2>
        <p className="mt-1 text-[14px] text-text-secondary">Your household&rsquo;s name, timezone, and features.</p>
        {/* &rsquo; renders the same curly apostrophe (’) this codebase's regular UI copy uses
            elsewhere (e.g. components/family/member-form.tsx's "They’ll no longer appear…") --
            see AGENTS.md Task 15 context #7: only MAPPED ERROR STRINGS use a straight ASCII
            apostrophe, not ordinary page copy like this. */}
      </header>
      <HouseholdSettingsForm
        household={{
          name: household?.name ?? "",
          timezone: household?.timezone ?? "UTC",
          weekStart: household?.week_start ?? 0,
        }}
        enabledFeatures={parseEnabledFeatures(settings?.enabled_features)}
        timeZones={TIME_ZONES}
        canEdit={canEdit}
      />
    </div>
  );
}
