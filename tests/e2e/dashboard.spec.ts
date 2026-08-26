import { expect, test, type Page } from "@playwright/test";

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/**
 * Drives the full signup -> household -> members -> features -> ready flow (mirroring
 * tests/e2e/family.spec.ts's identical helper) and lands on /dashboard. Duplicated here rather
 * than imported: no spec file in this suite exports its helpers (established convention -- see
 * a11y.spec.ts/responsive.spec.ts's identical copies).
 *
 * This suite creates its own household per test rather than depending on seeded member names
 * (a concurrent task is rewriting supabase/seed.sql to the Garthwaite household) -- see this
 * task's brief.
 */
async function onboardHousehold(page: Page, options: { ownerName: string; householdName: string }): Promise<void> {
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
  await expect(page).toHaveURL(/step=location/);

  // Step 3/5 (components/onboarding/step-location.tsx) -- out of this task's scope (a
  // concurrent task's step); skipped rather than filled in, same as a real visitor who has no
  // calendar to connect yet would.
  await page.getByRole("link", { name: "Skip for now" }).click();
  await expect(page).toHaveURL(/step=features/);

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=widgets/);

  // Step 5/5 (components/onboarding/step-widgets.tsx) -- pre-checked to the five defaults;
  // this suite exercises editing the layout AFTER landing on the dashboard, not during
  // onboarding itself, so it just accepts the defaults here.
  await page.getByRole("button", { name: "Finish setup" }).click();
  await expect(page).toHaveURL(/step=ready/);

  await page.getByRole("button", { name: /go to my dashboard/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("greets the signed-in member by first name with a time-appropriate greeting and a daily summary line", async ({
  page,
}) => {
  const householdName = unique("The Widget Family");
  await onboardHousehold(page, { ownerName: "Dana Owner", householdName });

  await page.goto("/dashboard");
  const main = page.locator("#main-content");

  // Exactly one h1, greeting the FIRST NAME only (not the household name -- SP1 Foundation's
  // earlier build greeted the household; this rebuild greets whichever person the screen is
  // attributed to, per Design-Spec §8.1/§3 and mocks 2a/2f/3a).
  await expect(page.locator("h1")).toHaveCount(1);
  const heading = page.locator("h1");
  await expect(heading).toHaveText(/^Good (morning|afternoon|evening), Dana\.$/);

  // The generated daily-summary subline. No calendar/meal-plan data source exists yet, so this
  // must read honestly -- never a specific invented event count or dinner time (this task's
  // brief: "Never fake data").
  await expect(main.getByText(/no events yet · dinner not planned yet/)).toBeVisible();
});

test("renders all five default widgets, each labelled as its own section", async ({ page }) => {
  const householdName = unique("The Five Widgets Family");
  await onboardHousehold(page, { ownerName: "Riley Owner", householdName });

  await page.goto("/dashboard");
  const main = page.locator("#main-content");

  for (const name of ["Today", "Tonight's dinner", "Weather", "Photos", "Local news"]) {
    await expect(main.getByRole("heading", { level: 2, name })).toBeVisible();
  }
});

test("schedule, dinner and photos render honest empty states -- never fake data -- each deep-linking to its own screen", async ({
  page,
}) => {
  const householdName = unique("The Honest Empty Family");
  await onboardHousehold(page, { ownerName: "Sam Owner", householdName });

  await page.goto("/dashboard");
  const main = page.locator("#main-content");

  await expect(main.getByText("no events on the calendar yet")).toBeVisible();
  const addEvent = main.getByRole("link", { name: "+ Add event" });
  await expect(addEvent).toHaveAttribute("href", "/calendar");

  await expect(main.getByText("no dinner planned yet")).toBeVisible();
  await expect(main.getByRole("link", { name: "+ Add meal" })).toHaveAttribute("href", "/meals");

  await expect(main.getByText("no photos yet")).toBeVisible();
  await expect(main.getByRole("link", { name: "+ Add photos" })).toHaveAttribute("href", "/photos");

  // The deep-link actually resolves to the feature's own (honest "not built yet") screen,
  // rather than a dead link.
  await addEvent.click();
  await expect(page).toHaveURL(/\/calendar$/);
});

test("weather widget shows real Open-Meteo data or an honest unavailable message -- never a placeholder", async ({
  page,
}) => {
  const householdName = unique("The Weather Family");
  await onboardHousehold(page, { ownerName: "Morgan Owner", householdName });

  await page.goto("/dashboard");
  const weatherSection = page.locator("#main-content section", { has: page.getByRole("heading", { level: 2, name: "Weather" }) });
  await expect(weatherSection).toBeVisible();

  const text = (await weatherSection.textContent()) ?? "";
  const hasRealData = /\d+°/.test(text);
  const isHonestlyUnavailable = text.includes("weather is unavailable right now");
  expect(hasRealData || isHonestlyUnavailable).toBe(true);
});

test("local news shows real headlines with a working source link, or an honest empty state -- never an invented headline", async ({
  page,
}) => {
  const householdName = unique("The News Family");
  await onboardHousehold(page, { ownerName: "Casey Owner", householdName });

  await page.goto("/dashboard");
  const newsSection = page.locator("#main-content section", { has: page.getByRole("heading", { level: 2, name: "Local news" }) });
  await expect(newsSection).toBeVisible();

  const links = newsSection.getByRole("link");
  const count = await links.count();
  if (count > 0) {
    expect(count).toBeLessThanOrEqual(2);
    const href = await links.first().getAttribute("href");
    expect(href).toMatch(/^https:\/\//);
    await expect(links.first()).toHaveAttribute("target", "_blank");
  } else {
    await expect(newsSection.getByText("no local headlines available right now")).toBeVisible();
  }
});

test("edit mode: removing a widget hides it, and the change persists across a reload", async ({ page }) => {
  const householdName = unique("The Edit Remove Family");
  await onboardHousehold(page, { ownerName: "Jamie Owner", householdName });

  await page.goto("/dashboard");
  const main = page.locator("#main-content");

  await main.getByRole("button", { name: "+ Edit widgets" }).click();
  await expect(main.getByRole("button", { name: "Done editing" })).toBeVisible();

  await main.getByRole("button", { name: "Remove Photos widget" }).click();
  await expect(main.getByRole("heading", { level: 2, name: "Photos" })).toHaveCount(0);

  await main.getByRole("button", { name: "Done editing" }).click();

  // Give the (already-fired, optimistic-UI) save action a moment to actually land before
  // reloading -- otherwise this reload could race the network request and read stale data.
  await page.waitForLoadState("networkidle");

  // Persisted server-side (member_dashboard_layouts), not just client state.
  await page.reload();
  await expect(page.locator("#main-content").getByRole("heading", { level: 2, name: "Photos" })).toHaveCount(0);
});

test("edit mode: the + Add drawer offers a removed widget back, and adding it restores the widget", async ({
  page,
}) => {
  const householdName = unique("The Edit Add Family");
  await onboardHousehold(page, { ownerName: "Avery Owner", householdName });

  await page.goto("/dashboard");
  const main = page.locator("#main-content");

  await main.getByRole("button", { name: "+ Edit widgets" }).click();
  await main.getByRole("button", { name: "Remove Local news widget" }).click();
  await expect(main.getByRole("heading", { level: 2, name: "Local news" })).toHaveCount(0);

  await main.getByRole("button", { name: "+ Add" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a widget" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "+ Add" }).click();

  await expect(main.getByRole("heading", { level: 2, name: "Local news" })).toBeVisible();
});

test("edit mode: widgets reorder via keyboard-operable buttons (not drag-only), and boundaries disable correctly", async ({
  page,
}) => {
  const householdName = unique("The Keyboard Reorder Family");
  await onboardHousehold(page, { ownerName: "Quinn Owner", householdName });

  await page.goto("/dashboard");
  const main = page.locator("#main-content");

  await main.getByRole("button", { name: "+ Edit widgets" }).click();

  // Group boundaries: the first primary widget cannot move earlier; the last cannot move
  // later. Same for the secondary row.
  await expect(main.getByRole("button", { name: "Move Today widget earlier" })).toBeDisabled();
  await expect(main.getByRole("button", { name: "Move Tonight's dinner widget later" })).toBeDisabled();
  await expect(main.getByRole("button", { name: "Move Weather widget earlier" })).toBeDisabled();
  await expect(main.getByRole("button", { name: "Move Local news widget later" })).toBeDisabled();

  const headingsBefore = await main.getByRole("heading", { level: 2 }).allTextContents();
  expect(headingsBefore.indexOf("Weather")).toBeLessThan(headingsBefore.indexOf("Photos"));

  // A real keyboard interaction (focus + Enter), not a mouse click -- Design-Spec §10 requires
  // full keyboard navigation, and this proves the reorder control is genuinely keyboard-operable
  // rather than merely clickable.
  await main.getByRole("button", { name: "Move Weather widget later" }).press("Enter");

  const headingsAfter = await main.getByRole("heading", { level: 2 }).allTextContents();
  expect(headingsAfter.indexOf("Photos")).toBeLessThan(headingsAfter.indexOf("Weather"));

  await main.getByRole("button", { name: "Done editing" }).click();
  await page.waitForLoadState("networkidle");
  await page.reload();

  const headingsPersisted = await page.locator("#main-content").getByRole("heading", { level: 2 }).allTextContents();
  expect(headingsPersisted.indexOf("Photos")).toBeLessThan(headingsPersisted.indexOf("Weather"));
});
