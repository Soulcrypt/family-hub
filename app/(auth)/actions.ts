"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema } from "@/lib/validation/schemas";

/**
 * `email` (and `displayName` for sign-up) echo the value the visitor actually typed back into
 * the form on failure. Design task fix: submitting bad credentials used to wipe both fields —
 * a punishing retype on a wall tablet's on-screen keyboard for what's often a one-character
 * typo. Password is deliberately NOT echoed back (never re-populate a password field after a
 * failed submit) — only the fields that are annoying, not sensitive, to retype.
 */
export type AuthState = { error: string | null; email: string | null; displayName: string | null };

/**
 * `next` lets `/invite/[token]` (Task 14) send a signed-out visitor to `/signup?next=/invite/<token>`
 * (or `/login?next=...`) and land them back on the SAME invite after auth, instead of always at
 * `/onboarding` / `/`. A bare, unvalidated `next` query param would otherwise be a classic
 * open-redirect vector (`next=https://evil.example` or even `next=//evil.example`) -- this
 * allowlists the one legitimate shape (an invite claim path, matching the exact token alphabet
 * `randomBytes(24).toString("base64url")` produces) rather than trying to sanitize an
 * arbitrary URL.
 */
function safeNextPath(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  return /^\/invite\/[A-Za-z0-9_-]+$/.test(value) ? value : null;
}

/**
 * Maps a `signUp()` failure to user-facing copy. Never passes Supabase's own `error.message`
 * through: those strings are written for a developer console, not this app's users, and can
 * actively contradict its own rules (GoTrue's weak-password message cites its OWN minimum,
 * which is looser than `signUpSchema`'s 8 characters — already enforced above this call).
 *
 * The one case worth naming specifically is "this email is already registered" — telling a
 * genuine user to sign in instead is real UX value, and the account-enumeration exposure that
 * comes with naming it is an acceptable, deliberate tradeoff at this product's scale (a family
 * app, not a target for enumeration attacks). `signIn()` below is the opposite call: there,
 * genericizing everything (including "no such account") is correct, because a login form is
 * exactly where enumeration costs the most. Every other code — rate limits, provider outages,
 * anything unrecognized — falls through to one generic message; an unrecognized code must
 * land in that generic branch, not be mistaken for the specific one.
 */
function mapSignUpError(error: AuthError): string {
  switch (error.code) {
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists — sign in instead.";
    default:
      return "We couldn't create your account. Please try again.";
  }
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  // Raw, unvalidated echo values -- read straight off the submitted FormData so a failed
  // submission (bad schema OR a rejected signUp() call below) can hand the visitor's own name
  // and email straight back, not just re-derive them from `parsed.data` (which doesn't exist
  // yet on the schema-failure branch).
  const rawEmail = typeof formData.get("email") === "string" ? (formData.get("email") as string) : null;
  const rawDisplayName = typeof formData.get("displayName") === "string" ? (formData.get("displayName") as string) : null;

  const parsed = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details", email: rawEmail, displayName: rawDisplayName };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.displayName } },
  });
  if (error) return { error: mapSignUpError(error), email: parsed.data.email, displayName: parsed.data.displayName };

  redirect(safeNextPath(formData.get("next")) ?? "/onboarding");
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  // See signUp()'s identical comment: the raw, unvalidated email is what gets echoed back on
  // any failure branch, so a bad-password resubmit doesn't also make the visitor retype an
  // email address they typed correctly the first time.
  const rawEmail = typeof formData.get("email") === "string" ? (formData.get("email") as string) : null;

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details", email: rawEmail, displayName: null };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      error: "Invalid email or password — check your details and try again.",
      email: parsed.data.email,
      displayName: null,
    };
  }

  redirect(safeNextPath(formData.get("next")) ?? "/");
}
