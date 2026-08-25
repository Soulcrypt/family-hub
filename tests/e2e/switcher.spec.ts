import { execFile } from "node:child_process";
import { expect, test } from "@playwright/test";

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

const PARENT_PIN = "4821";

// The local Supabase CLI's fixed default: `supabase start`/`supabase/config.toml`'s `[db]
// port = 54322`, `postgres`/`postgres` superuser credentials. Overridable via
// SUPABASE_DB_URL for a differently-configured local stack; never a deployed environment.
const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const DB_URL = process.env.SUPABASE_DB_URL ?? LOCAL_DB_URL;

/**
 * Runs one SQL statement against the LOCAL Supabase Postgres instance directly via `psql`, as
 * the `postgres` superuser -- exactly the way this project's pgTAP suites
 * (supabase/tests/*.sql) seed and query fixtures: bypassing the application/API layer (and
 * RLS) entirely, rather than through any Supabase client or key.
 *
 * Why not the service-role key: it deliberately holds NO grants on any of these tables today
 * (see this task's report, "For Task 21" section) -- nothing in the application uses it, and
 * granting it standing DML in the production migration path just to make one local test
 * fixture work would be exactly the kind of privilege creep this project's RLS work has spent
 * several rounds pushing back on elsewhere.
 *
 * This DOES introduce a genuinely new host-tool dependency for this suite: unlike `npx
 * supabase test db`, which runs pgTAP INSIDE the Postgres container itself (no host `psql`
 * involved), this test shells out to a `psql` binary that must be present on whatever machine
 * runs `npm run test:e2e` -- worth knowing before wiring up CI for this project. Every value
 * is passed as a separate `-v` argument (no shell involved, so no injection surface),
 * substituted into the SQL via psql's `:'name'` syntax, which quotes/escapes it as a SQL
 * string literal.
 *
 * `-t -A -F,` (tuples-only, unaligned, comma-separated) makes the stdout of a SELECT trivial
 * to parse; callers that only need side effects (the UPDATE below) ignore the return value.
 *
 * The SQL is piped over stdin rather than passed via `-c`: psql's `:'name'` interpolation
 * (confirmed empirically) is only performed for input it reads as a script -- interactively
 * or from stdin/`-f` -- not for a `-c "..."` command-line argument, which it sends through
 * unexpanded and Postgres then rejects as a bare `:` syntax error.
 */
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

type MemberFixture = { id: string; role: string };

/** Looks up every `household_members` row for a household by its (unique-per-test) name. */
async function membersOf(householdName: string): Promise<MemberFixture[]> {
  const stdout = await psql(
    "select m.id, m.role from household_members m join households h on h.id = m.household_id where h.name = :'household_name'",
    { household_name: householdName },
  );
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, role] = line.split(",");
      if (!id || !role) throw new Error(`unexpected psql row: ${line}`);
      return { id, role };
    });
}

/**
 * Reads the plaintext member id out of the `fh_active_member` cookie. Only the HMAC
 * signature after the last "." is protected -- the id itself is plaintext by design (see
 * lib/auth/active-member.ts's `signMemberId`) -- so this is a legitimate way for a test to
 * observe which member is currently attributed, without needing a rendered dashboard (which
 * doesn't exist until Task 16; see the note on the redirect assertions below).
 */
async function activeMemberId(page: import("@playwright/test").Page): Promise<string | null> {
  const cookie = (await page.context().cookies()).find((c) => c.name === "fh_active_member");
  if (!cookie) return null;
  const dot = cookie.value.lastIndexOf(".");
  return dot > 0 ? cookie.value.slice(0, dot) : null;
}

