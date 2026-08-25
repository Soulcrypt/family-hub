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
import { MemberAvatar } from "@/components/family/member-avatar";
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
  "flex min-h-[120px] flex-col items-center gap-3 rounded-[18px] bg-surface px-4 py-6 text-center shadow-elevation ring-1 ring-[color:var(--color-muted)] transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * The "Add a family member" affordance -- a dialog housing the same shape of form as
 * app/onboarding/actions.ts's StepMembers, but wired to this route's own `addMemberAction`
 * (app/(app)/family/actions.ts) so submitting it revalidates "/family", not "/onboarding".
 * Kept private to this file: nothing outside MemberGrid needs to trigger it.
 */
function AddMemberDialog() {
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
            <select
              id="add-role"
              name="role"
              defaultValue="child"
              required
              className="min-h-[44px] w-full rounded-[12px] border border-[var(--color-muted)] bg-surface px-2.5 text-sm text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="add-color">Color</Label>
            <input
              id="add-color"
              name="color"
              type="color"
              defaultValue="#C4643C"
              className="h-11 w-16 cursor-pointer rounded-[12px] border border-[var(--color-muted)] bg-transparent p-1"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="add-birthday">Birthday</Label>
            <Input id="add-birthday" name="birthday" type="date" />
          </div>

          {state.error ? (
            <p role="alert" className="rounded-[12px] bg-destructive-bg px-4 py-3 text-sm text-destructive">
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
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-[18px] border border-dashed border-border px-6 py-16 text-center">
        <h2 className="text-xl">No one here yet.</h2>
        <p className="text-muted-foreground">Add the people who live in your household.</p>
        {canManage ? <AddMemberDialog /> : null}
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
                  <span className="line-clamp-2 w-full truncate break-words text-base font-medium text-ink">
                    {member.display_name}
                  </span>
                  <span className="text-sm text-muted-foreground">{ROLE_LABELS[member.role]}</span>
                  {birthday ? <span className="text-xs text-muted-foreground">{birthday}</span> : null}
                  <span className="text-xs text-muted-foreground">{member.points_balance} points</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {canManage ? <AddMemberDialog /> : null}
    </div>
  );
}
