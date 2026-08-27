"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createInviteAction, type InviteState } from "@/app/(app)/settings/invites/actions";
import { reactivateMemberAction, type MemberManagementState } from "@/app/(app)/settings/members/actions";
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
import { ROLES, ROLE_LABELS, type MemberRole } from "@/lib/constants/roles";
import { memberCaption } from "@/lib/family/member-age";

export type RosterMember = {
  id: string;
  display_name: string;
  role: MemberRole;
  color: string;
  avatar_url: string | null;
  user_id: string | null;
  birthday: string | null;
  /** Whether THIS member genuinely has a PIN set — `member_has_pin`, not merely a role that
   * `requiresPin()`. Mirrors app/switch/page.tsx's own `isMemberGated` reasoning (lib/auth/
   * pin-gate.ts): showing a "PIN protected" badge for a role that COULD have a PIN but never
   * had one set would claim protection that doesn't exist. */
  hasPin: boolean;
};

export type RemovedRosterMember = {
  id: string;
  display_name: string;
  role: MemberRole;
  color: string;
  avatar_url: string | null;
};

const ROW_CLASSNAME = "flex min-w-0 items-center gap-3 rounded-tile bg-inset px-4 py-3";

/** The one-time reveal of a freshly created invite link — shared shape with the old per-member
 * dialog (components/settings/member-invite-list.tsx, which this component replaces). */
function InviteLinkReveal({ token, memberName }: { token: string; memberName: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/invite/${token}` : `/invite/${token}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied/unavailable — the link is still selectable text below.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <DialogDescription>
        Send this link to {memberName}. For their security, it will only be shown here once — if you lose it, create
        a new invite.
      </DialogDescription>
      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-link">Invitation link</Label>
        <Input id="invite-link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
      </div>
      <Button type="button" onClick={copyLink}>
        {copied ? "Copied!" : "Copy link"}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Invitation link copied to the clipboard" : ""}
      </span>
      <p className="text-[13px] text-text-secondary">This link expires in 7 days and can only be used once.</p>
    </div>
  );
}

const INVITE_INITIAL: InviteState = { error: null, token: null };

/** Invites an EXISTING login-less member to log in, keeping their points/history — the claim
 * flow this task preserves from components/settings/member-invite-list.tsx. */
