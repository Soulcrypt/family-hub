import { execFile } from "node:child_process";
import { expect, test } from "@playwright/test";
import { chooseRole } from "./support/controls";

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// The local Supabase CLI's fixed default -- see tests/e2e/switcher.spec.ts's identical
// constant/helper for the full rationale (bypassing RLS/the service-role key entirely, exactly
// as this project's pgTAP suites do). Duplicated here rather than imported: no spec file in
// this suite exports its helpers (see `onboardHousehold`'s own doc comment below), so each
// file keeps its own copy by established convention.
const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const DB_URL = process.env.SUPABASE_DB_URL ?? LOCAL_DB_URL;

function psql(sql: string, vars: Record<string, string> = {}): Promise<string> {
  const args = [DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-F,"];
  for (const [name, value] of Object.entries(vars)) args.push("-v", `${name}=${value}`);
  return new Promise((resolve, reject) => {
    const child = execFile("psql", args, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
    child.stdin?.end(sql);
  });
}

type MemberFixture = { id: string; role: string };

/** Looks up every `household_members` row for a household by its (unique-per-test) name. */
async function membersOf(householdName: string): Promise<MemberFixture[]> {
  const stdout = await psql(
    "select m.id, m.role from household_members m join households h on h.id = m.household_id where h.name = :'household_name'",
    { household_name: householdName },
  );
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, role] = line.split(",");
      if (!id || !role) throw new Error(`unexpected psql row: ${line}`);
      return { id, role };
    });
}

/** Reads the plaintext member id out of the `fh_active_member` cookie -- see
 * tests/e2e/switcher.spec.ts's identical helper for why this is a legitimate way for a test to
 * observe which member is currently attributed. */
async function activeMemberId(page: import("@playwright/test").Page): Promise<string | null> {
  const cookie = (await page.context().cookies()).find((c) => c.name === "fh_active_member");
  if (!cookie) return null;
  const dot = cookie.value.lastIndexOf(".");
  return dot > 0 ? cookie.value.slice(0, dot) : null;
}

type OnboardMember = { name: string; role: string; birthday?: string };

/**
 * Drives the full signup -> household -> members -> features -> ready flow (mirroring
 * tests/e2e/family.spec.ts's identical helper) and lands on /dashboard -- which this suite is
 * the first to assert actual CONTENT on, not just the URL, now that Task 16 exists.
 */
