import { expect, test } from "@playwright/test";

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

type OnboardMember = { name: string; role: string };

/**
 * Drives the full signup -> household -> members -> features -> ready flow (mirroring
 * tests/e2e/family.spec.ts's identical helper) and lands on /dashboard, which 404s until
 * Task 16 -- only ever asserted by URL here, never by content, matching every other spec in
 * this suite.
 */
async function onboardHousehold(
  page: import("@playwright/test").Page,
  options: { ownerName: string; householdName: string; members?: OnboardMember[] },
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
    await page.getByRole("button", { name: "Add member" }).click();
    await expect(page.getByText(member.name, { exact: true })).toBeVisible();
  }

  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=features/);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=ready/);
  await page.getByRole("button", { name: /go to my dashboard/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("a parent can rename the household, enable a feature, toggle the theme, and a switched-to child sees settings read-only", async ({
  page,
}, testInfo) => {
  const householdName = unique("The Settings Family");
  const renamedHouseholdName = unique("The Renamed Family");
  const ownerName = "Origin Owner";
  const childName = "Kit Child";

  await onboardHousehold(page, {
    ownerName,
    householdName,
    members: [{ name: childName, role: "child" }],
  });

  // --- A parent can rename the household; the new name appears in the sidebar. ---
  await page.goto("/settings/household");
  await expect(page.getByRole("heading", { name: "Household", exact: true })).toBeVisible();
  await expect(page.getByLabel("Household name")).toHaveValue(householdName);

  // Scoped to #main-content, not the bare page: Next's own route announcer
  // (`#__next-route-announcer__`) is a permanent `role="alert"` element used for a11y
  // navigation announcements, unrelated to this app's error banners, and Playwright counts it
  // as "visible" (a nonzero, if visually tiny, bounding box) even though it's not this app's
  // content -- scoping to the app's own <main> excludes it.
  const mainContent = page.locator("#main-content");

  await page.getByLabel("Household name").fill(renamedHouseholdName);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(mainContent.getByRole("alert")).not.toBeVisible();

  // The sidebar (where the household name is shown) only renders on md+ viewports --
  // components/shell/sidebar.tsx's <aside> is `hidden md:flex`, and the bottom nav (its phone
  // equivalent) never shows the household name at all. Verified there on wide viewports;
  // verified everywhere else (including phone) by reloading and re-reading the persisted
  // value straight from the form.
  if (testInfo.project.name !== "phone") {
    await expect(page.locator("aside").getByText(renamedHouseholdName)).toBeVisible();
  }
  await page.reload();
  await expect(page.getByLabel("Household name")).toHaveValue(renamedHouseholdName);

  // --- Enabling the Meals feature makes a Meals entry appear in navigation. ---
  await expect(page.getByRole("link", { name: "Meals", exact: true })).not.toBeVisible();
  await page.locator("#feature-meals").check();
  await page.getByRole("button", { name: "Save features" }).click();
  await expect(mainContent.getByRole("alert")).not.toBeVisible();
  await expect(page.getByRole("link", { name: "Meals", exact: true })).toBeVisible();

  // --- The theme toggle switches the <html> class between light and dark. Scoped to
  // #main-content: ThemeToggle is ALSO mounted in the sidebar (app/(app)/layout.tsx renders it
  // unconditionally there), so an unscoped locator on this page would match two instances. ---
  await page.goto("/settings/appearance");
  const html = page.locator("html");

  await mainContent.getByRole("radio", { name: "Dark" }).click();
  await expect(html).toHaveClass(/\bdark\b/);

  await mainContent.getByRole("radio", { name: "Light" }).click();
  await expect(html).toHaveClass(/\blight\b/);

  // --- After switching to the child profile (no PIN required for a non-admin role),
  // /settings/household renders read-only with no save control. ---
  await page.goto("/switch");
  await page.getByRole("button", { name: childName }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/settings/household");
  await expect(page.locator("#main-content").getByText(renamedHouseholdName)).toBeVisible();
  await expect(page.getByLabel("Household name")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Save features" })).not.toBeVisible();
});
