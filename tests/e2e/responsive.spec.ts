import { expect, test } from "@playwright/test";

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Drives the full signup -> household -> features -> ready flow (mirroring
 * tests/e2e/family.spec.ts's identical helper) and lands on /dashboard. Duplicated here
 * rather than imported: no spec file in this suite exports its helpers (confirmed across
 * family.spec.ts, settings.spec.ts, dashboard.spec.ts, switcher.spec.ts), so each file keeps
 * its own copy by established convention.
 */
async function onboardHousehold(
  page: import("@playwright/test").Page,
  options: { ownerName: string; householdName: string },
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

  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=features/);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=ready/);
  await page.getByRole("button", { name: /go to my dashboard/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("shows the bottom navigation on phone and the sidebar on wider viewports, never both", async ({
  page,
}, testInfo) => {
  await onboardHousehold(page, {
    ownerName: "Riley Owner",
    householdName: unique("The Responsive Family"),
  });

  await page.goto("/dashboard");

  // Same locators as family.spec.ts's shell test: the bottom nav's top-level element is the
  // only <nav> carrying Tailwind's literal `fixed` utility class on this page -- the
  // sidebar's internal <nav aria-label="Main"> does not, so this can't cross-match.
  const sidebar = page.locator("aside");
  const bottomNav = page.locator("nav.fixed");

  if (testInfo.project.name === "phone") {
    await expect(bottomNav).toBeVisible();
    await expect(sidebar).not.toBeVisible();
  } else {
    await expect(sidebar).toBeVisible();
    await expect(bottomNav).not.toBeVisible();
  }
});

const OVERFLOW_ROUTES = ["/dashboard", "/family", "/settings", "/switch"];

test("nothing overflows horizontally on the core app routes", async ({ page }) => {
  await onboardHousehold(page, {
    ownerName: "Casey Owner",
    householdName: unique("The No-Overflow Family"),
  });

  for (const route of OVERFLOW_ROUTES) {
    await page.goto(route);

    // documentElement.clientWidth, NOT window.innerWidth: innerWidth includes any vertical
    // scrollbar's own width, so comparing scrollWidth against innerWidth produces a false
    // positive "overflow" on any page tall enough to grow a scrollbar even when nothing
    // actually overflows horizontally. clientWidth excludes the scrollbar, matching what's
    // actually available for layout content.
    const overflow = await page.evaluate(() => {
      const html = document.documentElement;
      return { scrollWidth: html.scrollWidth, clientWidth: html.clientWidth };
    });

    expect(
      overflow.scrollWidth,
      `${route}: scrollWidth (${overflow.scrollWidth}) should not exceed clientWidth (${overflow.clientWidth})`,
    ).toBeLessThanOrEqual(overflow.clientWidth);
  }
});