async function onboardHousehold(
  page: import("@playwright/test").Page,
  options: { ownerName: string; householdName: string; members?: OnboardMember[]; features?: string[] },
): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(options.ownerName);
  await page.getByLabel("Email").fill(`${unique("owner")}@test.local`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: /welcome to family hub/i })).toBeVisible();
  await page.getByRole("button", { name: "Get started" }).click();

  await page.getByLabel("Household name").fill(options.householdName);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=members/);

  for (const member of options.members ?? []) {
    await page.getByRole("button", { name: "Add a family member" }).click();
    await page.getByLabel("Name").fill(member.name);
    await chooseRole(page, member.role);
    if (member.birthday) await page.getByLabel("Birthday").fill(member.birthday);
    await page.getByRole("button", { name: "Add member" }).click();
    await expect(page.getByText(member.name, { exact: true })).toBeVisible();
  }

  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=features/);

  for (const key of options.features ?? []) {
    await page.locator(`#feature-${key}`).check();
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=ready/);
  await page.getByRole("button", { name: /go to my dashboard/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("the dashboard greets the household, shows every active member, and placeholders disabled features", async ({
  page,
}) => {
  const householdName = unique("The Ivans");
  const ownerName = "Dana Owner";
  const childName = "Ivy";

  // No optional features enabled -- every one of calendar/meals/chores/habits should show a
  // placeholder card.
  await onboardHousehold(page, {
    ownerName,
    householdName,
    members: [{ name: childName, role: "child", birthday: "2015-03-03" }],
  });

  // Already on /dashboard from the redirect above -- reload fresh to assert on first render.
  await page.goto("/dashboard");
  const mainContent = page.locator("#main-content");

  // --- Exactly one <h1>, and it greets by household name. ---
  await expect(page.locator("h1")).toHaveCount(1);
  const heading = page.locator("h1");
  await expect(heading).toContainText(householdName);

  // --- The greeting is time-appropriate: one of the three fixed, pure-function outputs. ---
  await expect(heading).toHaveText(/^Good (morning|afternoon|evening), /);

  // --- Every active member appears in the family strip. Scoped to #main-content (as in
  // family.spec.ts) because the sidebar/bottom-nav shell separately shows the currently
  // ATTRIBUTED member's name too, which would otherwise make a page-wide getByText ambiguous. ---
  await expect(mainContent.getByText(ownerName, { exact: true })).toBeVisible();
  await expect(mainContent.getByText(childName, { exact: true })).toBeVisible();

  // --- Every feature with no screen yet is named in a single quiet line, not an empty region
  // -- distinguishable from an error or a broken/missing card. SP1 Foundation design review
  // collapsed the four "Coming soon" cards this used to be into one sentence (this task's
  // brief); none of these features were enabled during onboarding, so it reads as the
  // DISABLED-state sentence, naming all four and pointing at Settings. ---
  await expect(
    mainContent.getByText(
      "Calendar, Meals, Chores and Habits aren’t turned on yet — turn them on in Settings when you’re ready.",
    ),
  ).toBeVisible();
});

/**
 * Regression coverage for this task's brief: the placeholder logic used to key off "disabled,
 * non-locked feature" (app/(app)/dashboard/page.tsx), so a household that turned Calendar ON
 * in onboarding got no dashboard card at all for it -- the same feature whose nav link 404'd
 * (see tests/e2e/family.spec.ts's "the navigation never offers a link that doesn't resolve"
 * regression test). The fix keys the placeholder off `hasScreen` instead
 * (lib/constants/features.ts): a feature with no screen is accounted for whether or not the
 * household turned it on, and the copy says which state it's actually in -- "turn it on in
 * Settings" is wrong advice for a feature that's already on.
 *
 * SP1 Foundation design review collapsed the four cards this copy used to fill into one quiet
 * line (`comingSoonLine()`, lib/constants/coming-soon.ts) -- this test now proves that
 * collapse did not quietly drop the enabled-vs-never-enabled distinction the cards used to
 * carry: with two features in each group, the line reads as two distinct sentences.
 */
test("an enabled-but-unbuilt feature gets 'already on' placeholder copy, distinct from a disabled one", async ({
  page,
}) => {
  const householdName = unique("The Early Adopter Family");
  const ownerName = "Enable Owner";

  await onboardHousehold(page, {
    ownerName,
    householdName,
    features: ["calendar", "meals"],
  });

  await page.goto("/dashboard");
  const mainContent = page.locator("#main-content");

  // Calendar and Meals were turned ON -- no "turn it on in Settings" copy, since that would be
  // stale/wrong advice for a feature the household already enabled. Instead they get a sentence
  // that says the features are already on and their screens are still coming.
  await expect(mainContent.getByText("Calendar and Meals are on — their screens are still on the way.")).toBeVisible();

  // Chores and Habits were never enabled -- still get a "turn it on" sentence, distinct from
  // the enabled group's above.
  await expect(
    mainContent.getByText("Chores and Habits aren’t turned on yet — turn them on in Settings when you’re ready."),
  ).toBeVisible();
});

test("a household with exactly one member renders the dashboard without error", async ({ page }) => {
  const householdName = unique("The Solo Family");
  const ownerName = "Solo Owner";

  await onboardHousehold(page, { ownerName, householdName });

  await page.goto("/dashboard");
  const mainContent = page.locator("#main-content");

  await expect(page.locator("h1")).toHaveCount(1);
  await expect(mainContent.getByText(ownerName, { exact: true })).toBeVisible();
});

test("a member removed from the household no longer appears in the owner's family strip", async ({ page }) => {
  // Regression coverage for this task's brief, point 1: Task 15 widened
  // `members_select_household` so an owner/parent caller now sees INACTIVE members too (a
  // non-admin caller already only ever saw active ones). Without the family strip's own
  // `.eq("is_active", true)` filter (app/(app)/dashboard/page.tsx), an owner's dashboard would
  // show someone who was removed from the household right alongside everyone still in it.
  const householdName = unique("The Pruned Family");
  const ownerName = "Owner Remaining";
  const removedName = "Removed Kid";

  await onboardHousehold(page, {
    ownerName,
    householdName,
    members: [{ name: removedName, role: "child" }],
  });

  // Deactivate the child via the real "remove from household" flow (family.spec.ts's identical
  // UI path), not a raw SQL update -- this exercises the same is_active flip the dashboard
  // must respect, produced the same way a real admin would produce it.
  await page.goto("/family");
  await page.locator("#main-content").getByText(removedName, { exact: true }).click();
  await expect(page).toHaveURL(/\/family\/.+/);
  await page.getByRole("button", { name: "Remove from household" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page).toHaveURL(/\/family$/);

  await page.goto("/dashboard");
  const mainContent = page.locator("#main-content");
  await expect(mainContent.getByText(ownerName, { exact: true })).toBeVisible();
  await expect(mainContent.getByText(removedName, { exact: true })).not.toBeVisible();
});

// --- SP1 Foundation design review, "one tap switches": tapping a face on the dashboard used
// to navigate to /switch, where the SAME face had to be tapped a second time. These tests
// prove a single tap on the dashboard itself is now enough -- for an ungated tile, tapping it
// switches attribution directly with no intermediate screen; for a PIN-protected profile, it
// opens the very same PinDialog the switcher uses, in place, again without leaving /dashboard.
test("tapping a non-PIN-protected family member's tile on the dashboard switches attribution in one tap, without visiting /switch", async ({
  page,
}) => {
  const householdName = unique("The One Tap Family");
  const ownerName = "Robin Owner";
  const childName = "Riley Kid";

  await onboardHousehold(page, {
    ownerName,
    householdName,
    members: [{ name: childName, role: "child" }],
  });

  const members = await membersOf(householdName);
  const childRow = members.find((m) => m.role === "child");
  if (!childRow) throw new Error("expected a child member fixture");

  await page.goto("/dashboard");
  const mainContent = page.locator("#main-content");

  await mainContent.getByRole("button", { name: childName, exact: true }).click();

  // Stays on /dashboard the whole time -- never a round trip through /switch.
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect.poll(() => activeMemberId(page)).toBe(childRow.id);
});

test("tapping a PIN-protected family member's tile on the dashboard opens the PIN dialog in place, without visiting /switch", async ({
  page,
}) => {
  const householdName = unique("The One Tap Gated Family");
  const ownerName = "Morgan Owner";
  const parentName = "Guarded Parent";
  const parentPin = "7391";

  await onboardHousehold(page, {
    ownerName,
    householdName,
    members: [{ name: parentName, role: "parent" }],
  });

  const members = await membersOf(householdName);
  const parentRow = members.find((m) => m.role === "parent");
  if (!parentRow) throw new Error("expected a parent member fixture");

  // Task 13's own-profile PIN-setting flow doesn't reach this test (same reasoning as
  // switcher.spec.ts) -- seed it directly, hashed with pgcrypto so verify_member_pin can read
  // it back (see switcher.spec.ts's identical seeding step for the full rationale).
  await psql(
    "update household_members set pin_hash = extensions.crypt(:'pin', extensions.gen_salt('bf', 10)) where id = :'member_id'",
    { pin: parentPin, member_id: parentRow.id },
  );

  await page.goto("/dashboard");
  const mainContent = page.locator("#main-content");

  const gatedTile = mainContent.getByRole("button", { name: parentName });
  await expect(gatedTile).toHaveAccessibleName(/pin/i);
  await gatedTile.click();

  // The dialog opens IN PLACE -- still on /dashboard, never navigated to /switch.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);

  // A wrong PIN is rejected and attribution does not change.
  await page.getByLabel("PIN").fill("0000");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Incorrect PIN" })).toBeVisible();
  expect(await activeMemberId(page)).not.toBe(parentRow.id);

  // The correct PIN switches attribution, still without ever leaving /dashboard.
  await page.getByLabel("PIN").fill(parentPin);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect.poll(() => activeMemberId(page)).toBe(parentRow.id);
});

// --- SP1 Foundation design review: the primary surface for this app is a wall-mounted kitchen
// tablet glanced at from ~1.5m away -- the greeting needs a type scale of its own on a wide
// viewport rather than rendering identically at 390px and 1280px. ---
test("the greeting's heading renders larger on a wide (kitchen-tablet) viewport than on a phone", async ({
  page,
}) => {
  const householdName = unique("The Wall Tablet Family");
  await onboardHousehold(page, { ownerName: "Wall Owner", householdName });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  const phoneSize = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    return h1 ? parseFloat(getComputedStyle(h1).fontSize) : 0;
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/dashboard");
  const wideSize = await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    return h1 ? parseFloat(getComputedStyle(h1).fontSize) : 0;
  });

  expect(phoneSize).toBeGreaterThan(0);
  expect(wideSize).toBeGreaterThan(phoneSize);
});

// --- SP1 Foundation design review: `truncate` used to sit alongside `break-words` on the
// greeting heading and won (white-space: nowrap), clipping the household's own name mid-word
// on a phone. This proves a household name long enough to force a real layout decision wraps
// onto more than one line -- and is never cut short with an ellipsis -- rather than merely
// "doesn't overflow" (tests/e2e/responsive.spec.ts's generic sweep already covers overflow for
// every core route with ordinary-length names; this is the pathological long-name case the
// brief calls out by name). ---
test("a very long household name wraps across multiple lines in the greeting instead of being clipped", async ({
  page,
}) => {
  // Not `unique(...)`'d -- the household name input caps at 80 chars (maxLength,
  // components/onboarding/step-household.tsx), which a `unique()` timestamp/random suffix
  // would push past, truncating the very name this test needs to stay intact. This test never
  // looks the household up by name afterward, so a fixed (non-unique) name is fine here.
  const longHouseholdName = "The Extraordinarily Long Household Name That Keeps Going And Going Riveras";

  await page.setViewportSize({ width: 390, height: 844 });
  await onboardHousehold(page, { ownerName: "Verbose Owner", householdName: longHouseholdName });

  await page.goto("/dashboard");
  const heading = page.locator("h1");

  // The full name is present, nowhere truncated with an ellipsis.
  await expect(heading).toContainText(longHouseholdName);
  await expect(heading).not.toContainText("…");

  // It actually wraps -- more than one line of text -- rather than merely not-overflowing by
  // being (invisibly) clipped to one.
  const { lineCount, overflowsViewport } = await page.evaluate(() => {
    const el = document.querySelector("h1");
    if (!el) return { lineCount: 0, overflowsViewport: true };
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
    const lines = lineHeight > 0 ? Math.round(el.getBoundingClientRect().height / lineHeight) : 0;
    return { lineCount: lines, overflowsViewport: el.scrollWidth > document.documentElement.clientWidth };
  });
  expect(lineCount).toBeGreaterThan(1);
  expect(overflowsViewport).toBe(false);
});
