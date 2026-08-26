import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthorityRole } from "@/lib/constants/roles";

/**
 * Focused test of `switchToMemberAction` (app/switch/actions.ts) -- specifically the fix for
 * the P0 dead end the SP1 Foundation design review found: `requiresPin()` is true for every
 * `owner`/`parent` role, but onboarding never sets a PIN for anyone, so a parent like Elizabeth
 * Garthwaite in the seed (no PIN ever set) was permanently unreachable -- the action demanded a
 * PIN that does not exist and rejected every guess as "Incorrect PIN".
 *
 * The fix: the action now calls `member_has_pin` (SECURITY DEFINER,
 * supabase/migrations/0019_member_pin_status_rpc.sql) to learn whether the TARGET profile
 * actually has a PIN set, and only demands/verifies one when it does. This is the "keep the
 * server honest" half of the fix -- the switcher UI (app/switch/page.tsx) independently mirrors
 * this so it never even shows a dialog for a PIN-less profile, but this test proves the SERVER
 * enforces it regardless of what the client submits (or omits).
 *
 * The database is fully mocked -- `next/navigation`'s `redirect` (which throws in real Next.js;
 * here it's mocked to throw a distinguishable sentinel so a test can assert it fired without a
 * live request context), `requireAccountMembership`/`setActiveMember` (depend on `cookies()`,
 * same reasoning as lib/__tests__/set-pin-action.test.ts), and `createServerClient` (returns a
 * minimal `.from()`/`.rpc()` stand-in for the one query + two possible RPC calls this action
 * issues).
 */
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const requireAccountMembershipMock = vi.fn();
const setActiveMemberMock = vi.fn();
vi.mock("@/lib/auth/active-member", () => ({
  requireAccountMembership: requireAccountMembershipMock,
  setActiveMember: setActiveMemberMock,
}));

type TargetRow = { id: string; role: string; household_id: string; user_id: string | null } | null;
type RpcError = { code: string; message: string } | null;

let targetRow: TargetRow = null;
const rpcMock = vi.fn<(fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError }>>();
const eqCalls: Array<[string, unknown]> = [];

function fromMock() {
  return {
    select: () => {
      const chain = {
        eq: (column: string, value: unknown) => {
          eqCalls.push([column, value]);
          return chain;
        },
        maybeSingle: async () => ({ data: targetRow, error: null }),
      };
      return chain;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({ from: fromMock, rpc: rpcMock })),
}));

const { switchToMemberAction } = await import("@/app/switch/actions");

const HOUSEHOLD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CALLER_USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER_USER_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const TARGET_MEMBER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function account() {
  return {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    user_id: CALLER_USER_ID,
    display_name: "Owner",
    role: "owner" as unknown as AuthorityRole,
    color: "#000000",
    avatar_url: null,
    household_id: HOUSEHOLD_ID,
  };
}

function switchFormData(memberId: string, pin?: string): FormData {
  const data = new FormData();
  data.set("memberId", memberId);
  if (pin !== undefined) data.set("pin", pin);
  return data;
}

/** member_has_pin/verify_member_pin call matchers, so assertions read as plain booleans. */
function calledMemberHasPin(): boolean {
  return rpcMock.mock.calls.some(([fn]) => fn === "member_has_pin");
}
function calledVerifyMemberPin(): boolean {
  return rpcMock.mock.calls.some(([fn]) => fn === "verify_member_pin");
}

