import { createServerClient } from "@/lib/supabase/server";
import { requireAccountMembership } from "@/lib/auth/active-member";
import { requiresPin } from "@/lib/auth/permissions";
import { switchToMemberAction, type SwitchState } from "./actions";
import { MemberAvatar } from "@/components/family/member-avatar";
import { PinDialog } from "@/components/switcher/pin-dialog";

const INITIAL: SwitchState = { error: null };

const TILE_CLASSNAME =
  "flex min-h-[120px] w-full flex-col items-center justify-center gap-3 rounded-[18px] bg-surface px-4 py-6 text-center ring-1 ring-foreground/10 transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * The profile switcher -- a full-screen takeover (deliberately outside the `(app)` route
 * group, so no sidebar/shell wraps it) showing every active member of the household as a
 * tile. Tapping a tile changes ATTRIBUTION only, never authority: see
 * `switchToMemberAction`'s doc comment (app/switch/actions.ts) for the full split this
 * screen exists to preserve.
 *
 * A tile opens `PinDialog` only when its role `requiresPin()` AND it isn't the caller's own
 * row -- switching into your OWN profile never prompts, mirroring `switchToMemberAction`'s
 * server-side skip (see its doc comment for why: requiring a PIN to become yourself would be
 * asking you to prove you're the account you're already authenticated as, and would otherwise
 * permanently lock an owner out of their own profile the moment they switched away from it,
 * since onboarding never sets one). This is purely a UI-side mirror of that decision, kept in
 * sync deliberately -- the server independently re-derives it from `account.user_id`, never
 * trusting which component rendered a tile.
 *
 * Every other admin tile opens `PinDialog`, which collects and submits the PIN client-side
 * but never verifies it there -- verification happens entirely inside `switchToMemberAction`,
 * server-side, via the `verify_member_pin` SECURITY DEFINER function.
 *
 * Not in proxy.ts's PUBLIC_PATHS, so an unauthenticated visitor never reaches this render --
 * the proxy already redirected them to /welcome. `requireAccountMembership()` additionally
 * assumes a household already exists, which holds for every real entry point to this page
 * (the shell's own "switch profile" link only renders once onboarding is done).
 */
export default async function SwitchPage() {
  const account = await requireAccountMembership();
  const supabase = await createServerClient();

  const { data: members } = await supabase
    .from("household_members")
    .select("id, display_name, role, color, avatar_url, user_id")
    .eq("household_id", account.household_id)
    .eq("is_active", true)
    .order("created_at");

  // A plain <form action={...}> needs a `(formData) => void | Promise<void>` action, but
  // switchToMemberAction resolves SwitchState (for PinDialog's useActionState) -- this thin
  // wrapper adapts one to the other for the no-PIN tiles below. On the only non-redirect
  // outcome ("That profile is not available", e.g. a member deactivated between render and
  // submit), the result is discarded and the browser's default form navigation simply
  // reloads /switch with current data; that's an acceptable degradation for a race this rare,
  // and PIN-gated tiles (the path that actually needs inline error text) get full feedback
  // via PinDialog's own useActionState below.
  async function directSwitch(formData: FormData): Promise<void> {
    "use server";
    await switchToMemberAction(INITIAL, formData);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="text-center">
        <h1 className="text-3xl">Who&apos;s this?</h1>
        <p className="mt-2 text-muted">Tap your name to switch profiles.</p>
      </div>

      <ul className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3">
        {(members ?? []).map((member) => {
          const isOwnRow = member.user_id !== null && member.user_id === account.user_id;
          return (
            <li key={member.id}>
              {requiresPin(member.role) && !isOwnRow ? (
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
                    <span className="text-base font-medium text-ink">{member.display_name}</span>
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
