import { execFile } from "node:child_process";
import { expect, test } from "@playwright/test";

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
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

// See tests/e2e/switcher.spec.ts's identical helper for the full rationale: this shells out to
// the local Supabase CLI's Postgres directly (as the `postgres` superuser, bypassing RLS
// entirely), exactly the way this project's pgTAP suites (supabase/tests/*.sql) seed fixtures.
const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const DB_URL = process.env.SUPABASE_DB_URL ?? LOCAL_DB_URL;

function psql(sql: string, vars: Record<string, string> = {}): Promise<string> {
  const args = [DB_URL, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-F,"];
  for (const [name, value] of Object.entries(vars)) args.push("-v", `${name}=${value}`);
  return new Promise((resolve, reject) => {
    const child = execFile("psql", args, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
    child.stdin?.end(sql);
  });
}

type MemberFixture = { id: string; role: string; display_name: string };

/** Looks up every `household_members` row for a household by its (unique-per-test) name. */
async function membersOf(householdName: string): Promise<MemberFixture[]> {
  const stdout = await psql(
    "select m.id, m.role, m.display_name from household_members m join households h on h.id = m.household_id where h.name = :'household_name'",
    { household_name: householdName },
  );
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, role, display_name] = line.split(",");
      if (!id || !role || !display_name) throw new Error(`unexpected psql row: ${line}`);
      return { id, role, display_name };
    });
}

async function householdIdOf(householdName: string): Promise<string> {
  const stdout = await psql("select id from households where name = :'name'", { name: householdName });
  const id = stdout.trim();
  if (!id) throw new Error(`no household found named ${householdName}`);
  return id;
}

/** Looks up the (single) `household_members` row attached to an authenticated user's own email. */
async function memberRowForEmail(email: string): Promise<{ id: string; household_id: string }> {
  const stdout = await psql(
    "select m.id, m.household_id from household_members m join auth.users u on u.id = m.user_id where u.email = :'email'",
    { email },
  );
  const [id, household_id] = stdout.trim().split(",");
  if (!id || !household_id) throw new Error(`no member row found for ${email}`);
  return { id, household_id };
}

type OnboardMember = { name: string; role: string; birthday?: string };

/**
 * Drives the full signup -> household -> members -> features -> ready flow (mirroring
 * tests/e2e/onboarding.spec.ts and switcher.spec.ts) and lands on /dashboard, which 404s until
 * Task 16 -- only ever asserted by URL here, never by content, matching every other spec in
 * this suite.
 */
