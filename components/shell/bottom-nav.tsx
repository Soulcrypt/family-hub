"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/components/shell/nav-items";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
      active ? "text-accent" : "text-muted hover:text-ink",
    );

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {visible.map((item) => {
        const Icon = item.icon;
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
                const Icon = item.icon;
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
