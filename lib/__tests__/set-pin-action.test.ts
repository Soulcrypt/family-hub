import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Focused test of `setPinAction` itself (app/(app)/family/actions.ts) -- not the
 * `set_member_pin` RPC, which is already covered by pgTAP (supabase/tests/030_member_pin.sql).
 * Nothing else in this repo exercises this action's success path or its 42501 rejection, and
 * both matter more than usual here: a wrong PIN implementation fails SILENTLY (a bcryptjs hash
 * would save without error and then simply never verify -- see this task's report), and a
 * renamed RPC parameter or a changed error code would break just as quietly. This test would
 * catch either: it asserts the exact RPC call shape and the exact error-code branch, with the
 * RPC itself mocked so no database is needed.
 *
 * `next/cache` and `@/lib/auth/active-member` are mocked because they depend on a live Next.js
 * request context (`revalidatePath`, `cookies()`) that doesn't exist under plain Vitest --
 * `setPinAction` never uses `requireAccountMembership()`'s return value for any decision (see
 * its doc comment: authority is derived entirely inside `set_member_pin` from `auth.uid()`), so
 * mocking it to resolve to nothing loses no coverage.
 */
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/active-member", () => ({ requireAccountMembership: vi.fn().mockResolvedValue(undefined) }));

type RpcError = { code: string; message: string } | null;
type RpcResult = { data: unknown; error: RpcError };

const rpcMock = vi.fn<(fn: string, args: Record<string, unknown>) => Promise<RpcResult>>();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

const { setPinAction } = await import("@/app/(app)/family/actions");

const MEMBER_ID = "11111111-1111-4111-8111-111111111111";

function pinFormData(memberId: string, pin: string): FormData {
  const data = new FormData();
  data.set("memberId", memberId);
  data.set("pin", pin);
  return data;
}

describe("setPinAction", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("calls set_member_pin with the exact parameter names the migration defines, and succeeds", async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });

    const result = await setPinAction({ error: null }, pinFormData(MEMBER_ID, "1234"));

    // supabase/migrations/0011_member_pin_verification.sql: set_member_pin(p_member_id uuid, p_pin text).
    // A rename of either parameter here would silently break every PIN write; this call
    // assertion is what catches that, not the pgTAP suite (which only tests the RPC in
    // isolation, not this action's call site).
    expect(rpcMock).toHaveBeenCalledExactlyOnceWith("set_member_pin", { p_member_id: MEMBER_ID, p_pin: "1234" });
    expect(result).toEqual({ error: null });
  });

  it("surfaces the RPC's 42501 rejection as a specific, clean form error", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "42501", message: "not permitted to set this pin" } });

    const result = await setPinAction({ error: null }, pinFormData(MEMBER_ID, "1234"));

    expect(result).toEqual({ error: "You do not have permission to set this pin" });
  });

  it("falls back to a generic message for any other RPC error, never the raw Postgres text", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "22023", message: "member not found" } });

    const result = await setPinAction({ error: null }, pinFormData(MEMBER_ID, "1234"));

    expect(result).toEqual({ error: "We couldn't save this pin. Please try again." });
  });

  it("rejects a malformed pin before ever calling the RPC", async () => {
    const result = await setPinAction({ error: null }, pinFormData(MEMBER_ID, "12"));

    expect(rpcMock).not.toHaveBeenCalled();
    expect(result.error).not.toBeNull();
  });
});