async function onboardHousehold(
  page: import("@playwright/test").Page,
  options: { ownerName: string; householdName: string; members?: OnboardMember[]; features?: string[] },
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
    if (member.birthday) await page.getByLabel("Birthday").fill(member.birthday);
    await page.getByRole("button", { name: "Add member" }).click();
    await expect(page.getByText(member.name, { exact: true })).toBeVisible();
  }

  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=features/);

  for (const key of options.features ?? []) {
    await page.locator(`#feature-${key}`).check();
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=ready/);
  await page.getByRole("button", { name: /go to my dashboard/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("a parent can view, edit, and deactivate family members", async ({ page }) => {
  const householdName = unique("The Roster Family");
  const ownerName = "Dana Owner";
  const childName = "Ivy";
  const extraName = "Old Roommate";

  await onboardHousehold(page, {
    ownerName,
    householdName,
    members: [{ name: childName, role: "child", birthday: "2015-03-03" }],
  });

  // --- Every active member appears on the grid. ---
  // Scoped to #main-content (the layout's <main>, app/(app)/layout.tsx) rather than the bare
  // page: the sidebar independently shows the CURRENTLY ACTIVE member's name too (Dana is
  // auto-attributed right after onboarding -- see app/onboarding/actions.ts), and on wide
  // viewports both it and the grid card render "Dana Owner" as plain text at the same time,
  // which a page-wide getByText can't disambiguate (a strict-mode violation, confirmed while
  // running this suite). The sidebar is chrome, not something this test is asserting on.
  await page.goto("/family");
  const mainContent = page.locator("#main-content");
  await expect(page.getByRole("heading", { name: "Family", exact: true })).toBeVisible();
  await expect(mainContent.getByText(ownerName, { exact: true })).toBeVisible();
  await expect(mainContent.getByText(childName, { exact: true })).toBeVisible();

  const members = await membersOf(householdName);
  const childRow = members.find((m) => m.display_name === childName);
  if (!childRow) throw new Error("expected the child fixture to exist");

  // --- Opening a member (as an admin) shows name, role, and birthday -- as real field values,
  // since an admin gets the fully editable form regardless of whose page it is. ---
  await page.goto(`/family/${childRow.id}`);
  await expect(page.getByRole("heading", { name: childName, exact: true })).toBeVisible();
  await expect(page.locator('select[name="role"]')).toHaveValue("child");
  await expect(page.getByLabel("Birthday")).toHaveValue("2015-03-03");

  // --- Editing the name persists after reload. ---
  await page.getByLabel("Name").fill("Ivy Renamed");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { name: "Ivy Renamed", exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Name")).toHaveValue("Ivy Renamed");

  await page.goto("/family");
  await expect(mainContent.getByText("Ivy Renamed", { exact: true })).toBeVisible();

  // --- A member can be deactivated and disappears from the grid. ---
  await page.getByRole("button", { name: "Add a family member" }).click();
  await page.getByLabel("Name").fill(extraName);
  await chooseRole(page, "child");
  await page.getByRole("button", { name: "Add member" }).click();
  await expect(mainContent.getByText(extraName, { exact: true })).toBeVisible();

  await mainContent.getByText(extraName, { exact: true }).click();
  await expect(page).toHaveURL(/\/family\/.+/);
  await page.getByRole("button", { name: "Remove from household" }).click();

  const confirmDialog = page.getByRole("dialog");
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: "Remove", exact: true }).click();

  await expect(page).toHaveURL(/\/family$/);
  await expect(mainContent.getByText(extraName, { exact: true })).not.toBeVisible();
});

test("a non-admin sees no edit controls on another member's profile", async ({ page }) => {
  const householdName = unique("The Guarded Family");
  const ownerName = "Robin Owner";

  await onboardHousehold(page, { ownerName, householdName });

  const members = await membersOf(householdName);
  const ownerRow = members.find((m) => m.role === "owner");
  if (!ownerRow) throw new Error("expected an owner fixture to exist");

  // A second, GENUINELY authenticated non-admin account -- not merely the switcher's
  // attribution cookie, which never changes the authenticated account's own authority (see
  // lib/auth/active-member.ts's module doc comment). Onboarding only ever creates login-less
  // members and there is no invite flow yet (Task 14), so a real second account is created via
  // its own signup, then reassigned into Robin's household directly via SQL -- the only way to
  // exercise the AUTHORITY boundary (not just attribution) end-to-end today.
  const camEmail = `${unique("cam")}@test.local`;
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Cam Child");
  await page.getByLabel("Email").fill(camEmail);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("Household name").fill(unique("Cam Solo House"));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=members/);

  const camMember = await memberRowForEmail(camEmail);
  const robinHouseholdId = await householdIdOf(householdName);
  await psql("update household_members set household_id = :'household_id', role = 'child' where id = :'member_id'", {
    household_id: robinHouseholdId,
    member_id: camMember.id,
  });

  // Cam's session is still live (no sign-out/sign-in needed) -- every authority check
  // re-resolves her role fresh from the database on each request, so the reassignment above
  // takes effect immediately.
  await page.goto(`/family/${ownerRow.id}`);
  await expect(page.getByRole("heading", { name: ownerName, exact: true })).toBeVisible();

  // Read-only facts are shown...
  await expect(page.getByText("Owner", { exact: true })).toBeVisible();
  // ...but no edit surface of any kind.
  await expect(page.getByLabel("Name")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Remove from household" })).not.toBeVisible();
  await expect(page.getByLabel("New pin")).not.toBeVisible();
});

test("the app shell shows the sidebar on wide viewports and the bottom navigation on phone, marking the active item", async ({
  page,
}, testInfo) => {
  const householdName = unique("The Shell Family");
  await onboardHousehold(page, { ownerName: "Sasha Owner", householdName });

  await page.goto("/family");

  const sidebar = page.locator("aside");
  // The bottom nav's own top-level element is the only <nav> carrying Tailwind's literal
  // `fixed` utility class on this page -- the sidebar's internal <nav aria-label="Main"> does
  // not, so this selector cannot accidentally match it.
  const bottomNav = page.locator("nav.fixed");

  if (testInfo.project.name === "phone") {
    await expect(sidebar).not.toBeVisible();
    await expect(bottomNav).toBeVisible();
  } else {
    await expect(sidebar).toBeVisible();
    await expect(bottomNav).not.toBeVisible();
  }

  // Whichever copy of the nav is actually on screen marks Family as current -- `display:none`
  // removes the OTHER copy from the accessibility tree entirely, so exactly one match is
  // expected regardless of viewport.
  const familyLink = page.getByRole("link", { name: "Family", exact: true });
  await expect(familyLink).toHaveCount(1);
  await expect(familyLink).toHaveAttribute("aria-current", "page");
});

test("the bottom navigation's overflow disclosure opens, traps focus, and navigates", async ({ page }, testInfo) => {
  // Currently unreachable in the real app: this task's fix gates every nav link on
  // `hasScreen` (lib/constants/features.ts, components/shell/nav-items.ts), and today only
  // Home, Family and Settings have one -- 3 items, nowhere near bottom-nav.tsx's MAX_VISIBLE
  // (5). Before the fix, enabling all 4 optional features produced 7 (fake) nav items and
  // forced this overflow to appear; now no real household configuration can, until SP2+ ships
  // a screen for an optional feature. The slicing logic itself (splitBottomNavItems) stays
  // covered directly with synthetic data in lib/__tests__/bottom-nav-reachability.test.ts, so
  // this UI-interaction test is skipped rather than deleted or faked -- re-enable it (with a
  // features list drawn from whatever ships a real screen first) once that stops being true.
  test.skip(true, "no optional feature has a screen yet, so the bottom nav can never overflow for a real household");

  test.skip(testInfo.project.name !== "phone", 'the "More" overflow disclosure only exists in the phone bottom nav');

  const householdName = unique("The Overflow Family");
  // 7 total nav items (Home + all 4 optional features + the always-on Family/Settings)
  // exceeds bottom-nav.tsx's MAX_VISIBLE (5) -- see splitBottomNavItems -- so Family and
  // Settings land behind "More".
  await onboardHousehold(page, {
    ownerName: "Taylor Owner",
    householdName,
    features: ["calendar", "meals", "chores", "habits"],
  });

  await page.goto("/family");

  const moreButton = page.getByRole("button", { name: "More" });
  await expect(moreButton).toBeVisible();
  // Confirms the overflow actually happened -- Family is NOT one of the directly visible tabs.
  await expect(page.getByRole("link", { name: "Family", exact: true })).toHaveCount(0);

  await moreButton.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const startsInsideDialog = await page.evaluate(
    () => document.activeElement?.closest('[role="dialog"]') !== null,
  );
  expect(startsInsideDialog).toBe(true);

  // Focus trap: tabbing all the way around the dialog's focusable elements (plus a few extra
  // presses) must never let focus escape onto the page behind it.
  const focusableCount = await dialog.locator("a, button").count();
  for (let i = 0; i < focusableCount + 3; i++) {
    await page.keyboard.press("Tab");
  }
  const stillInsideDialog = await page.evaluate(
    () => document.activeElement?.closest('[role="dialog"]') !== null,
  );
  expect(stillInsideDialog).toBe(true);

  // Navigates: Settings is one of the overflowed items (never Family, since we're already on
  // it) -- clicking it inside the dialog both closes the dialog and changes the route. /settings
  // doesn't exist until Task 15 and 404s today, so only the URL is asserted, matching every
  // other not-yet-built route in this suite.
  await dialog.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/settings/);
  await expect(dialog).not.toBeVisible();
});

