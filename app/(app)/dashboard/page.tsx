import { requireAccountMembership, getActiveMember } from "@/lib/auth/active-member";
import { createServerClient } from "@/lib/supabase/server";
import { parseEnabledFeatures, FEATURES, isFeatureEnabled, type FeatureKey } from "@/lib/constants/features";
import { formatDateInTimeZone, hourInTimeZone } from "@/lib/utils";
import { DashboardGreeting } from "@/components/dashboard/greeting";
import { FamilyStrip } from "@/components/dashboard/family-strip";

/**
 * A deliberately STATIC home screen -- the configurable, drag-and-drop widget dashboard the
 * product vision eventually wants is SP5's job, once real verticals (calendar/meals/chores/
 * habits) actually exist to put widgets on top of. Building a layout engine now, before there
 * is a single real widget to hang on it, would get its abstraction wrong; see this task's
 * brief. Until then, this page has exactly three jobs: greet the household, show who's in it,
 * and tell a household that skipped a feature in onboarding where to go turn it on.
 *
 * `requireAccountMembership()` (not the nullable `getAccountMembership()`) is safe here for
 * the same reason app/(app)/family/page.tsx documents: app/(app)/layout.tsx already redirects
 * any account with no household to /onboarding before this page ever renders, so an absent
 * membership at this point would be a bug, not a normal state to branch on.
 */
export default async function DashboardPage() {
  const account = await requireAccountMembership();
  const supabase = await createServerClient();

  const [{ data: household }, { data: settings }, { data: members }] = await Promise.all([
    supabase.from("households").select("name, timezone").eq("id", account.household_id).maybeSingle(),
    supabase.from("household_settings").select("enabled_features").eq("household_id", account.household_id).maybeSingle(),
    // Task 15 widened `members_select_household` so an owner/parent caller now sees INACTIVE
    // members too (non-admins already only ever saw active ones) -- without this explicit
    // `.eq("is_active", true)`, an admin's dashboard would show people who were removed from
    // the household in the family strip below. See this task's brief for the full context.
    supabase
      .from("household_members")
      .select("id, display_name, color, avatar_url")
      .eq("household_id", account.household_id)
      .eq("is_active", true)
      .order("created_at"),
  ]);

  const householdName = household?.name ?? "Family Hub";
  const timezone = household?.timezone ?? "UTC";
  const now = new Date();

  // Attribution only -- whose avatar the family strip rings, never a gate on what renders (see
  // lib/auth/active-member.ts's module doc comment and this component's own doc comment).
  const activeMember = await getActiveMember();

  const enabledFeatures = parseEnabledFeatures(settings?.enabled_features);
  // Keyed off "has no screen yet" (lib/constants/features.ts), not "disabled" -- a household
  // that turned a feature ON in onboarding is a genuinely different state from one that left
  // it off, and both need to be visibly accounted for rather than the enabled one silently
  // vanishing. See this task's brief, point 2, and the fix for the sibling bug in
  // components/shell/nav-items.ts (a screen-less feature must never get a nav link either).
  const unbuiltFeatures = FEATURES.filter((feature) => !feature.hasScreen);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <DashboardGreeting
        householdName={householdName}
        hour={hourInTimeZone(now, timezone)}
        dateLabel={formatDateInTimeZone(now, timezone)}
      />

      <FamilyStrip members={members ?? []} activeMemberId={activeMember?.id ?? null} />

      {unbuiltFeatures.length > 0 ? (
        <section aria-labelledby="coming-soon-heading" className="mt-8">
          <h2 id="coming-soon-heading" className="text-lg font-medium text-ink">
            Coming soon
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {unbuiltFeatures.map((feature) => (
              <li key={feature.key}>
                <ComingSoonCard
                  featureKey={feature.key}
                  label={feature.label}
                  enabled={isFeatureEnabled(enabledFeatures, feature.key)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Copy is written per feature (not a single templated string) so the grammar reads naturally
 * regardless of whether the feature's own label is singular ("Calendar arrives"/"is") or
 * plural ("Meals arrive"/"are") -- see FEATURES, lib/constants/features.ts.
 *
 * Each feature carries TWO variants because "has no screen yet" and "is enabled" are
 * independent facts (this task's brief, point 2) -- a household can have turned a feature on
 * with no screen behind it yet, which is a genuinely different state from never having turned
 * it on at all, and deserves copy that says so instead of repeating advice that's already
 * stale:
 *   - `disabled`: the household hasn't turned this on. Reads as deliberately-not-yet-enabled
 *     rather than broken or empty -- it should understand it can turn the feature on in
 *     Settings, not wonder why the card is blank.
 *   - `enabled`: the household already turned this on. "Turn it on in Settings" would be
 *     actively wrong advice here -- it's already on, only the screen is still coming.
 */
const COMING_SOON_COPY: Partial<Record<FeatureKey, { enabled: string; disabled: string }>> = {
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

function ComingSoonCard({
  featureKey,
  label,
  enabled,
}: {
  featureKey: FeatureKey;
  label: string;
  enabled: boolean;
}) {
  const copyVariants = COMING_SOON_COPY[featureKey];
  const copy = enabled
    ? (copyVariants?.enabled ?? `${label} is on — its screen is still on the way.`)
    : (copyVariants?.disabled ?? `${label} isn’t turned on yet.`);
  return (
    <div className="flex min-h-[96px] flex-col justify-center gap-1 rounded-[18px] bg-surface px-5 py-5 shadow-elevation ring-1 ring-[color:var(--color-muted)]">
      <p className="text-base font-medium text-ink">{label}</p>
      <p className="text-sm text-muted-foreground">{copy}</p>
    </div>
  );
}
