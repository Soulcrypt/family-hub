"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/components/shell/nav-items";
import type { ActiveMember } from "@/lib/auth/active-member";

type SidebarProps = {
  items: NavItem[];
  householdName: string;
  activeMember: ActiveMember | null;
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Sidebar({ items, householdName, activeMember }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden shrink-0 border-r border-border bg-surface md:flex md:w-[260px] md:flex-col">
      <div className="flex flex-col gap-1 px-6 pt-8 pb-6">
        <span className="text-lg font-medium text-ink">Family Hub</span>
        <span className="truncate text-sm text-muted">{householdName}</span>
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-[44px] items-center gap-3 rounded-[12px] px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                isActive ? "bg-sunken text-ink" : "text-muted hover:bg-sunken hover:text-ink",
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
          <Avatar>
            {activeMember?.avatar_url ? <AvatarImage src={activeMember.avatar_url} alt="" /> : null}
            <AvatarFallback
              style={activeMember ? { backgroundColor: activeMember.color } : undefined}
              className={activeMember ? "text-on-accent" : undefined}
            >
              {activeMember ? initials(activeMember.display_name) : "?"}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{activeMember ? activeMember.display_name : "Who's this?"}</span>
        </Link>
        <ThemeToggle />
      </div>
    </aside>
  );
}
