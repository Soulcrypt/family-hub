import { execFile } from "node:child_process";
import { expect, test } from "@playwright/test";

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

// See tests/e2e/switcher.spec.ts's identical helper for the full rationale: this shells out to
// the local Supabase CLI's Postgres directly (as the `postgres` superuser, bypassing RLS
// entirely), exactly the way this project's pgTAP suites (supabase/tests/*.sql) seed and query
// fixtures, and exactly the way family.spec.ts/switcher.spec.ts already reach state this app
// has no UI for yet (here: setting a points balance -- there is no chores/points UI until a
// later task).
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

async function memberIdFor(householdName: string, displayName: string): Promise<string> {
  const stdout = await psql(
    "select m.id from household_members m join households h on h.id = m.household_id where h.name = :'household_name' and m.display_name = :'display_name'",
    { household_name: householdName, display_name: displayName },
  );
  const id = stdout.trim();
  if (!id) throw new Error(`no member found named ${displayName} in ${householdName}`);
  return id;
}

async function setPointsBalance(memberId: string, points: number): Promise<void> {
  await psql("update household_members set points_balance = :points where id = :'member_id'", {
    points: String(points),
    member_id: memberId,
  });
}

type ClaimedRow = { id: string; role: string; display_name: string; points_balance: string };

/** The row attached to a freshly-claimed account, looked up by the account's own email. */
async function claimedRowForEmail(email: string): Promise<ClaimedRow> {
  const stdout = await psql(
    "select m.id, m.role, m.display_name, m.points_balance from household_members m join auth.users u on u.id = m.user_id where u.email = :'email'",
    { email },
  );
  const [id, role, display_name, points_balance] = stdout.trim().split(",");
  if (!id || !role || !display_name || !points_balance) throw new Error(`no claimed row found for ${email}`);
  return { id, role, display_name, points_balance };
}

/**
 * This is the product's single most distinctive feature, end to end: a login-less member who
 * already has history (here, a points balance) gains a real login WITHOUT losing any of it --
 * same `household_members` row, same id, same points, just a `user_id` attached and a fresh
 * role. Every assertion below checks that directly against the database, not just that a page
 * rendered -- /dashboard doesn't exist until Task 16 and 404s today (same convention as every
 * other spec in this suite -- see onboarding.spec.ts's note), so the URL is the only thing
 * asserted about that redirect.
 */
test("a login-less member with a points balance claims their own login via an invite link, keeping their id and points", async ({
  page,
}) => {
  const householdName = unique("The Claim Family");
  const childName = "Ivy";

  // --- Parent onboards a household with a login-less child. ---
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Dana Owner");
  await page.getByLabel("Email").fill(`${unique("dana")}@test.local`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: /welcome to family hub/i })).toBeVisible();
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("Household name").fill(householdName);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=members/);

  await page.getByRole("button", { name: "Add a family member" }).click();
  await page.getByLabel("Name").fill(childName);
  await page.getByLabel("Role").selectOption("child");
  await page.getByRole("button", { name: "Add member" }).click();
  await expect(page.getByText(childName, { exact: true })).toBeVisible();

  // --- Ivy already has a non-zero points balance -- exactly the history this flow must not
  // lose. Set directly (no chores/points UI exists yet), and remember her member id so the
  // claimed row's id can be compared against it later. ---
  const ivyId = await memberIdFor(householdName, childName);
  await setPointsBalance(ivyId, 250);

  // --- Dana creates a claim invitation for Ivy, assigning her the "teen" role once she logs
  // in (deliberately different from her current "child" role, so the role update is also
  // provably applied by the claim, not just carried over). ---
  await page.goto("/settings/members");
  await expect(page.getByRole("heading", { name: "Members", exact: true })).toBeVisible();

  const ivyRow = page.getByRole("listitem").filter({ hasText: childName });
  await ivyRow.getByRole("button", { name: "Invite them to log in" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Role once they log in").selectOption("teen");
  await dialog.getByRole("button", { name: "Create invite link" }).click();

  const linkInput = dialog.getByLabel("Invitation link");
  await expect(linkInput).toBeVisible();
  const inviteLink = await linkInput.inputValue();
  expect(inviteLink).toContain("/invite/");

  // --- Dana signs out; the link must work for a completely signed-out visitor. ---
  await page.request.post("/auth/signout");

  await page.goto(inviteLink);
  await expect(page.getByRole("heading", { name: /you.ve been invited to family hub/i })).toBeVisible();

  // --- The invited person signs up as themselves -- a brand-new account, not Dana's. ---
  const claimantEmail = `${unique("ivy-claim")}@test.local`;
  await page.getByRole("link", { name: "Create your account" }).click();
  await expect(page).toHaveURL(/\/signup/);
  await page.getByLabel("Your name").fill("Ivy Claimant");
  await page.getByLabel("Email").fill(claimantEmail);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();

  // signUp() redirects back to the SAME invite (via the `next` param carried through the
  // signup form), which -- now that this account is authenticated -- calls accept_invite and
  // redirects to /dashboard on success.
  await expect(page).toHaveURL(/\/dashboard/);

  // --- The database proves the payoff: same row, same id, same points, new user_id, new
  // role -- and the display_name Dana originally chose is untouched (accept_invite's claim
  // path never rewrites it). ---
  const claimed = await claimedRowForEmail(claimantEmail);
  expect(claimed.id).toBe(ivyId);
  expect(claimed.points_balance).toBe("250");
  expect(claimed.role).toBe("teen");
  expect(claimed.display_name).toBe(childName);
});

