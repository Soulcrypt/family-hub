import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getAccountMembership, getActiveMember } from "@/lib/auth/active-member";
import { isAdminProfile } from "@/lib/auth/permissions";
import { createServerClient } from "@/lib/supabase/server";
import { MemberAvatar } from "@/components/family/member-avatar";
import { parseEnabledFeatures, isFeatureEnabled } from "@/lib/constants/features";
import { redirect } from "next/navigation";

/**
 * The overflow destination behind the top bar's avatar stack and the dock's fifth-item gap —
 * Design-Spec §5: "Overflow screens (Photos, Budget, Settings) via profile avatar top-right →
 * sheet."
 *
 * A route rather than a client-side sheet, deliberately. The spec describes a sheet on phone,
 * but everything reachable from here is a destination with its own URL, and a sheet that can
 * only be opened from one corner of one surface is exactly how the profile switcher became
 * unreachable on phone once before. A route is linkable, back-button-able, and testable; the
 * phone presentation can grow a sheet wrapper later without moving any of this.
 */
export default async function AccountPage() {
  const membership = await getAccountMembership();
  if (!membership) redirect("/onboarding");

  const supabase = await createServerClient();
  const activeMember = await getActiveMember();

  const [{ data: household }, { data: members }, { data: settings }] = await Promise.all([
    supabase.from("households").select("name").eq("id", membership.household_id).maybeSingle(),
    supabase
      .from("household_members")
      .select("id, display_name, role, color, avatar_url")
      .eq("household_id", membership.household_id)
      .eq("is_active", true)
      .order("created_at"),
    supabase
      .from("household_settings")
      .select("enabled_features")
      .eq("household_id", membership.household_id)
      .maybeSingle(),
  ]);

  const features = parseEnabledFeatures(settings?.enabled_features);
  // Same combination the settings screens use: real account authority AND the profile the
  // shared device is currently attributed to. A child standing at the tablet should not be
  // offered household administration just because a parent's session is underneath.
  const viewingAsAdmin = isAdminProfile(activeMember?.role ?? membership.role);

  const overflow = [
    { href: "/photos", label: "Photos", show: isFeatureEnabled(features, "photos") },
    { href: "/budget", label: "Budget", show: isFeatureEnabled(features, "budget") },
    { href: "/family", label: "Family", show: true },
    { href: "/settings", label: "Settings", show: viewingAsAdmin },
  ].filter((row) => row.show);

  return (
    <div className="mx-auto w-full max-w-[560px] px-5 py-8 sm:px-10">
      <h1 className="text-[26px] font-bold tracking-[-0.02em]">{household?.name ?? "Your household"}</h1>
      <p className="mt-1 text-[15px] text-text-secondary">
        {activeMember ? `You’re using Hearth as ${activeMember.display_name}.` : "Choose who’s using Hearth."}
      </p>

      <section aria-labelledby="who-heading" className="mt-7">
        <h2 id="who-heading" className="mb-3 text-[11px] font-bold uppercase tracking-[0.07em] text-text-secondary">
          Who’s here
        </h2>
        <Link
          href="/switch"
          className="glass flex items-center gap-3 rounded-card px-4 py-4 transition-colors duration-150 hover:bg-glass-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="flex items-center">
            {(members ?? []).slice(0, 5).map((member, index) => (
              <span
                key={member.id}
                className="rounded-full ring-2 ring-[color:var(--color-base)]"
                style={{ marginLeft: index === 0 ? 0 : -8 }}
              >
                <MemberAvatar
                  displayName={member.display_name}
                  color={member.color}
                  avatarUrl={member.avatar_url}
                  size="sm"
                  ariaHidden
                  dimmed={activeMember !== null && member.id !== activeMember.id}
                />
              </span>
            ))}
          </span>
          <span className="min-w-0 flex-1 text-[15px] font-semibold">Switch profile</span>
          <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-text-secondary" />
        </Link>
      </section>

      <section aria-labelledby="more-heading" className="mt-7">
        <h2 id="more-heading" className="mb-3 text-[11px] font-bold uppercase tracking-[0.07em] text-text-secondary">
          More
        </h2>
        <div className="glass overflow-hidden rounded-card">
          {overflow.map((row, index) => (
            <Link
              key={row.href}
              href={row.href}
              className={`flex min-h-[56px] items-center gap-3 px-4 transition-colors duration-150 hover:bg-glass-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                index > 0 ? "border-t border-hairline" : ""
              }`}
            >
              <span className="min-w-0 flex-1 text-[15px] font-semibold">{row.label}</span>
              <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-text-secondary" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
