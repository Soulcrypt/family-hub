"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { addMemberAction, type MemberState } from "@/app/(app)/family/actions";
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
import { BirthdayPicker } from "@/components/family/birthday-picker";
import { ColorPicker } from "@/components/family/color-picker";
import { nextAvailableMemberColor } from "@/lib/constants/member-color-swatches";
import { ROLES, ROLE_LABELS, type MemberRole } from "@/lib/constants/roles";
import { formatBirthday } from "@/lib/utils";

export type FamilyMember = {
  id: string;
  display_name: string;
  role: MemberRole;
  color: string;
  avatar_url: string | null;
  birthday: string | null;
  points_balance: number;
};

const INITIAL: MemberState = { error: null };

const CARD_CLASSNAME =
  "glass flex min-h-[120px] flex-col items-center gap-3 rounded-card px-4 py-6 text-center transition-colors hover:bg-glass-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * The "Add a family member" affordance -- a dialog housing the same shape of form as
 * app/onboarding/actions.ts's StepMembers, but wired to this route's own `addMemberAction`
 * (app/(app)/family/actions.ts) so submitting it revalidates "/family", not "/onboarding".
 * Kept private to this file: nothing outside MemberGrid needs to trigger it.
 *
 * Takes `usedColors` so the colour picker OPENS on a swatch nobody has yet, rather than the
 * same default every time -- see `nextAvailableMemberColor`. A parent adding three children in
 * a row and accepting the default each time should end up with three children they can tell
 * apart from across the kitchen.
 */
function AddMemberDialog({ usedColors }: { usedColors: string[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addMemberAction, INITIAL);
  const wasPending = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (wasPending.current && !pending && state.error === null) {
      setOpen(false);
      formRef.current?.reset();
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="lg">
          Add a family member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a family member</DialogTitle>
          <DialogDescription>They’ll show up in your household right away.</DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-displayName">Name</Label>
            <Input id="add-displayName" name="displayName" autoComplete="off" required maxLength={40} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="add-role">Role</Label>
            <Select name="role" defaultValue="child" required>
              <SelectTrigger id="add-role" className="w-full">
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

          <ColorPicker
            idPrefix="add-member"
            name="color"
            defaultValue={nextAvailableMemberColor(usedColors)}
            displayName=""
          />

          <div className="flex flex-col gap-2">
<BirthdayPicker idPrefix="add-birthday" />
          </div>

          {state.error ? (
            <p role="alert" className="rounded-inset bg-danger/10 px-4 py-3 text-[13px] text-danger-text">
              {state.error}
            </p>
          ) : null}

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The family roster -- every active member of the household as a tappable card linking to
 * their detail page (app/(app)/family/[memberId]/page.tsx). `canManage` gates the "Add a
 * family member" affordance only; viewing the grid itself is not privileged (every household
 * member, admin or not, can see who else is in it -- RLS's `members_select_household` already
 * allows this for anyone in the same household).
 */
export function MemberGrid({ members, canManage }: { members: FamilyMember[]; canManage: boolean }) {
  const usedColors = members.map((member) => member.color);

  if (members.length === 0) {
    return (
      <div className="dashed flex flex-col items-center gap-4 rounded-card px-6 py-16 text-center">
        <h2 className="text-[20px] font-bold tracking-[-0.01em] text-text">No one here yet.</h2>
        <p className="text-[14px] text-text-secondary">Add the people who live in your household.</p>
        {canManage ? <AddMemberDialog usedColors={usedColors} /> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {members.map((member) => {
          const birthday = formatBirthday(member.birthday);
          return (
            <li key={member.id} className="min-w-0">
              <Link href={`/family/${member.id}`} className={CARD_CLASSNAME}>
                <MemberAvatar
                  displayName={member.display_name}
                  color={member.color}
                  avatarUrl={member.avatar_url}
                  size="lg"
                  ariaHidden
                />
                <div className="flex min-w-0 w-full flex-col gap-0.5">
                  <span className="line-clamp-2 w-full break-words text-[15px] font-semibold text-text">
                    {member.display_name}
                  </span>
                  <span className="text-[13px] text-text-secondary">{ROLE_LABELS[member.role]}</span>
                  {birthday ? <span className="text-[12px] text-text-tertiary">{birthday}</span> : null}
                  <span className="text-[12px] text-text-tertiary">{member.points_balance} points</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {canManage ? <AddMemberDialog usedColors={usedColors} /> : null}
    </div>
  );
}
