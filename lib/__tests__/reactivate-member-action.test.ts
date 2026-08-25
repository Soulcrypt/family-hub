import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthorityRole } from "@/lib/constants/roles";

/**
 * Focused test of `reactivateMemberAction` (app/(app)/settings/members/actions.ts) -- the
 * counterpart to Task 13's `deactivateMemberAction` that didn't exist until this task (see
 * this task's report). What matters enough here to unit-test with the database mocked out:
 *
 *  1. A non-admin must be rejected BEFORE any database call -- matching
 *     `deactivateMemberAction`'s own gate exactly (`requireAccountMembership()` +
 *     `canManageMembers`, never the `fh_active_member` attribution cookie).
 *  2. An admin's update is scoped by BOTH `id` and `household_id`, and sets exactly
 *     `is_active: true` -- a call missing the household scope would let an admin reactivate a
 *     member outside their own household if RLS ever regressed.
 *  3. The household_members BEFORE UPDATE trigger's 42501 rejection (supabase/migrations/
 *     0004/0005 -- a backstop behind the check above) is mapped to a clean form error, never
 *     the raw Postgres message.
 *
 * `next/cache` and `@/lib/auth/active-member` are mocked for the same reason
 * lib/__tests__/set-pin-action.test.ts mocks them: both depend on a live Next.js request
 * context that doesn't exist under plain Vitest.
 */
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireAccountMembershipMock = vi.fn();
vi.mock("@/lib/auth/active-member", () => ({
  requireAccountMembership: requireAccountMembershipMock,
}));

type UpdateResult = { error: { code?: string; message: string } | null };

const updateMock = vi.fn<(payload: Record<string, unknown>) => unknown>();
const eqCalls: Array<[string, unknown]> = [];
let updateResult: UpdateResult = { error: null };

/**
 * A minimal stand-in for the one query shape reactivateMemberAction issues:
 *   supabase.from("household_members").update({...}).eq("id", ...).eq("household_id", ...)
 * `.eq()` records its arguments (so the test can assert BOTH scoping columns were used) and
 * returns a thenable so `await` on the chain resolves to `updateResult`.
 */
function fromMock() {
  return {
    update: (payload: Record<string, unknown>) => {
      updateMock(payload);
      const chain = {
        eq: (column: string, value: unknown) => {
          eqCalls.push([column, value]);
          return chain;
        },
        then: (resolve: (value: UpdateResult) => void) => resolve(updateResult),
      };
      return chain;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({ from: fromMock })),
}));

const { reactivateMemberAction } = await import("@/app/(app)/settings/members/actions");

const HOUSEHOLD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MEMBER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function account(role: string) {
  return {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    display_name: "Owner",
    role: role as unknown as AuthorityRole,
    color: "#000000",
    avatar_url: null,
    household_id: HOUSEHOLD_ID,
  };
}

function reactivateFormData(memberId: string): FormData {
  const data = new FormData();
  data.set("memberId", memberId);
  return data;
}

describe("reactivateMemberAction", () => {
  beforeEach(() => {
    updateMock.mockReset();
    eqCalls.length = 0;
    updateResult = { error: null };
    requireAccountMembershipMock.mockReset();
  });

  it("rejects a non-admin before ever touching the database", async () => {
    requireAccountMembershipMock.mockResolvedValue(account("teen"));

    const result = await reactivateMemberAction({ error: null }, reactivateFormData(MEMBER_ID));

    expect(result.error).toMatch(/permission/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("an owner reactivates a member, scoped by both id and household_id, setting only is_active", async () => {
    requireAccountMembershipMock.mockResolvedValue(account("owner"));

    const result = await reactivateMemberAction({ error: null }, reactivateFormData(MEMBER_ID));

    expect(result).toEqual({ error: null });
    expect(updateMock).toHaveBeenCalledExactlyOnceWith({ is_active: true });
    expect(eqCalls).toContainEqual(["id", MEMBER_ID]);
    expect(eqCalls).toContainEqual(["household_id", HOUSEHOLD_ID]);
  });

  it("a parent may also reactivate a member", async () => {
    requireAccountMembershipMock.mockResolvedValue(account("parent"));

    const result = await reactivateMemberAction({ error: null }, reactivateFormData(MEMBER_ID));

    expect(result).toEqual({ error: null });
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the trigger's 42501 rejection as a specific, clean form error", async () => {
    requireAccountMembershipMock.mockResolvedValue(account("owner"));
    updateResult = { error: { code: "42501", message: "only an owner or parent may change ... is_active ..." } };

    const result = await reactivateMemberAction({ error: null }, reactivateFormData(MEMBER_ID));

    expect(result).toEqual({ error: "You do not have permission to restore this member" });
  });

  it("falls back to a generic message for any other database error, never the raw Postgres text", async () => {
    requireAccountMembershipMock.mockResolvedValue(account("owner"));
    updateResult = { error: { code: "22023", message: "member not found" } };

    const result = await reactivateMemberAction({ error: null }, reactivateFormData(MEMBER_ID));

    expect(result.error).not.toMatch(/not found/i);
    expect(result.error).toEqual("We couldn't restore this member. Please try again.");
  });
});
