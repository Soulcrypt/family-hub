import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { hashPin } from "@/lib/auth/pin";
import type { Database } from "@/lib/supabase/types";

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

const OWNER_PIN = "4821";

/**
 * A service-role client, used ONLY to seed a PIN hash directly on the freshly-created owner's
 * `household_members` row -- Task 13's `setPinAction` (a member setting their OWN pin) does
 * not exist yet, so this test can't set one through the app. This bypasses RLS entirely,
 * exactly the way the pgTAP suites (supabase/tests/*.sql) seed fixtures directly rather than
 * going through the application -- the point here is to test the switcher's PIN GATE, not the
 * (not-yet-built) PIN-setting flow.
 */
function serviceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to run this test");
  }
  return createClient<Database>(url, key);
}

/**
 * Reads the plaintext member id out of the `fh_active_member` cookie. Only the HMAC
 * signature after the last "." is protected -- the id itself is plaintext by design (see
 * lib/auth/active-member.ts's `signMemberId`) -- so this is a legitimate way for a test to
 * observe which member is currently attributed, without needing a rendered dashboard (which
 * doesn't exist until Task 16; see the note on the redirect assertions below).
 */
async function activeMemberId(page: import("@playwright/test").Page): Promise<string | null> {
  const cookie = (await page.context().cookies()).find((c) => c.name === "fh_active_member");
  if (!cookie) return null;
  const dot = cookie.value.lastIndexOf(".");
  return dot > 0 ? cookie.value.slice(0, dot) : null;
}

test("switching profiles changes attribution, gated by PIN for admin profiles", async ({ page }) => {
  const householdName = unique("The Switchers");
  const ownerName = "Dana Owner";
  const childName = "Ivy";

  // --- Onboard an owner with one PIN-less child member. ---
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(ownerName);
  await page.getByLabel("Email").fill(`${unique("owner")}@test.local`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: /welcome to family hub/i })).toBeVisible();
  await page.getByRole("button", { name: "Get started" }).click();

  await page.getByLabel("Household name").fill(householdName);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=members/);

  await page.getByRole("button", { name: "Add a family member" }).click();
  await page.getByLabel("Name").fill(childName);
  await page.getByLabel("Role").selectOption("child");
  await page.getByRole("button", { name: "Add member" }).click();
  await expect(page.getByText(childName)).toBeVisible();

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=features/);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=ready/);
  await page.getByRole("button", { name: /go to my dashboard/i }).click();
  // /dashboard doesn't exist until Task 16 and 404s today -- same reasoning as
  // tests/e2e/onboarding.spec.ts. Only the URL is asserted, never dashboard content.
  await expect(page).toHaveURL(/\/dashboard/);

  // --- Seed the owner's PIN directly (bypassing RLS), and capture both member ids. ---
  const admin = serviceRoleClient();
  const { data: household } = await admin.from("households").select("id").eq("name", householdName).single();
  if (!household) throw new Error("household fixture was not created");

  const { data: members } = await admin
    .from("household_members")
    .select("id, display_name, role")
    .eq("household_id", household.id);
  const ownerRow = members?.find((m) => m.role === "owner");
  const childRow = members?.find((m) => m.role === "child");
  if (!ownerRow || !childRow) throw new Error("expected an owner and a child member fixture");

  const { error: seedError } = await admin
    .from("household_members")
    .update({ pin_hash: await hashPin(OWNER_PIN) })
    .eq("id", ownerRow.id);
  if (seedError) throw seedError;

  // --- Both members appear on the switcher. ---
  await page.goto("/switch");
  await expect(page.getByRole("heading", { name: /who's this/i })).toBeVisible();
  await expect(page.getByText(ownerName, { exact: true })).toBeVisible();
  await expect(page.getByText(childName, { exact: true })).toBeVisible();

  // --- The child's tile (no PIN required) switches attribution immediately. ---
  await page.getByRole("button", { name: childName }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect.poll(() => activeMemberId(page)).toBe(childRow.id);

  // --- The owner's tile (PIN required) opens a dialog instead of switching directly. ---
  await page.goto("/switch");
  await page.getByRole("button", { name: ownerName }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("PIN")).toBeVisible();

  // --- A wrong PIN shows an error and does not switch (attribution stays the child's). ---
  await page.getByLabel("PIN").fill("0000");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Incorrect PIN" })).toBeVisible();
  await expect(page).toHaveURL(/\/switch/);
  expect(await activeMemberId(page)).toBe(childRow.id);

  // --- The correct PIN switches attribution to the owner. ---
  await page.getByLabel("PIN").fill(OWNER_PIN);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect.poll(() => activeMemberId(page)).toBe(ownerRow.id);
});
