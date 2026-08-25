"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { addMemberAction, type ActionState } from "@/app/onboarding/actions";
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
import { ROLES, ROLE_LABELS, type MemberRole } from "@/lib/constants/roles";

const INITIAL: ActionState = { error: null };

export type OnboardingMember = {
  id: string;
  display_name: string;
  role: MemberRole;
  color: string;
};

export function StepMembers({ members }: { members: OnboardingMember[] }) {
  const [open, setOpen] = useState(false);
  const [hasLogin, setHasLogin] = useState(false);
  const [state, formAction, pending] = useActionState(addMemberAction, INITIAL);
  const wasPending = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (wasPending.current && !pending && state.error === null) {
      setOpen(false);
      setHasLogin(false);
      formRef.current?.reset();
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-8 px-6 py-16">
      <Link
        href="/onboarding?step=household"
        className="-ml-2 inline-flex min-h-[44px] w-fit items-center gap-1 rounded-[12px] px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ChevronLeft size={18} aria-hidden />
        Back
      </Link>

      <div>
        <p className="text-sm text-muted-foreground">Step 3 of 4</p>
        <h1 className="text-3xl">Add your family</h1>
        <p className="mt-2 text-muted-foreground">
          Add the people in your household now, or skip this and add them anytime in Settings.
        </p>
      </div>

      {members.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No family members yet. Add one below, or continue and add them later.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-3 rounded-[14px] bg-surface px-4 py-3 ring-1 ring-foreground/10"
            >
              <span
                aria-hidden="true"
                className="size-8 shrink-0 rounded-full"
                style={{ backgroundColor: member.color }}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{member.display_name}</span>
                <span className="text-xs text-muted-foreground">{ROLE_LABELS[member.role]}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="lg">
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
              <Label htmlFor="displayName">Name</Label>
              <Input id="displayName" name="displayName" autoComplete="off" required maxLength={40} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
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
              <Label htmlFor="color">Color</Label>
              <input
                id="color"
                name="color"
                type="color"
                defaultValue="#C4643C"
                className="h-11 w-16 cursor-pointer rounded-[12px] border border-[var(--color-muted)] bg-transparent p-1"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="birthday">Birthday</Label>
              <Input id="birthday" name="birthday" type="date" />
            </div>

            <label className="flex min-h-[44px] items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="hasLogin"
                checked={hasLogin}
                onChange={(event) => setHasLogin(event.target.checked)}
                className="size-5 shrink-0 rounded border-[var(--color-muted)]"
              />
              They’ll have their own login
            </label>
            {hasLogin ? (
              <p className="text-xs text-muted-foreground">
                Invites aren’t available yet — for now they’ll be added without a way to sign in
                themselves, and you can invite them once that’s ready.
              </p>
            ) : null}

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

      <Button asChild size="lg">
        <Link href="/onboarding?step=features">Continue</Link>
      </Button>
    </main>
  );
}
