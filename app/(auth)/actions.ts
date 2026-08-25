"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema } from "@/lib/validation/schemas";

export type AuthState = { error: string | null };

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
  const parsed = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.displayName } },
  });
  if (error) return { error: mapSignUpError(error) };

  redirect("/onboarding");
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details" };
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Invalid email or password — check your details and try again." };

  redirect("/");
}