describe("switchToMemberAction", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    eqCalls.length = 0;
    requireAccountMembershipMock.mockReset();
    requireAccountMembershipMock.mockResolvedValue(account());
    setActiveMemberMock.mockReset();
    targetRow = null;
  });

  it("switches straight through to the caller's OWN row, never checking member_has_pin", async () => {
    targetRow = { id: TARGET_MEMBER_ID, role: "owner", household_id: HOUSEHOLD_ID, user_id: CALLER_USER_ID };

    await expect(switchToMemberAction({ error: null }, switchFormData(TARGET_MEMBER_ID))).rejects.toThrow(
      "REDIRECT:/dashboard",
    );

    expect(calledMemberHasPin()).toBe(false);
    expect(calledVerifyMemberPin()).toBe(false);
    expect(setActiveMemberMock).toHaveBeenCalledExactlyOnceWith(TARGET_MEMBER_ID);
  });

  it("switches straight through to a non-child role with no PIN set, after checking member_has_pin", async () => {
    targetRow = { id: TARGET_MEMBER_ID, role: "parent", household_id: HOUSEHOLD_ID, user_id: null };
    rpcMock.mockResolvedValue({ data: false, error: null });

    await expect(switchToMemberAction({ error: null }, switchFormData(TARGET_MEMBER_ID))).rejects.toThrow(
      "REDIRECT:/dashboard",
    );

    expect(rpcMock).toHaveBeenCalledWith("member_has_pin", { p_member_id: TARGET_MEMBER_ID });
    expect(calledVerifyMemberPin()).toBe(false);
    expect(setActiveMemberMock).toHaveBeenCalledExactlyOnceWith(TARGET_MEMBER_ID);
  });

  it("requires a PIN when member_has_pin is true and none was submitted", async () => {
    targetRow = { id: TARGET_MEMBER_ID, role: "parent", household_id: HOUSEHOLD_ID, user_id: OTHER_USER_ID };
    rpcMock.mockResolvedValue({ data: true, error: null });

    const result = await switchToMemberAction({ error: null }, switchFormData(TARGET_MEMBER_ID));

    expect(result.error).toBe("Enter this profile’s PIN to continue.");
    expect(calledVerifyMemberPin()).toBe(false);
    expect(setActiveMemberMock).not.toHaveBeenCalled();
  });

  it("rejects a wrong PIN when a PIN is genuinely set", async () => {
    targetRow = { id: TARGET_MEMBER_ID, role: "parent", household_id: HOUSEHOLD_ID, user_id: OTHER_USER_ID };
    rpcMock.mockImplementation(async (fn) => {
      if (fn === "member_has_pin") return { data: true, error: null };
      if (fn === "verify_member_pin") return { data: false, error: null };
      throw new Error(`unexpected rpc: ${fn}`);
    });

    const result = await switchToMemberAction({ error: null }, switchFormData(TARGET_MEMBER_ID, "0000"));

    expect(result.error).toBe("Incorrect PIN — try again.");
    expect(setActiveMemberMock).not.toHaveBeenCalled();
  });

  it("accepts the correct PIN when a PIN is genuinely set", async () => {
    targetRow = { id: TARGET_MEMBER_ID, role: "parent", household_id: HOUSEHOLD_ID, user_id: OTHER_USER_ID };
    rpcMock.mockImplementation(async (fn) => {
      if (fn === "member_has_pin") return { data: true, error: null };
      if (fn === "verify_member_pin") return { data: true, error: null };
      throw new Error(`unexpected rpc: ${fn}`);
    });

    await expect(
      switchToMemberAction({ error: null }, switchFormData(TARGET_MEMBER_ID, "1234")),
    ).rejects.toThrow("REDIRECT:/dashboard");

    expect(rpcMock).toHaveBeenCalledWith("verify_member_pin", { p_member_id: TARGET_MEMBER_ID, p_pin: "1234" });
    expect(setActiveMemberMock).toHaveBeenCalledExactlyOnceWith(TARGET_MEMBER_ID);
  });

  it("never checks member_has_pin for a role that doesn't require a pin at all", async () => {
    targetRow = { id: TARGET_MEMBER_ID, role: "teen", household_id: HOUSEHOLD_ID, user_id: OTHER_USER_ID };

    await expect(switchToMemberAction({ error: null }, switchFormData(TARGET_MEMBER_ID))).rejects.toThrow(
      "REDIRECT:/dashboard",
    );

    expect(rpcMock).not.toHaveBeenCalled();
    expect(setActiveMemberMock).toHaveBeenCalledExactlyOnceWith(TARGET_MEMBER_ID);
  });
});
