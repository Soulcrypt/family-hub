import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { requireAccountMembership, getActiveMember } from "@/lib/auth/active-member";
import { requiresPin } from "@/lib/auth/permissions";
import { switchToMemberAction, type SwitchState } from "./actions";
import { MemberAvatar } from "@/components/family/member-avatar";
import { PinDialog } from "@/components/switcher/pin-dialog";

const INITIAL: SwitchState = { error: null };

const TILE_CLASSNAME =
  "flex min-h-[120px] w-full flex-col items-center justify-center gap-3 rounded-[18px] bg-surface px-4 py-6 text-center shadow-elevation ring-1 ring-[color:var(--color-muted)] transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * The profile switcher -- a full-screen takeover (deliberately outside the `(app)` route
 * group, so no sidebar/shell wraps it) showing every active member of the household as a
 * tile. Tapping a tile changes ATTRIBUTION only, never authority: see
 * `switchToMemberAction`'s doc comment (app/switch/actions.ts) for the full split this
 * screen exists to preserve.
 *
 * A tile opens `PinDialog` only when it is `gated`: its role `requiresPin()`, it isn't the
 * caller's own row, AND `member_has_pin` (SECURITY DEFINER,
 * supabase/migrations/0019_member_pin_status_rpc.sql) says a PIN has genuinely been set.
 * `requiresPin()` alone used to be the whole test, which meant an admin profile that had
 * NEVER had a PIN set -- onboarding never sets one -- opened a dialog that could only ever
 * reject every guess, permanently locking that profile out (the P0 dead end the SP1
 * Foundation design review found; Jamie Rivera in the seed is exactly this case). Own-row
 * switching still never prompts, mirroring `switchToMemberAction`'s server-side skip (see its
 * doc comment for why: requiring a PIN to become yourself would be asking you to prove you're
 * the account you're already authenticated as). This is purely a UI-side mirror of the
 * server's decision, kept in sync deliberately -- the server independently re-derives both
 * checks (`isOwnRow` from `account.user_id`, "does this profile have a pin" from
 * `member_has_pin` itself), never trusting which component rendered a tile.
 *
 * Every `gated` tile opens `PinDialog`, which collects and submits the PIN client-side but
 * never verifies it there -- verification happens entirely inside `switchToMemberAction`,
 * server-side, via the `verify_member_pin` SECURITY DEFINER function. `PinDialog`'s own tile
 * also carries a lock badge (a decorative icon plus text in its accessible name) so the fact a
 * profile is PIN-protected is discoverable before tapping it, not only after.
 *
 * Not in proxy.ts's PUBLIC_PATHS, so an unauthenticated visitor never reaches this render --
 * the proxy already redirected them to /welcome. `requireAccountMembership()` additionally
 * assumes a household already exists, which holds for every real entry point to this page
 * (the shell's own "switch profile" link only renders once onboarding is done).
 *
 * A kiosk-mode wall tablet has no browser chrome, so without an in-app way out this screen is
 * a one-way door -- a curious tap on "Who's this?" from the sidebar would otherwise force
 * whoever's holding the tablet to commit to becoming someone. `getActiveMember()` (attribution
 * only, never gates anything -- see lib/auth/active-member.ts) tells us whether there's an
 * existing profile worth returning to: if so, a small "Cancel" link back to /dashboard
 * appears; if this is a genuinely fresh session with no prior profile, there is nothing to
 * cancel BACK TO, so the link is omitted entirely rather than shown disabled or pointing
 * nowhere useful -- keeping the screen exactly as minimal as before whenever there's truly
 * only one thing to do here.
 */
export default async function SwitchPage() {
  const account = await requireAccountMembership();
  const supabase = await createServerClient();
  const activeMember = await getActiveMember();

  const { data: members } = await supabase
    .from("household_members")
    .select("id, display_name, role, color, avatar_url, user_id")
    .eq("household_id", account.household_id)
    .eq("is_active", true)
    .order("created_at");

  // `requiresPin(role)` alone says nothing about whether a PIN was ever actually SET --
  // onboarding never sets one, so an admin profile with no PIN would otherwise show a dialog
  // that can only ever reject every guess (the P0 dead end the SP1 Foundation design review
  // found -- Jamie Rivera in the seed is exactly this case). `member_has_pin` (SECURITY
  // DEFINER, supabase/migrations/0019_member_pin_status_rpc.sql) answers the real question;
  // it's only worth asking for a member this UI would otherwise gate at all (an admin role,
  // not the caller's own row) -- every other tile is unconditionally ungated regardless of the
  // answer, so skipping the RPC call for those loses no correctness and saves a round trip.
  const membersWithPinStatus = await Promise.all(
    (members ?? []).map(async (member) => {
      const isOwnRow = member.user_id !== null && member.user_id === account.user_id;
      const gateable = requiresPin(member.role) && !isOwnRow;
      if (!gateable) return { member, isOwnRow, gated: false };
      const { data: hasPin } = await supabase.rpc("member_has_pin", { p_member_id: member.id });
      return { member, isOwnRow, gated: Boolean(hasPin) };
    }),
  );

  // A plain <form action={...}> needs a `(formData) => void | Promise<void>` action, but
  // switchToMemberAction resolves SwitchState (for PinDialog's useActionState) -- this thin
  // wrapper adapts one to the other for the no-PIN tiles below. On the only non-redirect
  // outcome ("That profile isn't available anymore", e.g. a member deactivated between render
  // and submit), the result is discarded and the browser's default form navigation simply
  // reloads /switch with current data; that's an acceptable degradation for a race this rare,
  // and PIN-gated tiles (the path that actually needs inline error text) get full feedback
  // via PinDialog's own useActionState below.
  async function directSwitch(formData: FormData): Promise<void> {
    "use server";
    await switchToMemberAction(INITIAL, formData);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16">
      {activeMember ? (
        <Link
          href="/dashboard"
          className="-ml-2 inline-flex min-h-[44px] w-fit items-center gap-1 self-start rounded-[12px] px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ChevronLeft size={18} aria-hidden />
          Cancel
        </Link>
      ) : null}

      <div className="text-center">
        <h1 className="text-3xl">Who’s this?</h1>
        <p className="mt-2 text-muted-foreground">Tap your name to switch profiles.</p>
      </div>

      <ul className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3">
        {membersWithPinStatus.map(({ member, gated }) => (
          <li key={member.id}>
            {gated ? (
              <PinDialog
                member={{
                  id: member.id,
                  displayName: member.display_name,
                  color: member.color,
                  avatarUrl: member.avatar_url,
                }}
              />
            ) : (
              <form action={directSwitch}>
                <input type="hidden" name="memberId" value={member.id} />
                <button type="submit" className={TILE_CLASSNAME}>
                  <MemberAvatar
                    displayName={member.display_name}
                    color={member.color}
                    avatarUrl={member.avatar_url}
                    size="lg"
                    ariaHidden
                  />
                  <span className="line-clamp-2 w-full break-words text-base font-medium text-ink">
                    {member.display_name}
                  </span>
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
