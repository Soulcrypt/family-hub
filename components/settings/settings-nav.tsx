"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type SettingsNavItem = { href: string; label: string };

export const SETTINGS_NAV_ITEMS: readonly SettingsNavItem[] = [
  { href: "/settings", label: "Family" },
  { href: "/settings/calendars", label: "Calendars" },
  { href: "/settings/notifications", label: "Notifications" },
  { href: "/settings/appearance", label: "Appearance" },
  { href: "/settings/wall-display", label: "Wall display" },
  { href: "/settings/data-export", label: "Data & export" },
] as const;

/**
 * Design-Spec §8.10 / mock 4h: the left section nav ("Family · Calendars · Notifications ·
 * Appearance · Wall display · Data & export"), content pane beside it on desktop, stacked above
 * it on phone (the parent layout, app/(app)/settings/layout.tsx, handles that responsive
 * switch — this component is just the list of links).
 *
 * None of these six are admin-gated at the NAV level — every viewer, admin or not, can see
 * where each section lives; it's the CONTENT of a section (the Family pane's "+ Invite member"
 * and removed-members list, in particular) that gates on `canManageMembers`/`isAdminProfile`,
 * exactly like the household/members pages this replaces already did for their own controls.
 * Appearance has never been admin-gated (nobody is restricted from picking a theme or a motion
 * preference), so treating the whole rail as ungated for everyone keeps that unchanged.
 */
export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections" className="flex flex-col gap-1 md:w-[220px] md:shrink-0">
      {SETTINGS_NAV_ITEMS.map((item) => {
        const current = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex min-h-[44px] items-center rounded-tile px-4 text-[14px] font-medium transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              current ? "bg-glass-hover text-text" : "text-text-secondary hover:bg-glass-hover hover:text-text",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
