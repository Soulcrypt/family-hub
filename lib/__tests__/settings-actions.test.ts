import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthorityRole } from "@/lib/constants/roles";

/**
 * Focused tests of app/(app)/settings/actions.ts's `updateHouseholdAction` and
 * `updateFeaturesAction`, with the database mocked out. Two things matter enough to be worth
 * this rather than relying solely on tests/e2e/settings.spec.ts's happy path:
 *
 *  1. `updateFeaturesAction` MUST force `family: true` and `settings: true` into
 *     `enabled_features` regardless of what was submitted -- they're `locked: true` in
 *     lib/constants/features.ts's FEATURES catalogue, and disabling either would strand the
 *     household with no way back to Family or Settings (nav is derived from this exact
 *     value -- components/shell/nav-items.ts). This is easy to get subtly wrong (e.g. only
 *     defaulting them when ABSENT from the submission, rather than always overriding), and an
 *     E2E test that only ever checks a box would never catch a regression that flips an
 *     ALREADY-checked one off.
 *  2. A crafted key not in FEATURES (`isFeatureKey()`) must never reach the database write --
 *     dropped here, not merely re-filtered on the next read.
 *  3. Both actions reject a non-admin before ever touching the database, matching every other
 *     action in this codebase's authority split (requireAccountMembership() + canEditSettings,
 *     never the attribution cookie).
 *
 * `next/cache` and `@/lib/auth/active-member` are mocked for the same reason
 * lib/__tests__/set-pin-action.test.ts mocks them.
 */
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requireAccountMembershipMock = vi.fn();
vi.mock("@/lib/auth/active-member", () => ({
  requireAccountMembership: requireAccountMembershipMock,
}));

type UpdateResult = { error: { code?: string; message: string } | null };

const updateMock = vi.fn<(payload: Record<string, unknown>) => unknown>();
let updateResult: UpdateResult = { error: null };

function fromMock() {
  return {
    update: (payload: Record<string, unknown>) => {
      updateMock(payload);
      const chain = {
        eq: () => chain,
        then: (resolve: (value: UpdateResult) => void) => resolve(updateResult),
      };
      return chain;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({ from: fromMock })),
}));

const { updateHouseholdAction, updateFeaturesAction } = await import("@/app/(app)/settings/actions");

const HOUSEHOLD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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

function featuresFormData(keys: string[]): FormData {
  const data = new FormData();
  for (const key of keys) data.append("features", key);
  return data;
}

function householdFormData(fields: { name?: string; timezone?: string; weekStart?: string }): FormData {
  const data = new FormData();
  if (fields.name !== undefined) data.set("name", fields.name);
  if (fields.timezone !== undefined) data.set("timezone", fields.timezone);
  if (fields.weekStart !== undefined) data.set("weekStart", fields.weekStart);
  return data;
}

describe("updateFeaturesAction", () => {
  beforeEach(() => {
    updateMock.mockReset();
    updateResult = { error: null };
    requireAccountMembershipMock.mockReset();
  });

  it("forces family and settings to true even when neither is submitted", async () => {
    requireAccountMembershipMock.mockResolvedValue(account("owner"));

    const result = await updateFeaturesAction({ error: null }, featuresFormData(["meals"]));

    expect(result).toEqual({ error: null });
    expect(updateMock).toHaveBeenCalledExactlyOnceWith({
      enabled_features: { family: true, settings: true, meals: true },
    });
  });

  it("drops a submitted key that isn't in the FEATURES catalogue", async () => {
    requireAccountMembershipMock.mockResolvedValue(account("owner"));

    const result = await updateFeaturesAction({ error: null }, featuresFormData(["meals", "not-a-real-feature"]));

    expect(result).toEqual({ error: null });
    const payload = updateMock.mock.calls[0]?.[0];
    expect(payload?.enabled_features).toEqual({ family: true, settings: true, meals: true });
  });

  it("rejects a non-admin before ever touching the database", async () => {
    requireAccountMembershipMock.mockResolvedValue(account("child"));

    const result = await updateFeaturesAction({ error: null }, featuresFormData(["meals"]));

    expect(result.error).toMatch(/permission/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("falls back to a generic message for a database error, never the raw Postgres text", async () => {
    requireAccountMembershipMock.mockResolvedValue(account("owner"));
    updateResult = { error: { code: "22023", message: "column does not exist" } };

    const result = await updateFeaturesAction({ error: null }, featuresFormData([]));

    expect(result.error).not.toMatch(/column/i);
    expect(result.error).toEqual("We couldn't save your features. Please try again.");
  });
});

describe("updateHouseholdAction", () => {
  beforeEach(() => {
    updateMock.mockReset();
    updateResult = { error: null };
    requireAccountMembershipMock.mockReset();
  });

  it("rejects a non-admin before ever touching the database", async () => {
    requireAccountMembershipMock.mockResolvedValue(account("teen"));

    const result = await updateHouseholdAction(
      { error: null },
      householdFormData({ name: "The Ivans", timezone: "UTC", weekStart: "0" }),
    );

    expect(result.error).toMatch(/permission/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid timezone before ever touching the database", async () => {
    requireAccountMembershipMock.mockResolvedValue(account("owner"));

    const result = await updateHouseholdAction(
      { error: null },
      householdFormData({ name: "The Ivans", timezone: "Not/AZone", weekStart: "0" }),
    );

    expect(result.error).not.toBeNull();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("an owner updates the household's name, timezone, and week start together", async () => {
    requireAccountMembershipMock.mockResolvedValue(account("owner"));

    const result = await updateHouseholdAction(
      { error: null },
      householdFormData({ name: "The Ivans", timezone: "America/New_York", weekStart: "1" }),
    );

    expect(result).toEqual({ error: null });
    expect(updateMock).toHaveBeenCalledExactlyOnceWith({
      name: "The Ivans",
      timezone: "America/New_York",
      week_start: 1,
    });
  });
});
