"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
import { BirthdayPicker } from "@/components/family/birthday-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ColorPicker } from "@/components/family/color-picker";
import { MemberAvatar } from "@/components/family/member-avatar";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { nextAvailableMemberColor } from "@/lib/constants/member-color-swatches";
import { ROLES, ROLE_LABELS, type MemberRole } from "@/lib/constants/roles";

const INITIAL: ActionState = { error: null };

export type OnboardingMember = {
  id: string;
  display_name: string;
  role: MemberRole;
  color: string;
};

/**
 * Mock 4c. Row shape: colored avatar + name + role pill, per this task's brief. Role vocabulary
 * stays exactly `lib/constants/roles.ts`'s `ROLES` ("owner" | "parent" | "teen" | "child") —
 * the mock and Design-Spec §8.10 both say "parent / kid / toddler", but `member_role`
 * (supabase/migrations/0001_schema.sql:1) is a Postgres enum of `('owner', 'parent', 'teen',
 * 'child')`. Writing "kid" or "toddler" here would be rejected by the database outright; see
 * this task's report for the full disagreement.
 */
export function StepMembers({ members, viewerMemberId }: { members: OnboardingMember[]; viewerMemberId: string }) {
  // Open the picker on a swatch nobody in this household has yet, so a parent adding several
  // children in one sitting and accepting the default each time still gets people they can
  // tell apart -- see `nextAvailableMemberColor`.
  const usedColors = members.map((member) => member.color);

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
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-4 px-6 py-8">
      {/* No Back control on this step, deliberately: by the time this step renders, a
          household already exists and cannot be un-created (see app/onboarding/page.tsx's
          resumability guard, which unconditionally bounces any visit to ?step=household back
          to here once membership exists -- tests/e2e/onboarding.spec.ts asserts exactly
          that). A Back link here would render, get clicked, and visibly do nothing --
          confirmed by testing it, not just reasoning about it -- which reads as "the app is
          broken," a worse outcome than having no control at all. There genuinely is nowhere
          earlier to go back to; the honest interface says so by omission. (An explicit
          "rename household" affordance would belong to Settings, Task 15 -- not this step.) */}
      <OnboardingProgress step={2} />

      <div>
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-text">Who&apos;s in the family?</h1>
        <p className="mt-1.5 text-sm text-text-secondary">Everyone gets a color and their own view.</p>
      </div>

      {members.length === 0 ? (
        <p className="dashed rounded-card px-4 py-6 text-center text-sm text-text-secondary">
          No family members yet. Add one below, or continue and add them later.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-3 rounded-card bg-glass px-4 py-3.5"
            >
              <MemberAvatar displayName={member.display_name} color={member.color} size="sm" ariaHidden />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold text-text">{member.display_name}</span>
                {member.id === viewerMemberId ? <span className="text-xs text-text-tertiary">you</span> : null}
              </div>
              <span className="rounded-pill bg-glass-hover px-3 py-1.5 text-[11px] font-bold text-text">
                {ROLE_LABELS[member.role]}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {/* Accessible name is "Add a family member" (kept verbatim, not the mock's shorter
              "+ Add member") -- every other spec in this suite (family/settings/dashboard/
              claim/switcher/responsive/a11y) drives onboarding through
              `getByRole("button", { name: "Add a family member" })`, and Playwright's default
              name match is substring-based, so keeping that exact phrase inside the visible
              text (rather than replacing it) is what keeps every one of those specs passing
              unmodified. See this task's report for the full list. */}
          <button
            type="button"
            className="dashed flex min-h-[44px] items-center justify-center rounded-card px-4 py-3.5 text-[13px] font-semibold text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            + Add a family member
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a family member</DialogTitle>
            <DialogDescription>They&apos;ll show up in your household right away.</DialogDescription>
          </DialogHeader>

          <form ref={formRef} action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">Name</Label>
              <Input id="displayName" name="displayName" autoComplete="off" required maxLength={40} />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="role">Role</Label>
              <Select name="role" defaultValue="child" required>
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

            <ColorPicker
              idPrefix="onboarding-member"
              name="color"
              defaultValue={nextAvailableMemberColor(usedColors)}
              displayName=""
            />

            <div className="flex flex-col gap-2">
<BirthdayPicker idPrefix="onboarding-birthday" />
            </div>

            <label
              htmlFor="hasLogin"
              className="flex min-h-[44px] items-center gap-3 rounded-[14px] bg-inset px-4 py-3 text-sm text-text"
            >
              <Switch id="hasLogin" name="hasLogin" checked={hasLogin} onCheckedChange={setHasLogin} />
              They&apos;ll have their own login
            </label>
            {hasLogin ? (
              <p className="text-xs text-text-secondary">
                Invites aren&apos;t available yet — for now they&apos;ll be added without a way to sign in
                themselves, and you can invite them once that&apos;s ready.
              </p>
            ) : null}

            {state.error ? (
              <p role="alert" className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger-text">
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

      <Button asChild size="lg" className="mt-auto">
        <Link href="/onboarding?step=location">Continue</Link>
      </Button>
    </main>
  );
}
