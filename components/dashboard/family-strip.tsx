import { directSwitchAction } from "@/app/switch/actions";
import { MemberAvatar } from "@/components/family/member-avatar";
import { PinDialog } from "@/components/switcher/pin-dialog";
import { cn } from "@/lib/utils";

export type FamilyStripMember = {
  id: string;
  display_name: string;
  color: string;
  avatar_url: string | null;
  /**
   * Whether tapping this member's tile should demand a PIN first, per `isMemberGated()`
   * (lib/auth/pin-gate.ts) -- computed server-side by the caller (app/(app)/dashboard/page.tsx)
   * because it needs a `member_has_pin` RPC round trip this component has no business making
   * itself. See that module's doc comment for the full three-part test.
   */
  gated: boolean;
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
 * SP1 Foundation design review's HERO of the dashboard -- large, wall-readable avatars for
 * every active member of the household, each of which now switches attribution in exactly ONE
 * tap (see this task's brief, "One tap switches"): tapping a member's own tile used to link to
 * `/switch`, where the same face had to be tapped a SECOND time. Now:
 *
 *  - An ungated tile is a plain `<form>` submitting `directSwitchAction` (app/switch/actions.ts)
 *    directly -- attribution changes immediately, no intermediate screen.
 *  - A `gated` tile (PIN-protected, per `isMemberGated()` -- lib/auth/pin-gate.ts) renders the
 *    SAME `PinDialog` app/switch/page.tsx's switcher grid uses, rather than a second gated-tile
 *    UI invented for this screen. This is safe because switching attribution grants no
 *    AUTHORITY on its own -- see lib/auth/active-member.ts's module doc comment -- privileged
 *    actions are gated solely by the authenticated account's own DB-verified role, never by
 *    which member is currently displayed.
 *
 * Callers MUST have already filtered `members` to `.eq("is_active", true)` themselves
 * (app/(app)/dashboard/page.tsx does) and computed each member's `gated` flag via
 * `isMemberGated()` -- this component renders whatever list it's given and makes no gating
 * decision of its own.
 */
export function FamilyStrip({ members, activeMemberId }: FamilyStripProps) {
  return (
    <section aria-labelledby="family-strip-heading" className="mt-10 sm:mt-14">
      {/* sr-only: the family strip IS the hero here, not a labeled sub-section of it -- a
          visible "Family" caption above a row of avatars big enough to read from across a room
          would be redundant clutter this redesign is deliberately removing. The heading still
          exists (satisfying "sections use aria-labelledby") for screen reader users who benefit
          from the landmark name. */}
      <h2 id="family-strip-heading" className="sr-only">
        Family
      </h2>
      <ul className="flex flex-wrap justify-center gap-4 sm:gap-6 lg:gap-8">
        {members.map((member) => {
          const isActive = member.id === activeMemberId;
          return (
            <li key={member.id} className="min-w-0">
              {member.gated ? (
                <PinDialog
                  member={{
                    id: member.id,
                    displayName: member.display_name,
                    color: member.color,
                    avatarUrl: member.avatar_url,
                  }}
                  isActive={isActive}
                />
              ) : (
                <form action={directSwitchAction}>
                  <input type="hidden" name="memberId" value={member.id} />
                  <button
                    type="submit"
                    // The visible label span below carries the plain display name only (so it
                    // can be found by its exact text, e.g. in tests/e2e/dashboard.spec.ts,
                    // without "(you)" polluting that text) -- the aria-label here layers the
                    // "you" cue on TOP for screen reader users instead, without changing what's
                    // rendered.
                    aria-label={isActive ? `${member.display_name} (you)` : undefined}
                    className={cn(
                      "flex min-h-[120px] w-full flex-col items-center justify-center gap-3 rounded-[18px] px-4 py-6 text-center shadow-elevation transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      isActive ? "bg-sunken ring-2 ring-accent" : "bg-surface ring-1 ring-[color:var(--color-muted)]",
                    )}
                  >
                    <MemberAvatar
                      displayName={member.display_name}
                      color={member.color}
                      avatarUrl={member.avatar_url}
                      size="lg"
                      ariaHidden
                    />
                    <span className="line-clamp-2 w-full min-w-0 break-words text-base font-medium text-ink">
                      {member.display_name}
                    </span>
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
