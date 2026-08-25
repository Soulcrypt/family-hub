"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type AuthState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: AuthState = { error: null };

/**
 * The signup form itself, split out of app/(auth)/signup/page.tsx (Task 14) so that file can
 * be a Server Component that reads the `next` search param (Next.js only exposes `searchParams`
 * as a page prop on Server Components -- see use-search-params.md) and hands it down here as a
 * plain string, rather than this Client Component trying to read it itself.
 *
 * `next` carries an invite claim link (`/invite/[token]`) through signup so a brand-new account
 * lands back on the SAME invite instead of `/onboarding` -- re-validated server-side in
 * `signUp()` (app/(auth)/actions.ts's `safeNextPath`) before it is ever used as a redirect
 * target, so a tampered hidden field here can only ever be ignored, never followed anywhere
 * unexpected.
 */
export function SignUpForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signUp, INITIAL);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6">
      <div>
        <h1 className="text-3xl">Create your account</h1>
        <p className="mt-2 text-muted-foreground">One home for your family’s meals, plans, and days.</p>
      </div>

      <form action={action} className="flex flex-col gap-5">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="displayName">Your name</Label>
          <Input id="displayName" name="displayName" autoComplete="name" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" spellCheck={false} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </div>

        {state.error ? (
          <p role="alert" className="rounded-[12px] bg-destructive-bg px-4 py-3 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="-my-3 inline-block py-3 text-accent-strong underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </main>
  );
}
