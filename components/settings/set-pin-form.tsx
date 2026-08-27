"use client";

import { useActionState, useEffect, useRef } from "react";
import { setPinAction, type MemberState } from "@/app/(app)/family/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: MemberState = { error: null };

/**
 * Self-service "set or change your own PIN" control, wired to the same `setPinAction`
 * (app/(app)/family/actions.ts) as the per-member form on /family/[memberId] -- this one
 * always targets `memberId`, which the page passes as whichever profile is currently "you"
 * (the active-member cookie if one is set, else the account's own row -- see
 * app/(app)/settings/page.tsx). Not gated on any role here: `set_member_pin` itself allows
 * anyone to set THEIR OWN pin, so this control is offered to every viewer regardless of
 * `canEditSettings`/`canManageMembers`.
 *
 * As with the identical form on /family/[memberId], there is deliberately no way to show
 * whether a PIN is already set -- `pin_hash` isn't SELECTable by clients at all -- so this
 * always reads as "set or change," never "you have no PIN."
 */
export function SetPinForm({ memberId }: { memberId: string }) {
  const [state, formAction, pending] = useActionState(setPinAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && state.error === null) {
      formRef.current?.reset();
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <div className="glass flex flex-col gap-3 rounded-card px-5 py-5">
      <div>
        <h3 className="text-[15px] font-semibold text-text">Your PIN</h3>
        <p className="text-[13px] text-text-secondary">Used to switch into your profile on a shared device.</p>
      </div>
      <form ref={formRef} action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="memberId" value={memberId} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="pin">Set or change your PIN</Label>
          <Input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            maxLength={4}
            required
            className="max-w-[8rem]"
          />
        </div>
        {state.error ? (
          <p role="alert" className="rounded-inset bg-danger/10 px-4 py-3 text-[13px] text-danger-text">
            {state.error}
          </p>
        ) : null}
        <div>
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Saving…" : "Save PIN"}
          </Button>
        </div>
      </form>
    </div>
  );
}
