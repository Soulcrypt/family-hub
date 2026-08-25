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
  const disabledFeatures = FEATURES.filter(
    (feature) => !feature.locked && !isFeatureEnabled(enabledFeatures, feature.key),
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <DashboardGreeting
        householdName={householdName}
        hour={hourInTimeZone(now, timezone)}
        dateLabel={formatDateInTimeZone(now, timezone)}
      />

      <FamilyStrip members={members ?? []} activeMemberId={activeMember?.id ?? null} />

      {disabledFeatures.length > 0 ? (
        <section aria-labelledby="coming-soon-heading" className="mt-8">
          <h2 id="coming-soon-heading" className="text-lg font-medium text-ink">
            Coming soon
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {disabledFeatures.map((feature) => (
              <li key={feature.key}>
                <ComingSoonCard featureKey={feature.key} label={feature.label} />
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
 * regardless of whether the feature's own label is singular ("Calendar arrives") or plural
 * ("Meals arrive") -- see FEATURES, lib/constants/features.ts. Reads as deliberately-not-yet-
 * enabled rather than broken or empty (this task's brief, point 8): a household that turned a
 * feature off in onboarding should understand it can turn it back on in Settings, not wonder
 * why the card is blank.
 */
const COMING_SOON_COPY: Partial<Record<FeatureKey, string>> = {
  calendar: "Calendar arrives soon — turn it on in Settings when you’re ready.",
  meals: "Meals arrive soon — turn it on in Settings when you’re ready.",
  chores: "Chores arrive soon — turn it on in Settings when you’re ready.",
  habits: "Habits arrive soon — turn it on in Settings when you’re ready.",
};

function ComingSoonCard({ featureKey, label }: { featureKey: FeatureKey; label: string }) {
  const copy = COMING_SOON_COPY[featureKey] ?? `${label} isn’t turned on yet.`;
  return (
    <div className="flex min-h-[96px] flex-col justify-center gap-1 rounded-[18px] bg-surface px-5 py-5 shadow-elevation ring-1 ring-[color:var(--color-muted)]">
      <p className="text-base font-medium text-ink">{label}</p>
      <p className="text-sm text-muted-foreground">{copy}</p>
    </div>
  );
}
