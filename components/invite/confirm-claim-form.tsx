"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmClaimAction, type ClaimState } from "@/app/invite/[token]/actions";
import { Button } from "@/components/ui/button";

const INITIAL: ClaimState = { error: null };

/**
 * The explicit confirm-and-submit step Task 14 fix round 3 added: `preview_invite` (read-only,
 * no mutation) already told the Server Component page what this token points to, and this form
 * is what turns a person's decision into the actual (irreversible, single-use) `accept_invite`
 * call, via `confirmClaimAction`. Nothing in this component talks to Supabase directly -- it
 * only renders what it was told and submits.
 *
 * A failed submit renders its error INLINE, right here, rather than replacing this whole screen
 * with a separate one -- consistent with how every other form in this codebase surfaces a
 * server action's rejection (e.g. components/auth/signup-form.tsx, components/family/member-
 * form.tsx). The "Continue" escape hatch only appears once an error exists, so the happy path
 * stays a single clean button.
 */
export function ConfirmClaimForm({
  token,
  householdName,
  memberName,
}: {
  token: string;
  householdName: string;
  memberName: string | null;
}) {
  const [state, action, pending] = useActionState(confirmClaimAction, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-6 text-center">
      <input type="hidden" name="token" value={token} />

      <div>
        <h1 className="text-3xl break-words">Join {householdName}?</h1>
        <p className="mt-2 break-words text-muted-foreground">
          {memberName ? (
            <>
              You’re joining as <strong className="text-ink">{memberName}</strong>.
            </>
          ) : (
            "You’ll join as a new member."
          )}
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="rounded-[12px] bg-destructive-bg px-4 py-3 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Joining…" : "Join the household"}
        </Button>
        {state.error ? (
          <Button asChild size="lg" variant="secondary">
            <Link href="/">Continue</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