test("an already-used invite link shows a clear error instead of a broken page", async ({ page }) => {
  const householdName = unique("The Reused Invite Family");
  const childName = "Remy";

  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Jamie Owner");
  await page.getByLabel("Email").fill(`${unique("jamie")}@test.local`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("Household name").fill(householdName);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=members/);

  await page.getByRole("button", { name: "Add a family member" }).click();
  await page.getByLabel("Name").fill(childName);
  await page.getByLabel("Role").selectOption("child");
  await page.getByRole("button", { name: "Add member" }).click();
  await expect(page.getByText(childName, { exact: true })).toBeVisible();

  await page.goto("/settings/members");
  const remyRow = page.getByRole("listitem").filter({ hasText: childName });
  await remyRow.getByRole("button", { name: "Invite them to log in" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Create invite link" }).click();
  const inviteLink = await dialog.getByLabel("Invitation link").inputValue();

  // First claimant redeems it successfully.
  await page.request.post("/auth/signout");
  await page.goto(inviteLink);
  await page.getByRole("link", { name: "Create your account" }).click();
  await page.getByLabel("Your name").fill("First Claimant");
  await page.getByLabel("Email").fill(`${unique("first")}@test.local`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // A second, different person tries the SAME link.
  await page.request.post("/auth/signout");
  await page.goto(inviteLink);
  await page.getByRole("link", { name: "Create your account" }).click();
  await page.getByLabel("Your name").fill("Second Claimant");
  await page.getByLabel("Email").fill(`${unique("second")}@test.local`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("alert").filter({ hasText: /already been used/i })).toBeVisible();
  await expect(page).not.toHaveURL(/\/dashboard/);
});

/**
 * The guard added by supabase/migrations/0012_accept_invite_one_household_guard.sql, exercised
 * end to end through the real UI: accept_invite's original "already a member" check was scoped
 * only to the invite's OWN household, so an account that already owns household A could open a
 * completely unrelated household B's claim-invite link (sent to them out of curiosity, by
 * mistake, or in bad faith) and would silently be attached to a STRANGER's login-less child's
 * row in household B -- a real identity takeover of someone else's profile, not merely an
 * unwanted membership. This test proves that link is refused instead, and that the target
 * member row is untouched. (This guard was first attempted at the Next.js page layer and moved
 * into the RPC itself after review -- accept_invite is directly callable via the anon key, so a
 * page-level check alone does not close it. See 0012's migration header and
 * app/invite/[token]/page.tsx's doc comment.)
 */
test("an account that already belongs to a household cannot be attached to a stranger's claim invite for a different household", async ({
  page,
}) => {
  const householdBName = unique("Household B");
  const targetChildName = "Charlie";

  // --- Household B: an owner who creates a claim invite for their own login-less child. ---
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Blair Owner");
  await page.getByLabel("Email").fill(`${unique("blair")}@test.local`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("Household name").fill(householdBName);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=members/);

  await page.getByRole("button", { name: "Add a family member" }).click();
  await page.getByLabel("Name").fill(targetChildName);
  await page.getByLabel("Role").selectOption("child");
  await page.getByRole("button", { name: "Add member" }).click();
  await expect(page.getByText(targetChildName, { exact: true })).toBeVisible();

  await page.goto("/settings/members");
  const charlieRow = page.getByRole("listitem").filter({ hasText: targetChildName });
  await charlieRow.getByRole("button", { name: "Invite them to log in" }).click();
  const blairDialog = page.getByRole("dialog");
  await blairDialog.getByRole("button", { name: "Create invite link" }).click();
  const inviteLink = await blairDialog.getByLabel("Invitation link").inputValue();

  // --- Alex already owns a COMPLETELY UNRELATED household A -- a second, genuinely
  // authenticated account (onboarding always signs the new account straight in), not merely a
  // different attributed profile. ---
  await page.request.post("/auth/signout");
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Alex Owner");
  await page.getByLabel("Email").fill(`${unique("alex")}@test.local`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("Household name").fill(unique("Household A"));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=members/);

  // --- Alex, still signed in as themselves, opens Household B's claim invite link. accept_invite
  // itself rejects this (0012_accept_invite_one_household_guard.sql) -- the page just renders
  // whatever the RPC decided, so this is the same generic error heading every other
  // accept_invite rejection uses. ---
  await page.goto(inviteLink);

  await expect(page.getByRole("heading", { name: /we couldn.t add you/i })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: /already belong to a household/i })).toBeVisible();

  // --- Charlie's row is untouched -- no takeover happened. ---
  const charlie = await memberIdFor(householdBName, targetChildName);
  const stillUnclaimed = await psql("select user_id is null from household_members where id = :'id'", {
    id: charlie,
  });
  expect(stillUnclaimed.trim()).toBe("t");
});
