"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  updateMemberAction,
  deactivateMemberAction,
  setPinAction,
  type MemberState,
} from "@/app/(app)/family/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MemberAvatar } from "@/components/family/member-avatar";
import { ColorPicker } from "@/components/family/color-picker";
import { ROLES, ROLE_LABELS, type MemberRole } from "@/lib/constants/roles";
import { requiresPin } from "@/lib/auth/permissions";
import { BirthdayPicker, BirthdayReadOnly } from "@/components/family/birthday-picker";
import { formatBirthday } from "@/lib/utils";

export type FamilyMemberDetail = {
  id: string;
  display_name: string;
  role: MemberRole;
  color: string;
  avatar_url: string | null;
  birthday: string | null;
  points_balance: number;
};

const INITIAL: MemberState = { error: null };

type MemberFormProps = {
  member: FamilyMemberDetail;
  /** Whether the AUTHENTICATED account (never the attribution cookie) is an owner/parent. */
  canManage: boolean;
  /** Whether this page belongs to the authenticated account's own row. */
  isSelf: boolean;
};

/**
 * The "Set PIN" form, shown only when it can actually do something: `canSet` (viewer is
 * self or an admin -- matching `set_member_pin`'s own authority rule) AND the target role
 * `requiresPin()` (only owner/parent profiles are ever PIN-gated on the switcher -- see
 * lib/auth/permissions.ts). There is deliberately no indication of whether a PIN is already
 * set: `household_members.pin_hash` isn't SELECTable by `authenticated` at all (Task 12 fix
 * round 2), so the client has no way to know -- this form always reads as "set or change the
 * PIN," never "a PIN is/isn't set."
 */
function SetPinForm({ memberId }: { memberId: string }) {
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
    <div className="flex flex-col gap-3 glass rounded-card px-5 py-5">
      <div>
        <h2 className="text-[15px] font-semibold text-text">Pin</h2>
        <p className="text-[13px] text-text-secondary">
          Used to switch into this profile on a shared device.
        </p>
      </div>
      <form ref={formRef} action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="memberId" value={memberId} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="pin">New pin</Label>
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
            {pending ? "Saving…" : "Save pin"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** The destructive "Remove from household" action, gated behind a confirmation dialog. */
function DeactivateDialog({ memberId, displayName }: { memberId: string; displayName: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deactivateMemberAction, INITIAL);
  const router = useRouter();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && state.error === null) {
      setOpen(false);
      router.push("/family");
    }
    wasPending.current = pending;
  }, [pending, state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructiveOutline" className="self-start">
          Remove from household
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {displayName}?</DialogTitle>
          <DialogDescription>
            They’ll no longer appear in your household. This can be undone later in Settings.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="memberId" value={memberId} />
          {state.error ? (
            <p role="alert" className="rounded-inset bg-danger/10 px-4 py-3 text-[13px] text-danger-text">
              {state.error}
            </p>
          ) : null}
          <DialogFooter showCloseButton>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Plain facts, no inputs -- rendered when the viewer may neither manage members nor edit this
 * particular row (a non-admin looking at someone else's profile). */
function ReadOnlyDetails({ member }: { member: FamilyMemberDetail }) {
  const birthday = formatBirthday(member.birthday);
  return (
    <dl className="flex flex-col gap-3 glass rounded-card px-5 py-5">
      <div>
        <dt className="text-[13px] text-text-secondary">Role</dt>
        <dd className="text-[15px] text-text">{ROLE_LABELS[member.role]}</dd>
      </div>
      <div>
        <dt className="text-[13px] text-text-secondary">Birthday</dt>
        <dd className="text-[15px] text-text">{birthday ?? "Not set"}</dd>
      </div>
      <div>
        <dt className="text-[13px] text-text-secondary">Points</dt>
        <dd className="text-[15px] text-text">{member.points_balance}</dd>
      </div>
    </dl>
  );
}

export function MemberForm({ member, canManage, isSelf }: MemberFormProps) {
  const [state, formAction, pending] = useActionState(updateMemberAction, INITIAL);
  const canEdit = canManage || isSelf;
  const canDeactivate = canManage && !isSelf;
  const canSetPin = (canManage || isSelf) && requiresPin(member.role);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/family"
        className="-ml-2 inline-flex min-h-[44px] w-fit items-center gap-1 self-start rounded-inset px-2 text-[13px] font-medium text-text-secondary transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ChevronLeft size={18} aria-hidden />
        Back to family
      </Link>

      <div className="flex items-center gap-4">
        <MemberAvatar displayName={member.display_name} color={member.color} avatarUrl={member.avatar_url} size="lg" ariaHidden />
        <h1 className="min-w-0 truncate break-words text-3xl">{member.display_name}</h1>
      </div>

      {canEdit ? (
        <form action={formAction} className="flex flex-col gap-4 glass rounded-card px-5 py-5">
          <input type="hidden" name="memberId" value={member.id} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="displayName">Name</Label>
            <Input id="displayName" name="displayName" defaultValue={member.display_name} autoComplete="off" required maxLength={40} disabled={pending} />
          </div>

          <ColorPicker idPrefix="member" name="color" defaultValue={member.color} displayName={member.display_name} disabled={pending} />

          {canManage ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="role">Role</Label>
              <Select name="role" defaultValue={member.role} required disabled={pending}>
                <SelectTrigger id="role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="role">Role</Label>
              {/* Disabled controls are excluded from FormData on submit, so the real value
                  travels via the hidden input below -- the select here is display-only. */}
              <Select defaultValue={member.role} disabled>
                <SelectTrigger id="role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="role" value={member.role} />
              <p className="text-[13px] text-text-secondary">Only a parent or owner can change this.</p>
            </div>
          )}

          {canManage ? (
            <BirthdayPicker defaultValue={member.birthday} disabled={pending} />
          ) : (
            <div className="flex flex-col gap-2">
              <BirthdayReadOnly value={member.birthday} />
              {/* Still posted, so a non-admin submitting the rest of the form cannot silently
                  blank a birthday they were never allowed to edit. */}
              <input type="hidden" name="birthday" value={member.birthday ?? ""} />
              <p className="text-[13px] text-text-secondary">Only a parent or owner can change this.</p>
            </div>
          )}

          {state.error ? (
            <p role="alert" className="rounded-inset bg-danger/10 px-4 py-3 text-[13px] text-danger-text">
              {state.error}
            </p>
          ) : null}

          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      ) : (
        <ReadOnlyDetails member={member} />
      )}

      {canSetPin ? <SetPinForm memberId={member.id} /> : null}

      {canDeactivate ? <DeactivateDialog memberId={member.id} displayName={member.display_name} /> : null}
    </div>
  );
}
