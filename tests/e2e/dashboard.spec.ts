import { expect, test } from "@playwright/test";

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
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
    await page.getByLabel("Role").selectOption(member.role);
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

  // --- Every disabled (non-locked) feature shows a "coming soon" placeholder, not an empty
  // region -- distinguishable from an error or a broken/missing card. ---
  await expect(mainContent.getByText("Calendar arrives soon — turn it on in Settings when you’re ready.")).toBeVisible();
  await expect(mainContent.getByText("Meals arrive soon — turn it on in Settings when you’re ready.")).toBeVisible();
  await expect(mainContent.getByText("Chores arrive soon — turn it on in Settings when you’re ready.")).toBeVisible();
  await expect(mainContent.getByText("Habits arrive soon — turn it on in Settings when you’re ready.")).toBeVisible();
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
