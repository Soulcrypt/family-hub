"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { switchToMemberAction, type SwitchState } from "@/app/switch/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MemberAvatar } from "@/components/family/member-avatar";
import { cn } from "@/lib/utils";

const INITIAL: SwitchState = { error: null };

export type PinDialogMember = {
  id: string;
  displayName: string;
  color: string;
  avatarUrl: string | null;
};

/**
 * The switcher tile for a profile whose role `requiresPin()` -- clicking it opens a dialog
 * asking for a PIN instead of switching immediately. The PIN is a convenience lock (stops a
 * child wandering into a parent's view on the shared tablet), verified entirely server-side
 * by `switchToMemberAction`; this component only collects and submits it. A wrong PIN shows
 * the server's error message and leaves the active profile unchanged.
 */
export function PinDialog({ member }: { member: PinDialogMember }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(switchToMemberAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  // `state` lives on this component, which stays mounted for the switcher's whole lifetime --
  // useActionState has no way to reset it directly -- so without this, closing the dialog on
  // an error and reopening it shows that SAME "Incorrect PIN" before the user has typed
  // anything this time. `displayedError`, not `state.error`, is what actually renders.
  const [displayedError, setDisplayedError] = useState("");

  // Refs, not plain `if (!open)`/`if (pending)` checks on their own, because what matters is
  // the TRANSITION (open -> closed, pending -> settled), not the current value alone -- a
  // value derivable purely from this render's own props/state belongs in the render body, not
  // an effect (see "You Might Not Need an Effect" -- also why step-members.tsx's identical
  // wasPending-ref pattern is the existing precedent for this in the codebase).
  const wasOpen = useRef(open);
  const wasPending = useRef(pending);

  useEffect(() => {
    // Falling edge of `open`: the dialog just closed. Reset the form and forget any leftover
    // error so reopening starts clean.
    if (wasOpen.current && !open) {
      formRef.current?.reset();
      setDisplayedError("");
    }
    wasOpen.current = open;

    // Falling edge of `pending`: a submission just resolved. Show its error, if any, and clear
    // + refocus the PIN field -- maxLength={4} means a wrong 4-digit guess otherwise can't be
    // typed over, and refocusing keeps the "just start typing" affordance autoFocus gave on
    // open.
    if (wasPending.current && !pending && state.error) {
      setDisplayedError(state.error);
      if (pinRef.current) {
        pinRef.current.value = "";
        pinRef.current.focus();
      }
    }

    // Rising edge of `pending`: a new attempt just started. Clear the displayed error
    // immediately, before the result arrives. If the next result is the SAME message as last
    // time ("Incorrect PIN" again), state.error is an equal string and React bails out of
    // touching this role="alert" node's text at all -- nothing changes, so nothing gets
    // announced to assistive tech. Routing every attempt through an empty transitional state
    // first turns even a repeated identical error into a real content change.
    if (!wasPending.current && pending) {
      setDisplayedError("");
    }
    wasPending.current = pending;
  }, [open, pending, state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex min-h-[120px] w-full flex-col items-center justify-center gap-3 rounded-[18px] bg-surface px-4 py-6 text-center shadow-elevation ring-1 ring-[color:var(--color-muted)] transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <MemberAvatar displayName={member.displayName} color={member.color} avatarUrl={member.avatarUrl} size="lg" ariaHidden />
          <span className="line-clamp-2 w-full break-words text-base font-medium text-ink">{member.displayName}</span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member.displayName}’s profile</DialogTitle>
          <DialogDescription>Enter the PIN to switch to this profile.</DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="memberId" value={member.id} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="pin">PIN</Label>
            <Input
              ref={pinRef}
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={4}
              required
            />
          </div>

          {/* Always mounted -- an alert region that only appears once an error exists can't
              serve as a persistent live region, which is what a SECOND identical error needs
              to be re-announced (see the effect above). Empty renders as no visible box. */}
          <p
            role="alert"
            className={cn("rounded-[12px] text-sm text-destructive", displayedError ? "bg-destructive-bg px-4 py-3" : "")}
          >
            {displayedError}
          </p>

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={pending}>
              {pending ? "Unlocking…" : "Unlock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
