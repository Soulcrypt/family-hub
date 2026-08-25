import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthorityRole } from "@/lib/constants/roles";

/**
 * Focused test of `createInviteAction` itself (app/(app)/settings/invites/actions.ts) -- not
 * `accept_invite`, which is already covered end-to-end by pgTAP (supabase/tests/020_bootstrap.sql,
 * supabase/tests/040_claim.sql). Two things matter enough here to be worth a unit test with the
 * RPC layer mocked out entirely:
 *
 *  1. The token hash this action computes in Node MUST be byte-identical to what
 *     `accept_invite` recomputes in Postgres (`encode(digest(p_token, 'sha256'), 'hex')`) --
 *     a silent mismatch here would mean no invite ever redeems, with no error anywhere to
 *     point at. This test recomputes the same digest independently and compares it to what
 *     the action actually inserted, rather than trusting the action's own internal call to
 *     produce the "right" value.
 *  2. The defensive pre-check (an admin can only mint a claim invite for a memberId that is
 *     genuinely a login-less, active member of THEIR OWN household) must reject before ever
 *     reaching the insert -- accept_invite is still the real security boundary (see its own
 *     pgTAP coverage), but this action should not hand out a token for a link that could never
 *     possibly succeed.
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

type MaybeSingleResult = { data: { id: string } | null; error: null };
type InsertResult = { error: { message: string } | null };

const insertMock = vi.fn<(payload: Record<string, unknown>) => Promise<InsertResult>>();
const maybeSingleMock = vi.fn<() => Promise<MaybeSingleResult>>();

/**
 * A minimal stand-in for the two query shapes createInviteAction issues:
 *   supabase.from("household_members").select("id").eq(...).eq(...).eq(...).is(...).maybeSingle()
 *   supabase.from("household_invites").insert({...})
 * Chained `.eq`/`.is` calls just return the same chain object -- only the terminal call
 * (`.maybeSingle()`/`.insert()`) is a mock whose behavior each test configures.
 */
function fromMock(table: string) {
  if (table === "household_invites") {
    return { insert: insertMock };
  }
  const chain = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    maybeSingle: maybeSingleMock,
  };
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({ from: fromMock })),
}));

const { createInviteAction } = await import("@/app/(app)/settings/invites/actions");

const HOUSEHOLD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACCOUNT_USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MEMBER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function ownerAccount() {
  return {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    user_id: ACCOUNT_USER_ID,
    display_name: "Owner",
    role: "owner" as unknown as AuthorityRole,
    color: "#000000",
    avatar_url: null,
    household_id: HOUSEHOLD_ID,
  };
}

function childAccount() {
  return { ...ownerAccount(), role: "child" as unknown as AuthorityRole };
}

function inviteFormData(fields: { role?: string; memberId?: string; email?: string }): FormData {
  const data = new FormData();
  if (fields.role !== undefined) data.set("role", fields.role);
  if (fields.memberId !== undefined) data.set("memberId", fields.memberId);
  if (fields.email !== undefined) data.set("email", fields.email);
  return data;
}

describe("createInviteAction", () => {
  beforeEach(() => {
    insertMock.mockReset();
    maybeSingleMock.mockReset();
    requireAccountMembershipMock.mockReset();
  });

  it("mints a token whose stored hash matches Node's sha256 hex digest of the raw token", async () => {
    requireAccountMembershipMock.mockResolvedValue(ownerAccount());
    maybeSingleMock.mockResolvedValue({ data: { id: MEMBER_ID }, error: null });
    insertMock.mockResolvedValue({ error: null });

    const result = await createInviteAction(
      { error: null, token: null },
      inviteFormData({ role: "teen", memberId: MEMBER_ID }),
    );

    expect(result.error).toBeNull();
    expect(result.token).toEqual(expect.any(String));
    const token = result.token as string;

    expect(insertMock).toHaveBeenCalledTimes(1);
    const payload = insertMock.mock.calls[0]?.[0];
    // The exact cross-language contract this task depends on: Postgres's
    // encode(digest(p_token, 'sha256'), 'hex') must equal this.
    expect(payload?.token_hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(payload?.household_id).toBe(HOUSEHOLD_ID);
    expect(payload?.role).toBe("teen");
    expect(payload?.member_id).toBe(MEMBER_ID);
    expect(payload?.created_by).toBe(ACCOUNT_USER_ID);
  });

  it("rejects a non-admin before ever querying the database", async () => {
    requireAccountMembershipMock.mockResolvedValue(childAccount());

    const result = await createInviteAction(
      { error: null, token: null },
      inviteFormData({ role: "teen", memberId: MEMBER_ID }),
    );

    expect(result.token).toBeNull();
    expect(result.error).toMatch(/permission/i);
    expect(maybeSingleMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid role before ever querying the database", async () => {
    requireAccountMembershipMock.mockResolvedValue(ownerAccount());

    const result = await createInviteAction({ error: null, token: null }, inviteFormData({ role: "grandparent" }));

    expect(result.token).toBeNull();
    expect(result.error).not.toBeNull();
    expect(maybeSingleMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("rejects a memberId that is not a login-less, active member of the caller's own household, without inserting anything", async () => {
    requireAccountMembershipMock.mockResolvedValue(ownerAccount());
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    const result = await createInviteAction(
      { error: null, token: null },
      inviteFormData({ role: "teen", memberId: MEMBER_ID }),
    );

    expect(result.token).toBeNull();
    expect(result.error).not.toBeNull();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("creates a new-member invite (no memberId) without ever checking household_members", async () => {
    requireAccountMembershipMock.mockResolvedValue(ownerAccount());
    insertMock.mockResolvedValue({ error: null });

    const result = await createInviteAction({ error: null, token: null }, inviteFormData({ role: "parent" }));

    expect(result.error).toBeNull();
    expect(maybeSingleMock).not.toHaveBeenCalled();
    const payload = insertMock.mock.calls[0]?.[0];
    expect(payload?.member_id).toBeNull();
  });

  it("falls back to a generic message if the insert fails, never the raw Postgres error", async () => {
    requireAccountMembershipMock.mockResolvedValue(ownerAccount());
    insertMock.mockResolvedValue({ error: { message: 'duplicate key value violates unique constraint "x"' } });

    const result = await createInviteAction({ error: null, token: null }, inviteFormData({ role: "parent" }));

    expect(result.token).toBeNull();
    expect(result.error).not.toMatch(/constraint/i);
  });
});