function InviteToLoginDialog({ member }: { member: RosterMember }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createInviteAction, INVITE_INITIAL);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="secondary">
          Invite to log in
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="break-words">Invite {member.display_name} to log in</DialogTitle>
          {state.token ? null : (
            <DialogDescription>
              They’ll keep every point and everything else already on their profile — this only gives them
              their own login.
            </DialogDescription>
          )}
        </DialogHeader>

        {state.token ? (
          <InviteLinkReveal token={state.token} memberName={member.display_name} />
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="memberId" value={member.id} />
            <div className="flex flex-col gap-2">
              <Label htmlFor={`invite-role-${member.id}`}>Role once they log in</Label>
              <Select name="role" defaultValue={member.role} required>
                <SelectTrigger id={`invite-role-${member.id}`} className="w-full">
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
            {state.error ? (
              <p role="alert" className="rounded-inset bg-danger/10 px-4 py-3 text-[13px] text-danger-text">
                {state.error}
              </p>
            ) : null}
            <DialogFooter showCloseButton>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating link…" : "Create invite link"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Invites a brand-new person who isn't in the household yet — mock 4h's top-right
 * "+ Invite member". `createInviteAction` already supports this (memberId omitted -> a
 * new-member invite, Task 6/pgTAP-covered); this dialog is just the top-level entry point for
 * it, distinct from `InviteToLoginDialog`'s per-row claim flow for an EXISTING login-less
 * member. */
function AddMemberInviteDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createInviteAction, INVITE_INITIAL);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">+ Invite member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a family member</DialogTitle>
          {state.token ? null : <DialogDescription>Send them a link to join your household.</DialogDescription>}
        </DialogHeader>

        {state.token ? (
          <InviteLinkReveal token={state.token} memberName="them" />
        ) : (
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-invite-role">Role</Label>
              <Select name="role" defaultValue="child" required>
                <SelectTrigger id="new-invite-role" className="w-full">
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
            {state.error ? (
              <p role="alert" className="rounded-inset bg-danger/10 px-4 py-3 text-[13px] text-danger-text">
                {state.error}
              </p>
            ) : null}
            <DialogFooter showCloseButton>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating link…" : "Create invite link"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

const REACTIVATE_INITIAL: MemberManagementState = { error: null };

function RestoreForm({ member }: { member: RemovedRosterMember }) {
  const [state, formAction, pending] = useActionState(reactivateMemberAction, REACTIVATE_INITIAL);
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="memberId" value={member.id} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Restoring…" : "Restore"}
      </Button>
      {state.error ? (
        <p role="alert" className="text-[12px] text-danger-text">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/**
 * The Family section of Settings (mock 4h): every active member as a row (avatar in their
 * member colour, name, a caption, a role pill, a PIN indicator when they genuinely have one
 * set, and an Edit link to their full profile at /family/[memberId] — the detail screen, per
 * this task's brief, owns add/edit/colour/role/birthday/PIN/deactivate). "+ Invite member"
 * (top-right, admin-gated) creates an invite for someone not in the household yet; each
 * login-less existing member additionally gets its own "Invite to log in" affordance, the claim
 * flow this task preserves. Removed members (admin-only) are restorable below, preserving
 * `reactivateMemberAction`.
 *
 * `canManage`/`canInvite` are the real, admin-gated controls (mirroring the household/members
 * pages this replaces); viewing the roster itself is never gated — every household member can
 * see who else is in it, matching every other roster in this app.
 */
export function FamilyRoster({
  householdName,
  members,
  removedMembers,
  canInvite,
  canManage,
  viewingAsAdmin,
}: {
  householdName: string;
  members: RosterMember[];
  removedMembers: RemovedRosterMember[];
  canInvite: boolean;
  canManage: boolean;
  viewingAsAdmin: boolean;
}) {
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-[26px] font-bold tracking-[-0.02em] text-text">{householdName}</h2>
          {canManage ? (
            <Link
              href="/settings/household"
              className="text-[13px] font-medium text-accent-text transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Manage household name &amp; features
            </Link>
          ) : null}
        </div>
        {canInvite ? <AddMemberInviteDialog /> : null}
      </div>

      {viewingAsAdmin ? null : (
        <p className="rounded-inset bg-inset px-4 py-3 text-[13px] text-text-secondary">
          You’re viewing as a non-admin profile. Switch to an adult’s profile to invite or restore members.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {members.map((member) => (
          <li key={member.id} className={ROW_CLASSNAME}>
            <MemberAvatar
              displayName={member.display_name}
              color={member.color}
              avatarUrl={member.avatar_url}
              ariaHidden
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[15px] font-semibold text-text">{member.display_name}</span>
              <span className="text-[13px] text-text-secondary">
                {memberCaption({ birthday: member.birthday, hasLogin: member.user_id !== null }, now)}
              </span>
            </div>
            <span className="hidden shrink-0 rounded-pill bg-glass-hover px-3 py-1 text-[12px] font-semibold text-text sm:inline-block">
              {ROLE_LABELS[member.role]}
            </span>
            {member.hasPin ? (
              // `text-secondary`, not `text-tertiary`: this states whether a profile is
              // PIN-protected, which is real information, and tertiary measures 3.02:1. It
              // escaped the axe sweep only because a freshly-onboarded household has no PINs
              // set, so this element never rendered while the scan ran.
              <span className="hidden shrink-0 text-[13px] tracking-[0.08em] text-text-secondary sm:inline">
                PIN &bull;&bull;&bull;&bull;
              </span>
            ) : null}
            {canInvite && !member.user_id ? <InviteToLoginDialog member={member} /> : null}
            <Link
              href={`/family/${member.id}`}
              className="shrink-0 rounded-inset px-2 py-1 text-[13px] font-semibold text-accent-text transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Edit
            </Link>
          </li>
        ))}
      </ul>

      {canManage && removedMembers.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold text-text">Removed members</h2>
          <p className="text-[13px] text-text-secondary">
            Restoring a member gives them back their place in the household, with their points and history intact.
          </p>
          <ul className="flex flex-col gap-3">
            {removedMembers.map((member) => (
              <li key={member.id} className={ROW_CLASSNAME}>
                <MemberAvatar
                  displayName={member.display_name}
                  color={member.color}
                  avatarUrl={member.avatar_url}
                  ariaHidden
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold text-text">{member.display_name}</span>
                  <span className="text-[13px] text-text-secondary">{ROLE_LABELS[member.role]} · Removed</span>
                </div>
                <RestoreForm member={member} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
