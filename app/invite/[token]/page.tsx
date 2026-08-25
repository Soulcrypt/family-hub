import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getAccountMembership } from "@/lib/auth/active-member";
import { Button } from "@/components/ui/button";

/**
 * Maps `accept_invite`'s own error text (supabase/migrations/0008_bootstrap_display_name_hardening.sql,
 * pgTAP-covered by supabase/tests/020_bootstrap.sql and supabase/tests/040_claim.sql) to
 * user-facing copy. These are Postgres RAISE EXCEPTION messages, not written for an end user,
 * so each one this page can say something specific and useful about is named explicitly here;
 * anything unrecognized falls through to one generic, always-safe message -- same pattern as
 * every other action in this codebase (see e.g. app/(app)/family/actions.ts's genericErrorFor).
 */
function friendlyClaimError(message: string): string {
  switch (message) {
    case "invitation not found":
      return "This invitation link isn't valid. Ask whoever invited you to send a new one.";
    case "invitation already used":
      return "This invitation has already been used.";
    case "invitation expired":
      return "This invitation has expired. Ask whoever invited you to send a new one.";
    case "profile already claimed":
      return "This family member already has their own login.";
    case "you are already a member of this household":
      return "You're already a member of this household.";
    default:
      return "We couldn't add you to this household. Please try again.";
  }
}

/**
 * The claim flow's landing page -- public (`/invite` is in `PUBLIC_PATHS`,
 * lib/supabase/middleware.ts) because the whole point is that the invited person does not have
 * an account yet.
 *
 * Signed out: explains the invitation and sends the visitor to sign up (or sign in, for
 * someone who already has an account elsewhere) with `?next=/invite/<token>` so they land back
 * on THIS SAME invite afterward, instead of the ordinary onboarding/home redirect --
 * app/(auth)/actions.ts's `safeNextPath` re-validates that query param before ever using it as
 * a redirect target.
 *
 * Signed in: calls `accept_invite` directly and redirects to `/dashboard` on success. Every
 * guard that decides whether a token is genuinely redeemable (expiry, reuse, cross-household
 * member_id mismatch, already-claimed, already-a-member) lives entirely inside that RPC -- this
 * page does not reimplement any of it, only surfaces whatever it decides.
 *
 * One guard this page DOES add on top of that, deliberately: `accept_invite`'s own
 * "already a member" check is scoped only to the invite's OWN household (`household_id =
 * v_invite.household_id and user_id = v_uid`), not to whether the caller belongs to ANY
 * household. A signed-in account that already belongs to a DIFFERENT household -- e.g. someone
 * who clicks a stranger's invite link out of curiosity, or is sent one in bad faith -- would
 * otherwise sail through accept_invite's new-member path and end up with a SECOND active
 * `household_members` row. This app's whole authority model
 * (`lookupAccountMembership()`/`requireAccountMembership()`, lib/auth/active-member.ts)
 * assumes exactly one, and treats a second as `MultipleHouseholdMembershipsError` -- an
 * unrecoverable lockout from every authority-gated page, not merely a rejected request. Refusing
 * here, before ever calling the RPC, is cheap insurance against a real account-corrupting
 * outcome, and does not weaken anything `accept_invite` itself guarantees.
 */
export default async function InviteClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = `/invite/${token}`;
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 text-center">
        <h1 className="text-3xl">You’ve been invited to Family Hub</h1>
        <p className="text-muted-foreground">
          Create your account to join your household and pick up right where you left off.
        </p>
        <div className="flex flex-col gap-3">
          <Button asChild size="lg">
            <Link href={`/signup?next=${encodeURIComponent(next)}`}>Create your account</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={`/login?next=${encodeURIComponent(next)}`}>I already have an account</Link>
          </Button>
        </div>
      </main>
    );
  }

  const existingMembership = await getAccountMembership();
  if (existingMembership) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 text-center">
        <h1 className="text-3xl">You already belong to a household</h1>
        <p role="alert" className="rounded-[12px] bg-destructive-bg px-4 py-3 text-sm text-destructive">
          Family Hub supports one household per account right now, so this invitation can’t be accepted from this
          account.
        </p>
        <Button asChild size="lg">
          <Link href="/">Go to your household</Link>
        </Button>
      </main>
    );
  }

  const { error } = await supabase.rpc("accept_invite", { p_token: token });
  if (!error) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl">We couldn’t add you</h1>
      <p role="alert" className="rounded-[12px] bg-destructive-bg px-4 py-3 text-sm text-destructive">
        {friendlyClaimError(error.message)}
      </p>
      {/* "/dashboard" doesn't exist yet (Task 16) and "/" always knows the right place to send
          a signed-in account -- onboarding, dashboard, or (for the "already used"/"already
          claimed" cases) wherever this account already belongs. */}
      <Button asChild size="lg">
        <Link href="/">Continue</Link>
      </Button>
    </main>
  );
}
