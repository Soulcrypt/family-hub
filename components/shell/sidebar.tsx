"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Home,
  ListChecks,
  Settings as SettingsIcon,
  Sparkles,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { MemberAvatar } from "@/components/family/member-avatar";
import { cn } from "@/lib/utils";
import type { NavIconKey, NavItem } from "@/components/shell/nav-items";
import type { ActiveMember } from "@/lib/auth/active-member";

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

type SidebarProps = {
  items: NavItem[];
  householdName: string;
  activeMember: ActiveMember | null;
};

export function Sidebar({ items, householdName, activeMember }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden shrink-0 border-r border-border bg-surface md:flex md:w-[260px] md:flex-col">
      <div className="flex flex-col gap-1 px-6 pt-8 pb-6">
        <span className="text-lg font-medium text-ink">Family Hub</span>
        <span className="truncate text-sm text-muted-foreground">{householdName}</span>
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-[44px] items-center gap-3 rounded-[12px] px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                isActive ? "bg-sunken text-ink" : "text-muted-foreground hover:bg-sunken hover:text-ink",
              )}
            >
              <Icon size={20} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3 border-t border-border px-3 py-4">
        <Link
          href="/switch"
          className="flex min-h-[44px] items-center gap-3 rounded-[12px] px-3 text-sm font-medium text-ink transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {activeMember ? (
            <MemberAvatar
              displayName={activeMember.display_name}
              color={activeMember.color}
              avatarUrl={activeMember.avatar_url}
              size="sm"
              ariaHidden
            />
          ) : (
            <span
              aria-hidden="true"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-sm font-medium text-muted-foreground"
            >
              ?
            </span>
          )}
          <span className="truncate">{activeMember ? activeMember.display_name : "Who's this?"}</span>
        </Link>
        <ThemeToggle />
      </div>
    </aside>
  );
}
