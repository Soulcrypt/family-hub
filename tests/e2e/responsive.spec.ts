import { expect, test } from "@playwright/test";
import { onboardHousehold, unique } from "./support/onboarding";

test("shows the floating dock on phone and the top bar on wider viewports, never both", async ({
  page,
}, testInfo) => {
  await onboardHousehold(page, {
    ownerName: "Riley Owner",
    householdName: unique("The Responsive Family"),
  });

  await page.goto("/dashboard");

  // The shell is Design-Spec §5's now: a transparent top bar over the aurora on md+, and a
  // floating pill dock below that. This test used to assert an `<aside>` sidebar and a bottom
  // tab bar, which is what the app had before the Hearth rebuild -- both elements are gone.
  //
  // Both surfaces render a `<nav aria-label="Main">`, so the locators disambiguate on the
  // element that OWNS each one rather than on the nav itself: the top bar is the page's
  // `<header>`, and the dock is the fixed-position nav that is not inside it.
  const topBar = page.locator("header nav[aria-label='Main']");
  const dock = page.locator("nav.fixed[aria-label='Main']");

  if (testInfo.project.name === "phone") {
    await expect(dock).toBeVisible();
    await expect(topBar).not.toBeVisible();
  } else {
    await expect(topBar).toBeVisible();
    await expect(dock).not.toBeVisible();
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
