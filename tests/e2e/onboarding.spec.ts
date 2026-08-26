import { expect, test } from "@playwright/test";

function uniqueEmail(): string {
  return `owner-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;
}

/**
 * Chooses an option in the "Role" picker -- now `components/ui/select.tsx`'s Radix combobox
 * (design-review fix: raw `<select>` -> the app's own styled Select), not a native `<select>`,
 * so `locator.selectOption()` no longer applies: that method only drives a real
 * `HTMLSelectElement`, and the visible control here is a `<button role="combobox">` (see
 * @radix-ui/react-select's `SelectTrigger`). Opens the listbox via its labelled trigger, then
 * clicks the option by its visible text -- `ROLE_LABELS` (lib/constants/roles.ts) capitalizes
 * the raw enum value, so `"child"` -> `"Child"`.
 */
async function chooseRole(page: import("@playwright/test").Page, role: string): Promise<void> {
  await page.getByLabel("Role").click();
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  await page.getByRole("option", { name: label, exact: true }).click();
}

test("a new user can complete onboarding and reach the dashboard", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Dana Parent");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: /welcome to family hub/i })).toBeVisible();
  await page.getByRole("button", { name: "Get started" }).click();

  await page.getByLabel("Household name").fill("The Testers");
  await page.getByRole("button", { name: "Continue" }).click();
  // Each step's "Continue" is a DIFFERENT button that happens to share this accessible name
  // (household -> members -> features -> ready are separate client-side navigations) --
  // waiting for the URL between clicks avoids a race where a second click lands on the
  // still-present outgoing button before the navigation swaps it out.
  await expect(page).toHaveURL(/step=members/);

  // A login-less child.
  await page.getByRole("button", { name: "Add a family member" }).click();
  await page.getByLabel("Name").fill("Ivy");
  await chooseRole(page, "child");
  await page.getByRole("button", { name: "Add member" }).click();
  await expect(page.getByText("Ivy")).toBeVisible();

  // This step's "Continue" is a plain navigation Link (not a form-submit button, unlike the
  // household/features steps' -- see the Web Interface Guidelines fix that made it a <Link> so
  // Cmd/Ctrl/middle-click work), so its accessible role is "link", not "button".
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=location/);

  // Reconciled flow (Design-Spec §8.11): household -> members -> location -> features ->
  // widgets -> ready. Location is skippable/optional, so an empty submit is valid.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=features/);

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=widgets/);

  await page.getByRole("button", { name: /finish setup/i }).click();
  await expect(page).toHaveURL(/step=ready/);

  // The wizard's last step confirms the household by name before handing off — this is
  // the meaningful assertion here, not the dashboard itself. /dashboard doesn't exist until
  // Task 16 and 404s today; that's expected, so only its URL is asserted below, never its
  // content (see task-10-brief context notes).
  await expect(page.getByText("The Testers")).toBeVisible();
  await page.getByRole("button", { name: /go to my dashboard/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);
});

test("onboarding resumes past household creation for a user who already has one", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Remy Returning");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();

  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("Household name").fill("The Returners");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=members/);

  // Simulate the interrupted-and-came-back case: land back on /onboarding with no step,
  // and directly re-request the household-creation step by URL (e.g. browser back).
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/step=members/);

  await page.goto("/onboarding?step=household");
  await expect(page).toHaveURL(/step=members/);
});
