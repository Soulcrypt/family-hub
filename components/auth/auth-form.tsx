"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";

const INITIAL: AuthState = { error: null, email: null, displayName: null };

type Mode = "signIn" | "signUp";

function authHref(mode: Mode, next: string | undefined): string {
  const base = mode === "signIn" ? "/login" : "/signup";
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}

/**
 * Mock 4b. One screen, two modes — the mock's segmented control switches between them without
 * ever describing two separate forms. `/login` and `/signup` stay separate routes (every other
 * spec in this suite, and their shared field labels/button names, depend on `page.goto("/signup")`
 * landing on a page with a "Your name" field and a "Create account" button, `/login` on one
 * without it — see this task's brief), so the segment click is a real navigation between them,
 * not a client-only view swap. Both `useActionState` hooks are always called (never
 * conditionally, per the rules of hooks) — only the one matching `mode` is ever wired to the
 * rendered `<form>`.
 *
 * OAuth ("Continue with Apple" / "Continue with Google") and "Forgot password?" are in the
 * mock but deliberately not built here — see this task's report for why: neither Apple nor a
 * configured Google provider exists in this project yet, and a password-reset link with no
 * landing page to receive it is the same "looks real, does nothing" failure mode as a dead
 * OAuth button.
 */
export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const router = useRouter();
  const signInState = useActionState(signIn, INITIAL);
  const signUpState = useActionState(signUp, INITIAL);
  const [state, formAction, pending] = mode === "signIn" ? signInState : signUpState;

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Echoes the visitor's own last submission back into the fields after a failed action —
  // see AuthState's doc comment (app/(auth)/actions.ts) for why this exists. Controlled state
  // synced from the action's result, rather than a plain `defaultValue`, because this form
  // never unmounts between submissions (defaultValue only applies on initial mount) — a
  // resubmission needs the field's *current* value replaced, which only a controlled input
  // driven by the latest state does reliably.
  //
  // Adjusted directly during render (React's "adjusting state when a value changes" pattern,
  // guarded so it fires at most once per distinct value) rather than in a useEffect — an
  // Effect here would commit the stale value for one frame and then cascade a second render to
  // fix it, which is exactly what react-hooks/set-state-in-effect flags.
  const [lastEchoedEmail, setLastEchoedEmail] = useState<string | null>(null);
  if (state.email !== null && state.email !== lastEchoedEmail) {
    setLastEchoedEmail(state.email);
    setEmail(state.email);
  }
  const [lastEchoedDisplayName, setLastEchoedDisplayName] = useState<string | null>(null);
  if (state.displayName !== null && state.displayName !== lastEchoedDisplayName) {
    setLastEchoedDisplayName(state.displayName);
    setDisplayName(state.displayName);
  }

  const heading = mode === "signIn" ? "Welcome back" : "Create your account";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-5 px-6 py-10">
      <h1 className="text-[26px] font-bold tracking-[-0.02em] text-text">{heading}</h1>

      <SegmentedControl
        name="authMode"
        ariaLabel="Sign in or create an account"
        value={mode}
        onChange={(next_) => router.push(authHref(next_, next))}
        options={[
          { value: "signIn", label: "Sign in" },
          { value: "signUp", label: "Create account" },
        ]}
        className="self-start"
      />

      <form action={formAction} className="flex flex-col gap-5">
        {next ? <input type="hidden" name="next" value={next} /> : null}

        {mode === "signUp" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="displayName">Your name</Label>
            <Input
              id="displayName"
              name="displayName"
              autoComplete="name"
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="min-h-[24px] rounded-[8px] text-xs font-semibold text-text-secondary hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "signIn" ? "current-password" : "new-password"}
            required
            minLength={mode === "signUp" ? 8 : undefined}
          />
        </div>

        {state.error ? (
          <p role="alert" className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger-text">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? (mode === "signIn" ? "Signing in…" : "Creating account…") : mode === "signIn" ? "Sign in" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        {mode === "signIn" ? "Don't have an account? " : "Already have an account? "}
        <Link
          href={authHref(mode === "signIn" ? "signUp" : "signIn", next)}
          className="-my-3 inline-block py-3 font-semibold text-accent-text"
        >
          {mode === "signIn" ? "Create one" : "Sign in"}
        </Link>
      </p>
    </main>
  );
}
