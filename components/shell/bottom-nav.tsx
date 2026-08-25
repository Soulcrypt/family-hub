"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/components/shell/nav-items";

type BottomNavProps = { items: NavItem[] };

const MAX_VISIBLE = 5;
const MORE_ITEM: NavItem = { href: "/settings", label: "More", icon: MoreHorizontal, feature: null };

export function BottomNav({ items }: BottomNavProps) {
  const pathname = usePathname();
  // Collapse overflow into a single trailing "More" entry rather than shrinking every tab to
  // fit -- Settings is always last in `items` (nav-items.ts), so it's never among the first
  // MAX_VISIBLE - 1 items unless the whole list already fits, and "More" points at the same
  // place Settings does.
  const visible = items.length <= MAX_VISIBLE ? items : [...items.slice(0, MAX_VISIBLE - 1), MORE_ITEM];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {visible.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent",
              isActive ? "text-accent" : "text-muted hover:text-ink",
            )}
          >
            <Icon size={22} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
