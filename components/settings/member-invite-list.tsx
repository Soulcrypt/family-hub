"use client";

import { useActionState, useState } from "react";
import { createInviteAction, type InviteState } from "@/app/(app)/settings/invites/actions";
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

export type InviteListMember = {
  id: string;
  display_name: string;
  role: MemberRole;
  color: string;
  avatar_url: string | null;
  user_id: string | null;
};

const INITIAL: InviteState = { error: null, token: null };

/**
 * The one-time reveal of a freshly created claim invite's link. Its OWN dialog body (rather
 * than reusing the role-picker form's) so the dialog can never flash back to the form after a
 * successful create -- `state.token` only ever grows a value once per mount of this component,
 * and this component only mounts once the token exists.
 */
function InviteLinkReveal({ token, memberName }: { token: string; memberName: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/invite/${token}` : `/invite/${token}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied or unavailable (permissions, insecure context, some
      // automated browsers) -- the link is still shown as selectable text below, so this is a
      // silent no-op rather than a broken flow.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <DialogDescription>
        Send this link to {memberName}. For their security, it will only be shown here once -- if you lose it,
        create a new invite.
      </DialogDescription>
      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-link">Invitation link</Label>
        <Input
          id="invite-link"
          readOnly
          value={link}
          onFocus={(event) => event.currentTarget.select()}
        />
      </div>
      <Button type="button" onClick={copyLink}>
        {copied ? "Copied!" : "Copy link"}
      </Button>
      <p className="text-sm text-muted-foreground">This link expires in 7 days and can only be used once.</p>
    </div>
  );
}

function InviteDialog({ member }: { member: InviteListMember }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createInviteAction, INITIAL);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Invite them to log in
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="break-words">Invite {member.display_name} to log in</DialogTitle>
          {state.token ? null : (
            <DialogDescription>
              They’ll keep every point and everything else already on their profile — this only gives them their
              own login.
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
              <select
                id={`invite-role-${member.id}`}
                name="role"
                defaultValue={member.role}
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

            {state.error ? (
              <p role="alert" className="rounded-[12px] bg-destructive-bg px-4 py-3 text-sm text-destructive">
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

/**
 * The members list this task's claim flow actually needs -- every active member of the
 * household, with an "Invite them to log in" affordance on each LOGIN-LESS one for an admin.
 * Viewing the list itself is not privileged (matches app/(app)/family/page.tsx's own roster);
 * only the invite affordance is gated on `canInvite`.
 */
export function MemberInviteList({
  members,
  canInvite,
}: {
  members: InviteListMember[];
  canInvite: boolean;
}) {
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[18px] border border-dashed border-border px-6 py-16 text-center">
        <h2 className="text-xl">No one here yet.</h2>
        <p className="text-muted-foreground">Add family members from the Family page first.</p>
      </div>
    );
  }

  const loginLessCount = members.filter((member) => !member.user_id).length;

  return (
    <div className="flex flex-col gap-6">
      {canInvite && loginLessCount === 0 ? (
        <p className="rounded-[12px] bg-sunken px-4 py-3 text-sm text-muted-foreground">
          Everyone in your household already has their own login.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex min-w-0 items-center gap-3 rounded-[18px] bg-surface px-4 py-3 shadow-elevation ring-1 ring-[color:var(--color-muted)]"
          >
            <MemberAvatar
              displayName={member.display_name}
              color={member.color}
              avatarUrl={member.avatar_url}
              ariaHidden
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate break-words text-base font-medium text-ink">{member.display_name}</span>
              <span className="text-sm text-muted-foreground">
                {ROLE_LABELS[member.role]}
                {member.user_id ? " · Has their own login" : " · No login yet"}
              </span>
            </div>
            {canInvite && !member.user_id ? <InviteDialog member={member} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