/**
 * Regression coverage for the shipping bug this task fixes: a household that enables every
 * optional feature in onboarding got a sidebar/bottom-nav link straight to a 404, because
 * lib/constants/features.ts listed calendar/meals/chores/habits as choosable long before any
 * of SP2-SP5 built a screen for them, and navItemsFor() (components/shell/nav-items.ts) gated
 * links purely on the enabled flag, not on whether a screen exists to receive them.
 *
 * A test that hardcodes `/calendar` only catches THIS feature going stale -- the same bug
 * reappears the day `/meals` is enabled by a real household. So this test doesn't hardcode a
 * route at all: it reads the actual `href`s the rendered navigation offers (every optional
 * feature turned on, so nothing is gated out for lack of being enabled) and visits each one,
 * asserting none 404s. That is the real invariant -- the navigation must never advertise a
 * link that doesn't resolve -- and it stays valid regardless of which feature ships next.
 *
 * Enumeration source depends on viewport, matching how the two nav surfaces actually render
 * (see the "shows the sidebar on wide viewports..." test above): the bottom nav's own visible
 * tabs plus whatever "More" discloses on phone, and the sidebar's full, never-overflowed list
 * everywhere else (sidebar.tsx has no MAX_VISIBLE slicing -- see bottom-nav.tsx's
 * splitBottomNavItems() doc comment for why only the bottom nav needs one).
 *
 * Trustworthiness: this asserts the enumerated list is non-empty before checking anything
 * else. Home is unconditionally in navItemsFor()'s output (see nav-items.ts), so a correctly
 * working enumeration can never come back empty -- if it does, the LOCATOR is broken, not the
 * app, and a bare "every href resolved" loop over zero hrefs would otherwise pass vacuously.
 */
