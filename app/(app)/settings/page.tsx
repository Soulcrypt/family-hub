import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireAccountMembership, getActiveMember } from "@/lib/auth/active-member";
import { canEditSettings, isAdminProfile } from "@/lib/auth/permissions";
import { SetPinForm } from "@/components/settings/set-pin-form";

const CARDS = [
  {
    href: "/settings/household",
    label: "Household",
    description: "Name, timezone, week start, and features",
    adminOnly: true,
  },
  {
    href: "/settings/appearance",
    label: "Appearance",
    description: "Light, dark, or match your device",
    adminOnly: false,
  },
  {
    href: "/settings/members",
    label: "Members",
    description: "Invite family members to log in, or restore one you removed",
    adminOnly: true,
  },
] as const;

/**
 * The Settings landing page: an index of cards linking onward, plus a self-service "set your
 * PIN" control.
 *
 * `adminOnly` cards (Household, Members) are OFFERED only when the currently-displayed
 * profile reads as an admin -- `isAdminProfile(activeMember?.role ?? account.role)`, the same
 * UI-only display check app/(app)/settings/household/page.tsx already uses for its `canEdit`
 * derivation. This is a UI-honesty fix, not a new security boundary: hiding the card here does
 * not replace either destination page's own gate (Household already renders read-only via
 * that identical check; Members' `canManage`/`canInvite` still come from the authenticated
 * account's real `canEditSettings`/`canManageMembers`), and a household switched to a
 * non-admin profile must not be handed a full control panel it will only be told "no" after
 * tapping into (SP1 Foundation design review, Finding 1). Combined with
 * `canEditSettings(account.role)` -- the real authority check -- so a non-admin ACCOUNT (not
 * just a non-admin attributed profile) sees the same thing. Appearance is never gated (nobody
 * is admin-restricted from picking a theme) and the PIN control below is self-service for
 * anyone -- see SetPinForm's doc comment -- so this needs no authority check of its own.
 */
export default async function SettingsIndexPage() {
  const account = await requireAccountMembership();
  const activeMember = await getActiveMember();
  const pinMemberId = activeMember?.id ?? account.id;
  const canSeeAdminCards = canEditSettings(account.role) && isAdminProfile(activeMember?.role ?? account.role);
  const cards = CARDS.filter((card) => !card.adminOnly || canSeeAdminCards);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl">Settings</h1>
        <p className="mt-1 text-muted-foreground">Manage your household.</p>
      </header>

      <ul className="flex flex-col gap-3">
        {cards.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="flex min-h-[44px] items-center gap-3 rounded-[18px] bg-surface px-5 py-4 shadow-elevation ring-1 ring-[color:var(--color-muted)] transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-base font-medium text-ink">{card.label}</span>
                <span className="truncate text-sm text-muted-foreground">{card.description}</span>
              </span>
              <ChevronRight size={20} aria-hidden className="shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <SetPinForm memberId={pinMemberId} />
      </div>
    </div>
  );
}
