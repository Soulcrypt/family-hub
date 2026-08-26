import { requireAccountMembership, getActiveMember } from "@/lib/auth/active-member";
import { createServerClient } from "@/lib/supabase/server";
import { formatDateInTimeZone, hourInTimeZone } from "@/lib/utils";
import { DashboardGreeting, firstNameOf } from "@/components/dashboard/greeting";
import { WidgetGrid } from "@/components/dashboard/widget-grid";
import { buildDailySummary } from "@/lib/dashboard/summary";
import { parseWidgetLayout } from "@/lib/dashboard/layout";
import { getWeather } from "@/lib/dashboard/weather";
import { getLocalNews } from "@/lib/dashboard/news";

/**
 * The Hearth dashboard -- Design-Spec §8.1, rebuilt against the imported design handoff
 * (docs/design/hearth/Design-Spec.md; mocks 2a/2f/3a) to replace SP1 Foundation's earlier,
 * deliberately-minimal placeholder page (household greeting + family strip + one "coming soon"
 * line -- see the git history of this file). That page's own doc comment reasoned it was too
 * early to build a widget layout engine with nothing real to put on it; this task's brief is
 * the green light now that the design spec exists to build against -- see this file's sibling
 * components under components/dashboard/ for what's real (weather, news) vs. an honest empty
 * state (schedule, dinner, photos -- no calendar/meal-plan/photo-storage tables exist yet).
 *
 * Greets whichever MEMBER the screen is currently attributed to (`getActiveMember()` --
 * ATTRIBUTION only, never authority -- lib/auth/active-member.ts), falling back to the
 * authenticated account's own membership row when no active-member cookie is set yet (a fresh
 * sign-in). The per-member widget layout (`member_dashboard_layouts`) is keyed to that SAME
 * effective member, not the authenticated account, so a kiosk currently attributed to a
 * login-less child still reads/writes that child's own layout rather than the signed-in
 * parent's.
 *
 * `requireAccountMembership()` (not the nullable `getAccountMembership()`) is safe here for
 * the same reason the previous dashboard's doc comment documented: app/(app)/layout.tsx already
 * redirects any account with no household to /onboarding before this page ever renders.
 */
export default async function DashboardPage() {
  const account = await requireAccountMembership();
  const supabase = await createServerClient();
  const activeMember = await getActiveMember();
  const effectiveMember = activeMember ?? account;
  const now = new Date();

  const [{ data: household }, { data: layoutRow }, weather, news] = await Promise.all([
    supabase.from("households").select("timezone").eq("id", account.household_id).maybeSingle(),
    supabase.from("member_dashboard_layouts").select("widgets").eq("member_id", effectiveMember.id).maybeSingle(),
    // Both cached server-side (15/30 min -- see their own doc comments) so this page never
    // fetches Open-Meteo/the news feed on every single render.
    getWeather(),
    getLocalNews(),
  ]);

  const timezone = household?.timezone ?? "UTC";
  const hour = hourInTimeZone(now, timezone);
  const dateLabel = formatDateInTimeZone(now, timezone);
  const widgets = parseWidgetLayout(layoutRow?.widgets);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 lg:py-14">
      <DashboardGreeting firstName={firstNameOf(effectiveMember.display_name)} hour={hour} summary={buildDailySummary(dateLabel)} />
      <WidgetGrid memberId={effectiveMember.id} initialLayout={widgets} weather={weather} news={news} />
    </div>
  );
}
