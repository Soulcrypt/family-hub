import { describe, expect, it, vi } from "vitest";
import { isMemberGated } from "@/lib/auth/pin-gate";

/**
 * `isMemberGated` (lib/auth/pin-gate.ts) is an extraction of logic that used to live only in
 * app/switch/page.tsx -- these tests pin its behavior so both app/switch/page.tsx and
 * app/(app)/dashboard/page.tsx (SP1 Foundation's "one tap switches" dashboard) can rely on it
 * agreeing with itself. Mirrors lib/__tests__/switch-to-member-action.test.ts's minimal
 * `.rpc()`-only Supabase stand-in -- this function only ever calls `supabase.rpc(...)`.
 */
function fakeSupabase(rpcResult: { data: unknown; error: unknown }) {
  return { rpc: vi.fn(async () => rpcResult) } as unknown as Parameters<typeof isMemberGated>[0];
}

const CALLER_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MEMBER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

describe("isMemberGated", () => {
  it("is never gated for the caller's own row, regardless of role", async () => {
    const supabase = fakeSupabase({ data: true, error: null });
    const gated = await isMemberGated(
      supabase,
      { id: MEMBER_ID, role: "owner", user_id: CALLER_USER_ID },
      CALLER_USER_ID,
    );
    expect(gated).toBe(false);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("is never gated for a role that doesn't require a PIN at all", async () => {
    const supabase = fakeSupabase({ data: true, error: null });
    const gated = await isMemberGated(
      supabase,
      { id: MEMBER_ID, role: "teen", user_id: OTHER_USER_ID },
      CALLER_USER_ID,
    );
    expect(gated).toBe(false);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("is not gated for an admin role that has never had a PIN set (member_has_pin returns false)", async () => {
    const supabase = fakeSupabase({ data: false, error: null });
    const gated = await isMemberGated(
      supabase,
      { id: MEMBER_ID, role: "parent", user_id: OTHER_USER_ID },
      CALLER_USER_ID,
    );
    expect(gated).toBe(false);
    expect(supabase.rpc).toHaveBeenCalledWith("member_has_pin", { p_member_id: MEMBER_ID });
  });

  it("is gated for another admin's row that genuinely has a PIN set", async () => {
    const supabase = fakeSupabase({ data: true, error: null });
    const gated = await isMemberGated(
      supabase,
      { id: MEMBER_ID, role: "owner", user_id: OTHER_USER_ID },
      CALLER_USER_ID,
    );
    expect(gated).toBe(true);
  });
});
