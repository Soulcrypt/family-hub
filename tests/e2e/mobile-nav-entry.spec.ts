import { expect, test } from "@playwright/test";

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Drives the full signup -> household -> features -> ready flow (mirroring
 * tests/e2e/family.spec.ts's identical helper) and lands on /dashboard. Duplicated here
 * rather than imported: no spec file in this suite exports its helpers -- see
 * tests/e2e/responsive.spec.ts's identical comment.
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

/**
 * SP1 design review Finding 2 (P2): the profile switcher (`/switch`) was reachable only from
 * the dashboard's family-strip tiles -- there was no dedicated entry point in the phone
 * bottom navigation at all (measured at 390px: 5 `/switch` links in the DOM, 4 visible, all
 * four dashboard tiles). components/shell/bottom-nav.tsx must offer one directly.
 */
test("phone bottom nav offers a dedicated entry point to the profile switcher", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "phone", "the bottom nav only renders below md -- see components/shell/bottom-nav.tsx");

  await onboardHousehold(page, { ownerName: "Morgan Owner", householdName: unique("The Nav Entry Family") });
  await page.goto("/dashboard");

  // Same locator as tests/e2e/responsive.spec.ts's identical comment: the bottom nav's
  // top-level element is the only <nav> carrying Tailwind's literal `fixed` utility class.
  const bottomNav = page.locator("nav.fixed");
  await expect(bottomNav).toBeVisible();

  const directLink = bottomNav.getByRole("link", { name: /switch/i });
  const moreButton = bottomNav.getByRole("button", { name: "More" });

  if (await directLink.count() > 0) {
    await expect(directLink).toBeVisible();
    await expect(directLink).toHaveAttribute("href", "/switch");
  } else if (await moreButton.count() > 0) {
    // Reachable via the documented "More" overflow disclosure instead of a direct tab --
    // see splitBottomNavItems's doc comment in components/shell/bottom-nav.tsx.
    await moreButton.click();
    const overflowLink = page.getByRole("dialog").getByRole("link", { name: /switch/i });
    await expect(overflowLink).toBeVisible();
    await expect(overflowLink).toHaveAttribute("href", "/switch");
  } else {
    throw new Error("No /switch entry point found in the bottom nav, directly or via the More overflow");
  }
});

/**
 * SP1 design review Finding 2 (P2), second half: the sidebar's `/switch` entry read "Who's
 * this?" next to a grey "?" avatar -- copy that parses as a help affordance ("what is this
 * screen?") rather than an instruction to act ("choose who you are"). Only reachable when
 * `getActiveMember()` (lib/auth/active-member.ts) comes back null -- which onboarding's own
 * `setActiveMember()` call means a freshly-onboarded household never hits, so the
 * `fh_active_member` cookie is cleared directly to force that fallback branch, rather than
 * asserting on a state ordinary onboarding cannot reach.
 */
test("the sidebar's profile entry names the action instead of reading like a help prompt", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "phone", "the sidebar only renders md+ -- see components/shell/sidebar.tsx");

  await onboardHousehold(page, { ownerName: "Riley Owner", householdName: unique("The Sidebar Copy Family") });
  await page.context().clearCookies({ name: "fh_active_member" });
  await page.goto("/dashboard");

  // toHaveAccessibleName, not toHaveText: the link's decorative fallback avatar (a grey "?")
  // is aria-hidden, so it must not count toward the accessible name a screen reader announces
  // -- but it IS part of raw textContent, which is exactly why this link visually read "?Who's
  // this?" before this fix and would still fail a naive toHaveText check afterward.
  const switcherLink = page.locator('aside a[href="/switch"]');
  await expect(switcherLink).toBeVisible();
  await expect(switcherLink).not.toHaveAccessibleName("Who’s this?");
  await expect(switcherLink).toHaveAccessibleName("Switch profile");
});

/**
 * SP1 design review Finding 3 (minor): ThemeToggle uses `inline-flex`, but as a child of a
 * column flex container (the sidebar footer, and this page's card) `align-items: stretch`
 * (the flex default) overrides that, stretching the sunken pill to the full container width
 * with its three buttons huddled at the left. A fixed component renders at content width no
 * matter how wide its container is -- checked here against a bound well above the toggle's
 * own natural width (3 buttons + gaps + padding, well under 200px) but well below either
 * container's width on a desktop-sized viewport.
 */
test("the theme toggle does not stretch to fill its container", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "phone", "checked against the sidebar's own footer, which does not render on phone");

  await onboardHousehold(page, { ownerName: "Casey Owner", householdName: unique("The Theme Width Family") });

  await page.goto("/settings/appearance");
  const pageToggle = page.locator("#main-content").getByRole("radiogroup", { name: "Color theme" });
  const pageBox = await pageToggle.boundingBox();
  expect(pageBox).not.toBeNull();
  expect(pageBox!.width).toBeLessThan(200);

  const sidebarToggle = page.locator("aside").getByRole("radiogroup", { name: "Color theme" });
  const sidebarBox = await sidebarToggle.boundingBox();
  expect(sidebarBox).not.toBeNull();
  expect(sidebarBox!.width).toBeLessThan(200);
});
