import { expect, type Page } from "@playwright/test";
import { chooseRole } from "./controls";

/**
 * The canonical "get me a signed-in owner with a household" helper.
 *
 * This lives in one place because the last time it did not, one product change broke it in
 * seven spec files at once. Onboarding gained two steps (location and widgets, reconciling the
 * flow to Design-Spec §8.11), and every file that had copied the helper kept walking the old
 * chain. That is the same failure the shared Select driver in `./controls.ts` exists to
 * prevent: a thing every spec drives had a driver duplicated into each spec that needed it.
 *
 * The current chain is:
 *   signup -> welcome -> household -> members -> location -> features -> widgets -> ready
 *
 * Two things here look like ceremony and are not:
 *
 *  - **The `toHaveURL` wait between clicks.** Every step's primary control shares the
 *    accessible name "Continue". Without waiting for the URL to change, a second click can
 *    land on the outgoing step's button before the client-side navigation swaps it out, and
 *    the run fails somewhere later with no obvious cause.
 *  - **The members step's Continue is a LINK, not a button.** It was deliberately made a
 *    `<Link>` so Cmd/Ctrl/middle-click work, which changes its implicit ARIA role. Every other
 *    step submits a form.
 */
export type OnboardMember = { name: string; role: string };

export type OnboardOptions = {
  ownerName: string;
  householdName: string;
  members?: OnboardMember[];
  /** Optional feature keys to tick on the features step, e.g. `["meals", "calendar"]`. */
  features?: string[];
};

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export async function onboardHousehold(page: Page, options: OnboardOptions): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(options.ownerName);
  await page.getByLabel("Email").fill(`${unique("owner")}@test.local`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("button", { name: "Get started" })).toBeVisible();
  await page.getByRole("button", { name: "Get started" }).click();

  await page.getByLabel("Household name").fill(options.householdName);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=members/);

  for (const member of options.members ?? []) {
    await page.getByRole("button", { name: "Add a family member" }).click();
    await page.getByLabel("Name").fill(member.name);
    await chooseRole(page, member.role);
    await page.getByRole("button", { name: "Add member" }).click();
    await expect(page.getByText(member.name).first()).toBeVisible();
  }

  await page.getByRole("link", { name: "Continue" }).click();

  // Location is optional, so an empty submit is a valid pass-through.
  await expect(page).toHaveURL(/step=location/);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/step=features/);
  for (const feature of options.features ?? []) {
    await page.locator(`#feature-${feature}`).check();
  }
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/step=widgets/);
  await page.getByRole("button", { name: /finish setup/i }).click();

  await expect(page).toHaveURL(/step=ready/);
  await page.getByRole("button", { name: /go to my dashboard/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export { unique };
