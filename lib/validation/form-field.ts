/**
 * Reads a form field as a string, treating "absent" the same as "empty".
 *
 * `FormData.get()` returns `null` for a field that was not submitted at all, and that happens
 * for ordinary reasons — most commonly because the control was **disabled**, and disabled
 * controls are never submitted. Every control on this app's forms carries `disabled={pending}`,
 * so any submission that races the pending state posts nothing.
 *
 * Passing that `null` into a `z.string()` field makes Zod report its own internal message —
 * "Invalid input: expected string, received null" — and the actions surface
 * `parsed.error.issues[0].message` directly, so that developer-facing string lands in front of
 * someone who was just trying to save a birthday. It also hides the real problem behind a
 * message about types.
 *
 * Coercing to "" instead lets each schema's own human-written message do the job it was
 * written for ("Name is required"), and keeps to this codebase's existing rule — see
 * `genericErrorFor` in the family and onboarding actions — that a raw internal error must
 * never reach the UI verbatim.
 *
 * A `File` value (from a file input) is also treated as empty: these schemas only ever expect
 * text, and stringifying a File would produce "[object File]", which would pass a
 * `z.string()` check and then be stored.
 */
export function formField(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string") return "";
  return value;
}
