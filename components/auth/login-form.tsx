"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type AuthState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: AuthState = { error: null };

/**
 * See components/auth/signup-form.tsx's identical doc comment: `next` (an invite claim link,
 * `/invite/[token]`) is threaded down from app/(auth)/login/page.tsx's Server Component
 * `searchParams`, and re-validated server-side by `signIn()`'s `safeNextPath` before ever being
 * used as a redirect target.
 */
export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, INITIAL);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6">
      <div>
        <h1 className="text-3xl">Welcome back</h1>
        <p className="mt-2 text-muted-foreground">One home for your family’s meals, plans, and days.</p>
      </div>

      <form action={action} className="flex flex-col gap-5">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" spellCheck={false} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>

        {state.error ? (
          <p role="alert" className="rounded-[12px] bg-destructive-bg px-4 py-3 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don’t have an account?{" "}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="-my-3 inline-block py-3 text-accent-strong underline underline-offset-4"
        >
          Create one
        </Link>
      </p>
    </main>
  );
}
