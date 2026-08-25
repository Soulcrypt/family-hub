"use client";

import { useActionState } from "react";
import { reactivateMemberAction, type MemberManagementState } from "@/app/(app)/settings/members/actions";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/family/member-avatar";
import { ROLE_LABELS, type MemberRole } from "@/lib/constants/roles";

export type RemovedMember = {
  id: string;
  display_name: string;
  role: MemberRole;
  color: string;
  avatar_url: string | null;
};

const INITIAL: MemberManagementState = { error: null };

function RestoreForm({ member }: { member: RemovedMember }) {
  const [state, formAction, pending] = useActionState(reactivateMemberAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="memberId" value={member.id} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Restoring…" : "Restore"}
      </Button>
      {state.error ? (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

/**
 * Removed members are invisible everywhere else on purpose (the ordinary family roster and
 * the profile switcher both filter `is_active = true`) -- this is the ONLY place they
 * reappear, and only for whoever this page's caller has already confirmed can manage members
 * (app/(app)/settings/members/page.tsx gates the query itself, not just this component's
 * rendering, since `household_members`' own SELECT policy does not filter by admin status).
 */
export function RemovedMemberList({ members }: { members: RemovedMember[] }) {
  if (members.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-medium text-ink">Removed members</h2>
      <p className="text-sm text-muted-foreground">
        Restoring a member gives them back their place in the household, with their points and history intact.
      </p>
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
              <span className="text-sm text-muted-foreground">{ROLE_LABELS[member.role]} · Removed</span>
            </div>
            <RestoreForm member={member} />
          </li>
        ))}
      </ul>
    </div>
  );
}
