import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

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
  page: Page,
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
