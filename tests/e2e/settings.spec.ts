import { expect, test } from "@playwright/test";

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

type OnboardMember = { name: string; role: string };

/**
 * Chooses an option in the "Role" picker -- `components/ui/select.tsx`'s Radix combobox
 * (design-review fix: raw `<select>` -> the app's own styled Select), not a native `<select>`,
 * so `locator.selectOption()` no longer applies: that method only drives a real
 * `HTMLSelectElement`, and the visible control here is a `<button role="combobox">` (see
 * @radix-ui/react-select's `SelectTrigger`). Opens the listbox via its labelled trigger, then
 * clicks the option by its visible text -- `ROLE_LABELS` (lib/constants/roles.ts) capitalizes
 * the raw enum value, so `"child"` -> `"Child"`. Identical to tests/e2e/family.spec.ts and
 * tests/e2e/onboarding.spec.ts's own `chooseRole` helper.
 */
async function chooseRole(page: import("@playwright/test").Page, role: string): Promise<void> {
  await page.getByLabel("Role").click();
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  await page.getByRole("option", { name: label, exact: true }).click();
}

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
    await chooseRole(page, member.role);
    await page.getByRole("button", { name: "Add member" }).click();
    await expect(page.getByText(member.name, { exact: true })).toBeVisible();
  }

  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=location/);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=features/);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=widgets/);
  await page.getByRole("button", { name: /finish setup/i }).click();
  await expect(page).toHaveURL(/step=ready/);
  await page.getByRole("button", { name: /go to my dashboard/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("a parent can rename the household, enable a feature, toggle the theme, and a switched-to child sees settings read-only", async ({
  page,
}) => {
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

  // click() only dispatches the form submission -- it does not wait for
  // updateHouseholdAction's round trip to finish, and the ".not.toBeVisible()" check above is
  // a negative assertion that passes the instant it's evaluated (there was never an alert to
  // begin with), so on its own it provides no synchronization either. Without an explicit wait
  // here, the reload below can race ahead of the actual UPDATE committing -- invisible while
  // that write stayed fast, but a real, reproducible failure once
  // 0017_household_timezone_guard.sql's trigger added a genuine (if small) per-write cost:
  // confirmed by reverting that migration alone and seeing this test's phone project go from
  // failing every run to passing every run. The "aside" wait a few lines down happens to
  // provide the same synchronization for md+ viewports (it can't resolve true until the
  // server action's response has actually re-rendered the page), but phone renders no sidebar
  // at all -- so wait on something every viewport has: the button itself. useActionState's
  // `pending` flag (components/settings/household-settings-form.tsx) only flips back to
  // false, re-enabling this button, once the action's promise has actually settled.
  await expect(page.getByRole("button", { name: "Save changes" })).toBeEnabled();

  // A `components/shell/sidebar.tsx` <aside> used to mirror the household name here on md+
  // viewports; the concurrent Hearth shell rebuild (commit b544a7e, out of this task's
  // touchable set) replaced that sidebar with the Design-Spec §5 top bar +
  // floating dock, and the top bar shows no household name anywhere
  // (components/shell/top-bar.tsx renders the wordmark, nav links, weather, and family
  // avatars -- never the household's name). That secondary "chrome reflects the rename"
  // guarantee is no longer expressible against this shell, so it's dropped rather than left
  // to fail against markup this task doesn't own; the guarantee that actually matters here
  // (the rename itself persisted) is still verified below by reloading and re-reading the
  // value straight from the form, on every viewport.
  await page.reload();
  await expect(page.getByLabel("Household name")).toHaveValue(renamedHouseholdName);

  // --- Enabling the Meals feature records the household's choice, and now (the concurrent
  // Hearth shell rebuild, components/shell/nav-items.ts, out of this task's touchable set)
  // ALSO puts a real Meals entry in the navigation even though the screen isn't built yet --
  // that file's own doc comment explains the reversal: every route in its nav catalogue
  // resolves, with `components/shell/coming-soon.tsx`'s honest empty state standing in for an
  // unbuilt feature, rather than hiding the household's choice or risking the 404 this
  // project's nav used to be able to produce. The choice is still real: it survives a reload
  // (the checkbox itself stays checked), and the link it adds actually resolves to that
  // honest "isn't built yet" screen, not a 404. ---
  await expect(page.getByRole("link", { name: "Meals", exact: true })).not.toBeVisible();
  await page.locator("#feature-meals").check();
  await page.getByRole("button", { name: "Save features" }).click();
  await expect(mainContent.getByRole("alert")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Save features" })).toBeEnabled();
  const mealsLink = page.getByRole("link", { name: "Meals", exact: true });
  await expect(mealsLink).toBeVisible();
  await expect(mealsLink).toHaveAttribute("href", "/meals");

  await page.reload();
  await expect(page.locator("#feature-meals")).toBeChecked();

  await page.goto("/meals");
  await expect(page.getByRole("heading", { name: "Meals", exact: true })).toBeVisible();
  await expect(page.getByText(/isn.t built yet/i)).toBeVisible();

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

  // --- SP1 design review Finding 1 (P0): admin-only surfaces must not be OFFERED to a
  // non-admin ACTIVE PROFILE, even though the underlying authenticated account (the parent
  // who is still signed in -- the switch above only changed attribution, never authority)
  // really is an admin. /settings/household already rendered read-only above; the same
  // isAdminProfile() display check (lib/auth/permissions.ts) must also apply one level up, on
  // the Family pane (the new home for what /settings/members used to gate) and on /family, or
  // a child is handed a full control panel and only told "no" after tapping into it. What
  // every non-admin profile keeps: Appearance (nobody's admin-gated), the section nav itself
  // (none of its six links are admin-gated -- see components/settings/settings-nav.tsx), and
  // their own "Your PIN" self-service control (set_member_pin allows anyone to set their own).
  await page.goto("/settings");
  await expect(page.getByRole("link", { name: "Appearance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your PIN" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Invite member" })).not.toBeVisible();
  await expect(page.getByRole("link", { name: "Manage household name & features" })).not.toBeVisible();
  await expect(page.getByText(/switch to an adult’s profile/i)).toBeVisible();

  // Scoped to #main-content: childName ALSO now matches in the sidebar (which shows the
  // active profile's own name once switched -- "Kit Child" -- rather than the "Switch
  // profile" fallback), so an unscoped locator would resolve to two elements.
  await page.goto("/family");
  await expect(mainContent.getByText(childName, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a family member" })).not.toBeVisible();

  // --- Removing the LINK is not the same as gating the PAGE. The old /settings/members route
  // checked only the authenticated account's role, so typing the URL while attributed to a
  // child still rendered the invite controls -- and because authority genuinely comes from the
  // account underneath, those controls would have WORKED. That route now redirects straight to
  // the (equally gated) Family pane; this proves the redirect target is exactly as guarded as
  // the destination above, not a second, differently-gated surface. ---
  await page.goto("/settings/members");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("button", { name: "+ Invite member" })).not.toBeVisible();
  await expect(page.getByText(/switch to an adult’s profile/i)).toBeVisible();
});

test("the Family pane lists members with a role and an edit link, the empty sections are honest, and the ambient-motion toggle is a real preference", async ({
  page,
}) => {
  const householdName = unique("The Roster Settings Family");
  const ownerName = "Roster Owner";

  await onboardHousehold(page, { ownerName, householdName });
  const mainContent = page.locator("#main-content");

  // --- The Family pane (mock 4h) is the default /settings section: household name, a member
  // row per active member (avatar, a caption, a role pill, and an Edit link to the full
  // profile), and the admin-only "+ Invite member" affordance. ---
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: householdName, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Invite member" })).toBeVisible();

  const ownerRow = mainContent.locator("li", { hasText: ownerName });
  await expect(ownerRow).toBeVisible();
  await expect(ownerRow.getByRole("link", { name: "Edit" })).toHaveAttribute("href", /\/family\/.+/);

  // --- Calendars, Notifications, and Data & export have nothing real behind them yet -- an
  // honest empty state (a heading and one line), never a fake "Connected" status or a button
  // that would do nothing when pressed. ---
  for (const [href, heading] of [
    ["/settings/calendars", "Calendars"],
    ["/settings/notifications", "Notifications"],
    ["/settings/data-export", "Data & export"],
  ] as const) {
    await page.goto(href);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    // Honest, not a fake "it's connected" status like mock 4h's illustrative
    // "Google Calendar · Connected ✓" row -- the copy is allowed to use the word
    // "connect(ed)" to say truthfully that nothing is hooked up yet (see this section's own
    // page.tsx), just never claim a working connection that doesn't exist.
    await expect(mainContent.getByText("✓")).not.toBeVisible();
    await expect(mainContent.getByRole("button")).not.toBeVisible();
  }

  // --- Wall display is a real, working launcher, not a placeholder. ---
  await page.goto("/settings/wall-display");
  await page.getByRole("link", { name: "Open wall display" }).click();
  await expect(page).toHaveURL(/\/wall$/);

  // --- The "Ambient animations" toggle is a REAL preference: flipping it off sets a real,
  // durable signal (`<html data-ambient-motion="off">`) other code can (and, within this
  // task's own surfaces, does) read to actually stop ambient motion -- not a control that
  // looks like it works and changes nothing (see app/(app)/settings/appearance/page.tsx's doc
  // comment on the household accent-color picker this project already shipped once that way). ---
  await page.goto("/settings/appearance");
  const html = page.locator("html");
  const toggle = page.getByRole("switch", { name: "Ambient animations" });
  await expect(toggle).toBeChecked();

  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect(html).toHaveAttribute("data-ambient-motion", "off");

  // --- It survives navigation within the session (the attribute lives on <html>, which
  // persists across client-side route changes) and a reload (the choice is persisted in
  // localStorage, read again on the next mount). ---
  await page.goto("/family");
  await expect(html).toHaveAttribute("data-ambient-motion", "off");
  await page.goto("/settings/appearance");
  await expect(page.getByRole("switch", { name: "Ambient animations" })).not.toBeChecked();

  await page.reload();
  await expect(page.getByRole("switch", { name: "Ambient animations" })).not.toBeChecked();

  await page.getByRole("switch", { name: "Ambient animations" }).click();
  await expect(page.getByRole("switch", { name: "Ambient animations" })).toBeChecked();
  await expect(html).toHaveAttribute("data-ambient-motion", "on");
});
