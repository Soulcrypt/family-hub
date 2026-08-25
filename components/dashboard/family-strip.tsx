import Link from "next/link";
import { MemberAvatar } from "@/components/family/member-avatar";
import { cn } from "@/lib/utils";

export type FamilyStripMember = {
  id: string;
  display_name: string;
  color: string;
  avatar_url: string | null;
};

export type FamilyStripProps = {
  members: FamilyStripMember[];
  /** The ATTRIBUTION-only currently-active member's id (getActiveMember(), never an authority
   * check) -- used purely to ring-highlight whose profile this device is currently signed in
   * as, matching the "whose avatar the strip highlight" call in this task's brief. `null` on a
   * fresh session with no active-member cookie yet, in which case nothing is highlighted. */
  activeMemberId: string | null;
};

/**
 * Every active member of the household, each linking to `/switch` -- this is a plain
 * navigation link, not a switch action itself; the actual profile switch (and its optional PIN
 * gate) happens on that page. Callers MUST have already filtered `members` to
 * `.eq("is_active", true)` themselves (app/(app)/dashboard/page.tsx does) -- this component
 * renders whatever list it's given.
 */
export function FamilyStrip({ members, activeMemberId }: FamilyStripProps) {
  return (
    <section aria-labelledby="family-strip-heading" className="mt-8">
      <h2 id="family-strip-heading" className="text-lg font-medium text-ink">
        Family
      </h2>
      <ul className="mt-3 flex flex-wrap gap-3">
        {members.map((member) => {
          const isActive = member.id === activeMemberId;
          return (
            <li key={member.id} className="min-w-0">
              <Link
                href="/switch"
                // The visible label span below carries the plain display name only (so it can
                // be found by its exact text, e.g. in tests/e2e/dashboard.spec.ts, without
                // "(you)" polluting that text) -- the aria-label here layers the "you" cue on
                // TOP for screen reader users instead, without changing what's rendered.
                aria-label={isActive ? `${member.display_name} (you)` : undefined}
                className={cn(
                  "flex min-h-[44px] min-w-[96px] flex-col items-center gap-2 rounded-[18px] px-3 py-3 text-center ring-1 ring-[color:var(--color-muted)] transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  isActive ? "bg-sunken ring-2 ring-accent" : "bg-surface",
                )}
              >
                <MemberAvatar
                  displayName={member.display_name}
                  color={member.color}
                  avatarUrl={member.avatar_url}
                  size="md"
                  ariaHidden
                />
                <span className="line-clamp-2 w-full min-w-0 break-words text-sm font-medium text-ink">
                  {member.display_name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
