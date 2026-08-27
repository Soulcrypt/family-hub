"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
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
import { MemberAvatar } from "@/components/family/member-avatar";
import { PinPad, type PinPadHandle } from "@/components/switcher/pin-pad";
import { cn } from "@/lib/utils";

const INITIAL: SwitchState = { error: null };

export type PinDialogMember = {
  id: string;
  displayName: string;
  color: string;
  avatarUrl: string | null;
};

/**
 * The switcher tile for a profile the caller (app/switch/page.tsx) has determined is
 * genuinely `gated` -- an admin role AND a PIN actually set, per `member_has_pin` (SECURITY
 * DEFINER, supabase/migrations/0019_member_pin_status_rpc.sql) -- so clicking it opens a
 * dialog asking for a PIN instead of switching immediately. The PIN is a convenience lock
 * (stops a child wandering into a parent's view on the shared tablet), verified entirely
 * server-side by `switchToMemberAction`; this component only collects and submits it. A wrong
 * PIN shows the server's error message and leaves the active profile unchanged.
 *
 * The tile itself carries a small lock badge on the avatar so the fact a profile is
 * PIN-protected is visible before tapping, not only after -- an sr-only "PIN protected" suffix
 * on the tile's own text makes the same state part of its accessible name, not just a
 * decorative icon nothing but sighted users can perceive.
 *
 * `isActive` (default `false`, so every existing app/switch/page.tsx call site renders
 * byte-for-byte as before) lets a caller ring-highlight this tile as the currently ATTRIBUTED
 * member -- app/(app)/dashboard/page.tsx's family strip needs this (SP1 Foundation's one-tap
 * dashboard reuses this exact component for its gated tiles rather than inventing a second
 * gated-tile UI), because a PIN-gated profile CAN be the one currently active on this device
 * (e.g. a co-parent already switched into it) and the ring is how the strip shows "you" today.
 */
export function PinDialog({ member, isActive = false }: { member: PinDialogMember; isActive?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(switchToMemberAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const padRef = useRef<PinPadHandle>(null);

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
    // Falling edge of `open`: the dialog just closed. Reset the form (and the pad's own typed
    // digits/dots) and forget any leftover error so reopening starts clean.
    if (wasOpen.current && !open) {
      formRef.current?.reset();
      padRef.current?.reset();
      setDisplayedError("");
    }
    wasOpen.current = open;

    // Falling edge of `pending`: a submission just resolved. Show its error, if any, and clear
    // + refocus the pad -- a wrong 4-digit guess otherwise can't be typed over, and refocusing
    // keeps the "just start typing" affordance Radix's own dialog-open focus gave.
    if (wasPending.current && !pending && state.error) {
      setDisplayedError(state.error);
      padRef.current?.reset();
      padRef.current?.focus();
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
          className={cn(
            "glass flex min-h-[120px] w-full flex-col items-center justify-center gap-3 rounded-card px-4 py-6 text-center transition-colors hover:bg-glass-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            isActive ? "bg-glass-hover ring-2 ring-accent" : "",
          )}
        >
          <span className="relative inline-flex">
            <MemberAvatar displayName={member.displayName} color={member.color} avatarUrl={member.avatarUrl} size="lg" ariaHidden />
            {/* Decorative -- the accessible name below (the sr-only "PIN protected" text) is
                what actually tells assistive tech this tile is gated; this icon is a purely
                visual affordance for sighted users so the lock is discoverable before tapping,
                not only after a dialog opens. */}
            <span
              aria-hidden
              className="glass absolute -right-1 -bottom-1 inline-flex size-6 items-center justify-center rounded-full text-text-secondary"
            >
              <Lock size={13} />
            </span>
          </span>
          <span className="line-clamp-2 w-full break-words text-[15px] font-semibold text-text">
            {member.displayName}
            <span className="sr-only"> — PIN protected{isActive ? " (you)" : ""}</span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member.displayName}’s profile</DialogTitle>
          <DialogDescription>Enter the PIN to switch to this profile.</DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="memberId" value={member.id} />

          <PinPad
            ref={padRef}
            ariaLabel="PIN"
            disabled={pending}
            onComplete={() => formRef.current?.requestSubmit()}
          />

          {/* Always mounted -- an alert region that only appears once an error exists can't
              serve as a persistent live region, which is what a SECOND identical error needs
              to be re-announced (see the effect above). Empty renders as no visible box. */}
          <p
            role="alert"
            className={cn(
              "text-center rounded-inset text-[13px] text-danger-text",
              displayedError ? "bg-danger/10 px-4 py-3" : "",
            )}
          >
            {displayedError}
          </p>

          {/* No visible submit button -- Design-Spec §6's PIN pad is meant to auto-verify once
              the 4th digit lands (`PinPad`'s `onComplete`), or on Enter with 4 digits already
              typed. "Cancel" (from `showCloseButton`) is the only other action a PIN dialog
              needs. */}
          <DialogFooter showCloseButton />
        </form>
      </DialogContent>
    </Dialog>
  );
}
