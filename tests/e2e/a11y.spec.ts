import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { onboardHousehold, unique } from "./support/onboarding";

type Scheme = "light" | "dark";

/**
 * Navigates to `route` and asserts axe reports no `serious` or `critical` violation there.
 *
 * Dark mode is never poked at directly (no `page.evaluate` setting `<html class>` by hand):
 * `attribute="class"` next-themes (components/theme/theme-provider.tsx) owns that attribute
 * itself and can overwrite a hand-set value on hydration, so a scan run against a page that
 * LOOKS dark from the test's own script but silently reverted by the time axe actually runs
 * would be worthless. Instead each caller sets Playwright's `colorScheme` context option
 * (`test.use({ colorScheme })`, see below) -- the same signal a real user's OS preference
 * sends -- and `defaultTheme="system"` + `enableSystem` (theme-provider.tsx) resolves it via
 * `prefers-color-scheme` exactly as it would for that user. This function then verifies the
 * resolution actually happened, on THIS page, before scanning: asserting `<html>` really
 * carries the expected class is the only way to know the scan wasn't accidentally run against
 * the wrong theme.
 */
async function assertNoSeriousViolations(page: Page, route: string, scheme: Scheme): Promise<void> {
  await page.goto(route);

  // Verify dark mode is REALLY dark (or light really light) before scanning -- see this
  // function's doc comment above.
  await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${scheme}\\b`));

  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");

  if (serious.length > 0) {
    const report = serious
      .map((v) => {
        const targets = v.nodes.map((n) => n.target.join(" ")).join(", ");
        return `  [${v.impact}] ${v.id}: ${v.description}\n    nodes: ${targets}\n    help: ${v.helpUrl}`;
      })
      .join("\n");
    expect(serious, `${route} (${scheme}) has serious/critical axe violations:\n${report}`).toEqual([]);
  }
}

const PUBLIC_ROUTES = ["/welcome", "/login"];
const AUTHENTICATED_ROUTES = ["/dashboard", "/family", "/switch", "/settings"];
const SCHEMES: Scheme[] = ["light", "dark"];

for (const scheme of SCHEMES) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    for (const route of PUBLIC_ROUTES) {
      test(`${route} has no serious or critical accessibility violations`, async ({ page }) => {
        await assertNoSeriousViolations(page, route, scheme);
      });
    }

    test("dashboard, family, switch and settings have no serious or critical accessibility violations", async ({
      page,
    }) => {
      const householdName = unique(`The A11y ${scheme} Family`);
      await onboardHousehold(page, { ownerName: "Jordan Owner", householdName });

      for (const route of AUTHENTICATED_ROUTES) {
        await assertNoSeriousViolations(page, route, scheme);
      }
    });
  });
}
