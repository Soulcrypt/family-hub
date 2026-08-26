"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HearthLockup } from "@/components/brand/hearth-mark";
import { MemberAvatar } from "@/components/family/member-avatar";
import type { NavItem } from "@/components/shell/nav-items";
import { cn } from "@/lib/utils";

export type ShellMember = { id: string; display_name: string; color: string; avatar_url: string | null };

/**
 * Desktop navigation — Design-Spec §5: "Top bar, transparent over aurora: logo mark + wordmark
 * left; center links; right: weather pill + stacked family avatars."
 *
 * Transparent on purpose: the aurora is the background, and a filled bar would cut the glow in
 * half across the top of every screen. Depth comes from the glass cards below it, not from
 * chrome.
 *
 * Active link is `text/primary`, inactive `text/secondary`, with §5's 200ms colour transition
 * and no underline. `aria-current="page"` carries the same fact to assistive tech, because a
 * colour difference of 13.7:1 vs 4.6:1 is not something a screen reader can report.
 */
export function TopBar({
  items,
  members,
  activeMemberId,
}: {
  items: NavItem[];
  members: ShellMember[];
  activeMemberId: string | null;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 hidden w-full md:block">
      <div className="mx-auto flex h-[72px] max-w-[1140px] items-center gap-8 px-10">
        <Link
          href="/dashboard"
          className="rounded-pill focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          <HearthLockup />
        </Link>

        <nav aria-label="Main" className="flex flex-1 items-center justify-center gap-7">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-[14px] font-semibold transition-colors duration-200",
                  "rounded-pill px-1 py-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent",
                  active ? "text-text" : "text-text-secondary hover:text-text",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/account"
          aria-label="Profiles and settings"
          className="flex items-center rounded-pill focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          {/* §6 avatars: "Stacks overlap −8px with 2px bg-color ring." The ring is the page
              background rather than a border colour, so the stack reads as overlapping discs
              cut out of the page instead of outlined circles. */}
          <span className="flex items-center">
            {members.slice(0, 4).map((member, index) => (
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
                  dimmed={activeMemberId !== null && member.id !== activeMemberId}
                />
              </span>
            ))}
          </span>
        </Link>
      </div>
    </header>
  );
}