test("switching profiles changes attribution, gated by PIN for admin profiles other than your own", async ({
  page,
}) => {
  const householdName = unique("The Switchers");
  const ownerName = "Dana Owner";
  const childName = "Ivy";
  const parentName = "Pat Parent";

  // --- Onboard an owner with a PIN-less child and a login-less parent (a SECOND admin
  // profile distinct from the caller's own -- needed to exercise the PIN gate at all, since
  // switching into the caller's OWN row never prompts; see switchToMemberAction's doc
  // comment). ---
  await page.goto("/signup");
  await page.getByLabel("Your name").fill(ownerName);
  await page.getByLabel("Email").fill(`${unique("owner")}@test.local`);
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
  await expect(page.getByText(childName)).toBeVisible();

  await page.getByRole("button", { name: "Add a family member" }).click();
  await page.getByLabel("Name").fill(parentName);
  await page.getByLabel("Role").selectOption("parent");
  await page.getByRole("button", { name: "Add member" }).click();
  await expect(page.getByText(parentName)).toBeVisible();

  // This step's "Continue" is a plain navigation Link, not a form-submit button -- see
  // onboarding.spec.ts's identical note.
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=features/);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/step=ready/);
  await page.getByRole("button", { name: /go to my dashboard/i }).click();
  // /dashboard doesn't exist until Task 16 and 404s today -- same reasoning as
  // tests/e2e/onboarding.spec.ts. Only the URL is asserted, never dashboard content.
  await expect(page).toHaveURL(/\/dashboard/);

  // --- Seed Pat Parent's PIN directly via psql, hashed with pgcrypto (crypt()/gen_salt()) --
  // pin_hash is verified exclusively through verify_member_pin (SECURITY DEFINER,
  // supabase/migrations/0011_member_pin_verification.sql), which also uses pgcrypto, so the
  // stored hash must be a pgcrypto one; a bcryptjs-produced hash is a DIFFERENT bcrypt variant
  // tag ($2b$ vs pgcrypto's $2a$) and silently fails to verify against crypt(). Task 13's
  // setPinAction (a member setting their OWN pin) doesn't exist yet, so this test can't set
  // one through the app -- the point here is to test the switcher's PIN GATE, not the
  // (not-yet-built) PIN-setting flow. ---
  const members = await membersOf(householdName);
  const ownerRow = members.find((m) => m.role === "owner");
  const childRow = members.find((m) => m.role === "child");
  const parentRow = members.find((m) => m.role === "parent");
  if (!ownerRow || !childRow || !parentRow) throw new Error("expected owner, child, and parent member fixtures");

  await psql(
    "update household_members set pin_hash = extensions.crypt(:'pin', extensions.gen_salt('bf', 10)) where id = :'member_id'",
    { pin: PARENT_PIN, member_id: parentRow.id },
  );

  // --- All three members appear on the switcher. ---
  await page.goto("/switch");
  // The heading renders a typographic apostrophe (’, U+2019), not the straight ' this regex
  // used to match against -- fixed as part of this batch's &apos;-to-curly-quote sweep
  // (app/switch/page.tsx). Matching either form keeps this assertion from drifting again.
  await expect(page.getByRole("heading", { name: /who[’']s this/i })).toBeVisible();
  await expect(page.getByText(ownerName, { exact: true })).toBeVisible();
  await expect(page.getByText(childName, { exact: true })).toBeVisible();
  await expect(page.getByText(parentName, { exact: true })).toBeVisible();

  // --- The child's tile (no PIN required) switches attribution immediately. ---
  await page.getByRole("button", { name: childName }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect.poll(() => activeMemberId(page)).toBe(childRow.id);

  // --- Pat Parent's tile (a DIFFERENT admin profile, PIN required) opens a dialog instead of
  // switching directly. ---
  await page.goto("/switch");
  await page.getByRole("button", { name: parentName }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("PIN")).toBeVisible();

  // --- A wrong PIN shows an error and does not switch (attribution stays the child's). ---
  await page.getByLabel("PIN").fill("0000");
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Incorrect PIN" })).toBeVisible();
  await expect(page).toHaveURL(/\/switch/);
  expect(await activeMemberId(page)).toBe(childRow.id);

  // --- The PIN field is cleared (and refocused) after a wrong guess -- maxLength={4}
  // otherwise means a rejected 4-digit guess can never be typed over. ---
  await expect(page.getByLabel("PIN")).toHaveValue("");
  await expect(page.getByLabel("PIN")).toBeFocused();

  // --- Closing the dialog on an error and reopening the SAME tile starts clean: the stale
  // "Incorrect PIN" from the attempt above must not reappear before a new attempt is made.
  // state.error lives on PinDialog, which stays mounted for the switcher's whole lifetime, so
  // this only holds if PinDialog actively resets it on close. ---
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: parentName }).click();
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Incorrect PIN" })).not.toBeVisible();
  await expect(page.getByLabel("PIN")).toHaveValue("");

  // --- The correct PIN switches attribution to Pat Parent. ---
  await page.getByLabel("PIN").fill(PARENT_PIN);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect.poll(() => activeMemberId(page)).toBe(parentRow.id);

  // --- Dana Owner's own tile never prompts for a PIN, even though "owner" otherwise
  // requiresPin() and Dana has never set one -- this is the fix for the lockout Important 2
  // found (onboarding never sets a PIN, so without this every owner would be permanently
  // unable to switch back to themselves after switching away). No dialog should even open. ---
  await page.goto("/switch");
  await page.getByRole("button", { name: ownerName }).click();
  // Checked BEFORE the URL wait, not after: a direct-submit tile navigates on its own, so if
  // a PinDialog had wrongly rendered instead, the URL would never reach /dashboard and this
  // assertion (with its own short auto-retry window) catches that distinctly from a plain
  // navigation timeout.
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect.poll(() => activeMemberId(page)).toBe(ownerRow.id);
});
