"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  CalendarDays,
  Home,
  ListChecks,
  MoreHorizontal,
  Settings as SettingsIcon,
  Sparkles,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavIconKey, NavItem } from "@/components/shell/nav-items";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// See nav-items.ts's doc comment on `NavIconKey`: the actual icon components are resolved
// here, client-side, rather than carried across the server/client boundary as data.
const ICONS: Record<NavIconKey, LucideIcon> = {
  home: Home,
  calendar: CalendarDays,
  meals: UtensilsCrossed,
  chores: ListChecks,
  habits: Sparkles,
  family: Users,
  settings: SettingsIcon,
};

type BottomNavProps = { items: NavItem[] };

const MAX_VISIBLE = 5;

export type BottomNavSplit = { visible: NavItem[]; overflow: NavItem[] };

/**
 * Splits nav items into what the bar shows directly vs. what goes behind "More". The
 * invariant this exists to hold -- every item navItemsFor() returns ends up in `visible` OR
 * `overflow`, never neither -- is asserted for several feature combinations (including all
 * features on) in lib/__tests__/bottom-nav-reachability.test.ts.
 *
 * An earlier version of this function (this task's fix round 1) sliced to MAX_VISIBLE - 1
 * and silently dropped the rest, which made Family and Settings -- items navItemsFor()
 * guarantees are always present, see nav-items.ts -- unreachable from mobile navigation the
 * moment three optional features were enabled. "More" must DISCLOSE the overflow, not
 * discard it; reordering `ALL` in nav-items.ts to rescue Family/Settings would just move the
 * same bug onto whichever optional feature lands last, so don't do that either.
 */
export function splitBottomNavItems(items: NavItem[]): BottomNavSplit {
  if (items.length <= MAX_VISIBLE) return { visible: items, overflow: [] };
  return { visible: items.slice(0, MAX_VISIBLE - 1), overflow: items.slice(MAX_VISIBLE - 1) };
}

export function BottomNav({ items }: BottomNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { visible, overflow } = splitBottomNavItems(items);

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const tabClassName = (active: boolean) =>
    cn(
      "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
      // text-accent-strong, not the pinned text-accent (3.76:1, fails AA at this text-xs
      // size) -- see the design-fix report's contrast sweep.
      active ? "text-accent-strong" : "text-muted-foreground hover:text-ink",
    );

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {visible.map((item) => {
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={tabClassName(isActive(item.href))}
          >
            <Icon size={22} aria-hidden />
            {item.label}
          </Link>
        );
      })}

      {/*
        SP1 design review Finding 2 (P2): the profile switcher (/switch) had no dedicated
        entry point on phone at all -- it was reachable only by tapping a face in the
        dashboard's family-strip tiles. Deliberately NOT one of `items`/navItemsFor()'s
        results (mirroring Sidebar's own dedicated footer link, which similarly sits outside
        its `items.map` loop): /switch is a utility affordance, not a feature screen, so it is
        not subject to splitBottomNavItems's MAX_VISIBLE budget or the "every item is
        reachable" invariant that guards navItemsFor()'s output in
        lib/__tests__/bottom-nav-reachability.test.ts -- that invariant is about `items`,
        which this leaves untouched. Always rendered directly rather than folded into
        "More": today's real nav items cap out at 3 (Home, Family, Settings -- see
        nav-items.ts), so this adds a 4th tab, comfortably within reach. If a future feature
        screen ever pushes the visible count high enough to make a 5th/6th permanent tab
        cramped, reconsider this against folding /switch into the overflow disclosure instead.
      */}
      <Link
        href="/switch"
        aria-current={isActive("/switch") ? "page" : undefined}
        className={tabClassName(isActive("/switch"))}
      >
        <ArrowLeftRight size={22} aria-hidden />
        Switch
      </Link>

      {overflow.length > 0 && (
        <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
          <DialogTrigger
            className={tabClassName(overflow.some((item) => isActive(item.href)))}
            aria-haspopup="dialog"
          >
            <MoreHorizontal size={22} aria-hidden />
            More
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>More</DialogTitle>
            </DialogHeader>
            <ul className="flex flex-col gap-1">
              {overflow.map((item) => {
                const Icon = ICONS[item.icon];
                return (
                  <li key={item.href}>
                    <DialogClose asChild>
                      <Link
                        href={item.href}
                        aria-current={isActive(item.href) ? "page" : undefined}
                        className={cn(
                          "flex min-h-[44px] items-center gap-3 rounded-[12px] px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                          isActive(item.href) ? "bg-sunken text-ink" : "text-ink hover:bg-sunken",
                        )}
                      >
                        <Icon size={20} aria-hidden />
                        {item.label}
                      </Link>
                    </DialogClose>
                  </li>
                );
              })}
            </ul>
          </DialogContent>
        </Dialog>
      )}
    </nav>
  );
}
