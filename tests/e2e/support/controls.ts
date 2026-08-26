import type { Locator, Page } from "@playwright/test";

/**
 * Shared driver for the app's own Select (`components/ui/select.tsx`) — a Radix combobox, not a
 * native `<select>`, so `locator.selectOption()` does not apply to it: that method only drives a
 * real `HTMLSelectElement`, and the visible control is a `<button role="combobox">`.
 *
 * This lives in a shared module rather than being copied per spec file, which is a deliberate
 * break from this suite's earlier "every spec keeps its own helpers" convention. That
 * convention is what let the swap from native `<select>` to Radix break 36 tests across four
 * spec files at once: the two files whose owners knew about the change grew a local `chooseRole`
 * helper, and the four that did not kept calling `selectOption()` and failed. A control every
 * spec drives should have exactly one driver.
 *
 * `scope` narrows only the TRIGGER lookup — for a picker inside a dialog, where the same label
 * may also exist behind it. The option list is always looked up on the page, never inside
 * `scope`: Radix portals `SelectContent` to `document.body`, so the listbox is a sibling of the
 * dialog rather than a descendant of it, and scoping the option lookup finds nothing.
 */
export async function chooseOption(
  page: Page,
  label: string,
  optionText: string,
  scope?: Locator,
): Promise<void> {
  await (scope ?? page).getByLabel(label).click();
  await page.getByRole("option", { name: optionText, exact: true }).click();
}

/**
 * Picks a role in a "Role" combobox. `ROLE_LABELS` (lib/constants/roles.ts) capitalises the raw
 * enum value, so the stored `"child"` is displayed as `"Child"` — callers pass the enum value
 * they already have and this maps it, so a test never hard-codes the display casing.
 */
export async function chooseRole(page: Page, role: string, scope?: Locator): Promise<void> {
  await chooseOption(page, "Role", role.charAt(0).toUpperCase() + role.slice(1), scope);
}