test("the navigation never offers a link that doesn't resolve, for a household with every feature enabled", async ({
  page,
}, testInfo) => {
  const householdName = unique("The Fully Featured Family");

  await onboardHousehold(page, {
    ownerName: "Riley Owner",
    householdName,
    features: ["calendar", "meals", "chores", "habits"],
  });

  await page.goto("/dashboard");

  async function hrefsFromLocator(locator: import("@playwright/test").Locator): Promise<string[]> {
    const raw = await locator.evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    return raw.filter((href): href is string => typeof href === "string" && href.length > 0);
  }

  let hrefs: string[];
  if (testInfo.project.name === "phone") {
    const bottomNav = page.locator("nav.fixed");
    const visible = await hrefsFromLocator(bottomNav.locator("a[href]"));

    const moreButton = page.getByRole("button", { name: "More" });
    let overflow: string[] = [];
    if (await moreButton.isVisible()) {
      await moreButton.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      overflow = await hrefsFromLocator(dialog.locator("a[href]"));
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
    }
    hrefs = [...visible, ...overflow];
  } else {
    const sidebarNav = page.locator("aside nav[aria-label='Main']");
    hrefs = await hrefsFromLocator(sidebarNav.locator("a[href]"));
  }

  expect(hrefs.length, "the navigation enumeration must find at least one link (Home)").toBeGreaterThan(0);

  for (const href of hrefs) {
    const response = await page.goto(href);
    // `toBeLessThan(400)` rather than `not.toBe(404)`: the invariant is that the link
    // RESOLVES, and a 500 fails that just as completely as a 404 does. `page.goto` follows
    // redirects, so this is the final status, not an intermediate 307.
    expect(
      response?.status(),
      `navigating to ${href} (linked from the primary navigation)`,
    ).toBeLessThan(400);
  }
});
