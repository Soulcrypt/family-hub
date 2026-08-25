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

  useEffect(() => {
    if (!open) formRef.current?.reset();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex min-h-[120px] w-full flex-col items-center justify-center gap-3 rounded-[18px] bg-surface px-4 py-6 text-center ring-1 ring-foreground/10 transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <MemberAvatar displayName={member.displayName} color={member.color} avatarUrl={member.avatarUrl} size="lg" ariaHidden />
          <span className="text-base font-medium text-ink">{member.displayName}</span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member.displayName}&apos;s profile</DialogTitle>
          <DialogDescription>Enter the PIN to switch to this profile.</DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="memberId" value={member.id} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="pin">PIN</Label>
            <Input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={4}
              autoFocus
              required
            />
          </div>

          {state.error ? (
            <p role="alert" className="rounded-[12px] bg-[#F5DEDA] px-4 py-3 text-sm text-[#9B4A38]">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Unlocking…" : "Unlock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
