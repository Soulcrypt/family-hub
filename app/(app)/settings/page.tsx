import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireAccountMembership, getActiveMember } from "@/lib/auth/active-member";
import { SetPinForm } from "@/components/settings/set-pin-form";

const CARDS = [
  { href: "/settings/household", label: "Household", description: "Name, timezone, week start, and features" },
  { href: "/settings/appearance", label: "Appearance", description: "Theme and household accent color" },
  { href: "/settings/members", label: "Members", description: "Invite family members to log in, or restore one you removed" },
] as const;

/**
 * The Settings landing page: an index of cards linking onward, plus a self-service "set your
 * PIN" control. Every card is shown to every viewer -- each destination page renders its own
 * read-only view for a non-admin account or a non-admin attributed profile (see
 * app/(app)/settings/household/page.tsx's `canEdit` derivation) rather than hiding the link
 * entirely, matching how /family/[memberId] shows read-only facts instead of a 404 to a
 * non-admin.
 *
 * `pinMemberId` is whichever profile is currently "you": the active-member cookie if a switch
 * has happened (lib/auth/active-member.ts), or the authenticated account's own
 * `household_members` row otherwise. Setting a PIN is self-service for anyone -- see
 * SetPinForm's doc comment -- so this needs no authority check of its own.
 */
export default async function SettingsIndexPage() {
  const account = await requireAccountMembership();
  const activeMember = await getActiveMember();
  const pinMemberId = activeMember?.id ?? account.id;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl">Settings</h1>
        <p className="mt-1 text-muted-foreground">Manage your household.</p>
      </header>

      <ul className="flex flex-col gap-3">
        {CARDS.map((card) => (
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
