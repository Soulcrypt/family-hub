import { expect, test } from "@playwright/test";

function uniqueEmail(): string {
  return `user-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;
}

test("a new user can sign up and reach onboarding", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Test Parent");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);
});

test("an unauthenticated visitor is redirected away from the dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/welcome/);
});

test("a wrong password shows an error and does not sign in", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nobody@test.local");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  // Next.js's own route announcer (#__next-route-announcer__, always present once a page has
  // hydrated) is also role="alert", so a bare getByRole("alert") matches two elements here --
  // filter to the one carrying the actual error text.
  await expect(page.getByRole("alert").filter({ hasText: /invalid/i })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
