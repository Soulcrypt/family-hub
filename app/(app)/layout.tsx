import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getAccountMembership, getActiveMember } from "@/lib/auth/active-member";
import { dockItemsFor, navItemsFor } from "@/components/shell/nav-items";
import { TopBar } from "@/components/shell/top-bar";
import { Dock } from "@/components/shell/dock";
import { parseEnabledFeatures } from "@/lib/constants/features";

/**
 * The frame every screen under (app) renders inside -- Design-Spec §5: a transparent top bar
 * over the aurora on md+ screens, a floating pill dock below that. Both are driven by the same
 * feature-gated nav list, but they are not the same list: the dock shows a fixed five (Home,
 * Meals, Cal, Chores, Ivy) while the top bar shows all seven, with everything else reached
 * through the profile avatar.
 *
 * Auth: no `(app)` route here is in proxy.ts's PUBLIC_PATHS, so an unauthenticated visitor
 * never reaches this render at all -- the proxy already redirected them to /welcome (same
 * reasoning as app/onboarding/page.tsx's identical comment). The only branch this layout
 * needs is "signed in, but no household yet," which is exactly what `getAccountMembership()`
 * returning `null` means -- not an error, a normal pre-onboarding state -- so it's the right
 * helper here, not `requireAccountMembership()` (which would throw and turn a routine
 * redirect into an error page).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const membership = await getAccountMembership();
  if (!membership) redirect("/onboarding");

  const supabase = await createServerClient();

  const { data: settings } = await supabase
    .from("household_settings")
    .select("enabled_features")
    .eq("household_id", membership.household_id)
    .maybeSingle();

  // parseEnabledFeatures() drops anything that isn't a recognized boolean flag, so a missing
  // row (`settings` is null), an empty `{}`, or a hand-edited/malformed value all degrade to
  // "no optional features chosen" rather than throwing -- and navItemsFor() separately
  // guarantees Home/Family/Settings survive that regardless (see nav-items.ts).
  const features = parseEnabledFeatures(settings?.enabled_features);
  const items = navItemsFor(features);
  const dockItems = dockItemsFor(features);

  // Attribution only -- whose avatar/name the shell shows, never a gate on what renders.
  const activeMember = await getActiveMember();

  // The stacked family avatars in the top bar (§5). Active members only: a removed member
  // should not reappear in the chrome of every screen.
  const { data: members } = await supabase
    .from("household_members")
    .select("id, display_name, color, avatar_url")
    .eq("household_id", membership.household_id)
    .eq("is_active", true)
    .order("created_at");

  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only rounded-pill bg-accent-strong px-4 py-3 text-sm font-semibold text-on-accent focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
      >
        Skip to content
      </a>
      <TopBar items={items} members={members ?? []} activeMemberId={activeMember?.id ?? null} />
      <main
        id="main-content"
        // §4 phone: "content bottom-padded 96px to clear the dock". The dock is fixed, so
        // without this the last card sits underneath it and cannot be scrolled clear.
        className="min-w-0 pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-10"
      >
        {children}
      </main>
      <Dock items={dockItems} />
    </div>
  );
}
