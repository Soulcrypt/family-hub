import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ConfirmClaimForm } from "@/components/invite/confirm-claim-form";
import { friendlyClaimError } from "./friendly-error";

type InvitePreview = { household_name: string | null; member_display_name: string | null };

/**
 * The claim flow's landing page -- public (`/invite` is in `PUBLIC_PATHS`,
 * lib/supabase/middleware.ts) because the whole point is that the invited person does not have
 * an account yet.
 *
 * Signed out: explains the invitation and sends the visitor to sign up (or sign in, for
 * someone who already has an account elsewhere) with `?next=/invite/<token>` so they land back
 * on THIS SAME invite afterward, instead of the ordinary onboarding/home redirect --
 * app/(auth)/actions.ts's `safeNextPath` re-validates that query param before ever using it as
 * a redirect target. This branch never queries `household_invites` at all -- a bogus token and
 * a real one produce byte-identical output here, so there is no existence oracle for a
 * signed-out visitor.
 *
 * Signed in: Task 14 fix round 3 -- this branch used to call `accept_invite` directly during
 * this very render (a plain GET). Claiming is IRREVERSIBLE (the token is single-use), so
 * anything that triggered this RPC without the person's explicit intent -- most plausibly their
 * OWN browser or client prefetching a hovered/visible link -- would permanently burn a real
 * invitation before they ever decided to click anything. This project's interface guidelines
 * require confirmation before an irreversible action, never immediate execution on render.
 *
 * The fix: this render now only PREVIEWS the token, via the read-only `preview_invite` RPC
 * (supabase/migrations/0014_invite_preview_rpc.sql) -- it mutates nothing, so rendering its
 * result on a plain GET is exactly as safe as every other read this page already does. If the
 * token itself is invalid (not found / expired / already used), that's shown immediately, same
 * as before -- nothing has been risked by looking. If it's valid, `ConfirmClaimForm`
 * (components/invite/confirm-claim-form.tsx) renders what the person is about to do -- which
 * household, and whose profile -- with a single button. Only pressing that button submits
 * `confirmClaimAction` (app/invite/[token]/actions.ts), which is the one and only place
 * `accept_invite` itself is still called. Every guard that decides whether the token is
 * genuinely redeemable by THIS caller (expiry, reuse, cross-household mismatch,
 * already-claimed, already-a-member of this household -- active or removed -- already-a-member
 * of a different household) still lives entirely inside that RPC; this page and its preview
 * never reimplement, duplicate, or pre-check any of it.
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
          <Button asChild size="lg" variant="secondary">
            <Link href={`/login?next=${encodeURIComponent(next)}`}>I already have an account</Link>
          </Button>
        </div>
      </main>
    );
  }

  const { data, error } = await supabase.rpc("preview_invite", { p_token: token });

  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 text-center">
        <h1 className="text-3xl">We couldn’t add you</h1>
        <p role="alert" className="rounded-[12px] bg-destructive-bg px-4 py-3 text-sm text-destructive">
          {friendlyClaimError(error.message)}
        </p>
        {/* "/dashboard" doesn't exist yet (Task 16) and "/" always knows the right place to
            send a signed-in account -- onboarding, dashboard, or wherever this account already
            belongs. */}
        <Button asChild size="lg">
          <Link href="/">Continue</Link>
        </Button>
      </main>
    );
  }

  const preview = data as InvitePreview;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6">
      <ConfirmClaimForm
        token={token}
        householdName={preview.household_name ?? "your household"}
        memberName={preview.member_display_name}
      />
    </main>
  );
}
