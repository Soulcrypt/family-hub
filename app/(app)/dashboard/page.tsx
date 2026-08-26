import { requireAccountMembership, getActiveMember } from "@/lib/auth/active-member";
import { createServerClient } from "@/lib/supabase/server";
import { parseEnabledFeatures } from "@/lib/constants/features";
import { comingSoonLine, UNBUILT_FEATURES } from "@/lib/constants/coming-soon";
import { isMemberGated } from "@/lib/auth/pin-gate";
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
 * SP1 Foundation design review: this is a wall-mounted kitchen tablet glanced at from ~1.5m
 * away, and the family IS the content -- so this render is now, top to bottom: a hero greeting
 * with its own wide-viewport type scale (DashboardGreeting), a hero family strip of large,
 * one-tap avatars (FamilyStrip), and a single quiet line naming whatever has no screen yet
 * (`comingSoonLine`, below) -- replacing four "Coming soon" cards that used to take up roughly
 * half the visible canvas to say nothing is here.
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
    // `role`/`user_id` are new here (SP1 Foundation, "one tap switches"): FamilyStrip needs
    // them to decide, per member, whether tapping its tile should demand a PIN first -- see
    // `isMemberGated()`, lib/auth/pin-gate.ts.
    supabase
      .from("household_members")
      .select("id, display_name, color, avatar_url, role, user_id")
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

  // One tap switches (SP1 Foundation): tapping a face here used to link to /switch, where the
  // same face had to be tapped a SECOND time. `isMemberGated()` (lib/auth/pin-gate.ts) is the
  // SAME gating decision app/switch/page.tsx's switcher uses -- extracted there so this page
  // can't invent a second, possibly-drifting way to decide whether a profile is PIN-protected.
  const membersWithGate = await Promise.all(
    (members ?? []).map(async (member) => ({
      ...member,
      gated: await isMemberGated(supabase, member, account.user_id),
    })),
  );

  const enabledFeatures = parseEnabledFeatures(settings?.enabled_features);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 lg:py-16">
      <DashboardGreeting
        householdName={householdName}
        hour={hourInTimeZone(now, timezone)}
        dateLabel={formatDateInTimeZone(now, timezone)}
      />

      <FamilyStrip members={membersWithGate} activeMemberId={activeMember?.id ?? null} />

      {UNBUILT_FEATURES.length > 0 ? (
        <section aria-labelledby="coming-soon-heading" className="mt-10 sm:mt-14">
          {/* sr-only: this is a single sentence acknowledging what's not here yet, not a
              labeled sub-section with its own heading worth surfacing visually -- see this
              task's brief, "the four Coming soon cards collapse to one quiet line". */}
          <h2 id="coming-soon-heading" className="sr-only">
            Coming soon
          </h2>
          <p className="mx-auto max-w-2xl text-center text-sm text-muted-foreground">
            {comingSoonLine(UNBUILT_FEATURES, enabledFeatures)}
          </p>
        </section>
      ) : null}
    </div>
  );
}
