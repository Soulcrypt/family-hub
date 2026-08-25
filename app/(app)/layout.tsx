import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getAccountMembership, getActiveMember } from "@/lib/auth/active-member";
import { navItemsFor } from "@/components/shell/nav-items";
import { Sidebar } from "@/components/shell/sidebar";
import { BottomNav } from "@/components/shell/bottom-nav";
import { parseEnabledFeatures } from "@/lib/constants/features";

/**
 * The frame every screen under (app) renders inside -- sidebar on md+ screens, a bottom tab
 * bar below that, both driven by the same feature-gated nav list.
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

  // Two explicit queries rather than a single `.select("household_id, households(name)")`
  // embedded join: supabase-js types a to-one embedded relation inconsistently across
  // versions (it can come back typed as an array, e.g. `households: { name: string }[]`),
  // which turns `membership.households?.name` into a fight with the generated types for one
  // saved round-trip. Not worth it for a value that's rendered once per layout.
  const { data: household } = await supabase
    .from("households")
    .select("name")
    .eq("id", membership.household_id)
    .maybeSingle();

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

  // Attribution only -- whose avatar/name the shell shows, never a gate on what renders.
  const activeMember = await getActiveMember();

  return (
    <div className="min-h-dvh md:flex">
      <Sidebar items={items} householdName={household?.name ?? "Family Hub"} activeMember={activeMember} />
      <div className="flex-1 pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
      <BottomNav items={items} />
    </div>
  );
}
