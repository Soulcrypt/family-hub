"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createHouseholdAction, type ActionState } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";

const INITIAL: ActionState = { error: null };

export function StepHousehold() {
  // No client-side navigation on success: createHouseholdAction redirect()s itself (see its
  // own comment for why) -- this hook only ever needs to surface a validation/RPC error and
  // the pending state.
  const [state, formAction, pending] = useActionState(createHouseholdAction, INITIAL);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-6 px-6 py-8">
      {/* Safe unconditionally: this step only ever renders while no household exists yet (see
          app/onboarding/page.tsx's resumability guard), so /welcome can't itself bounce forward
          the way /onboarding?step=household would once a household exists. */}
      <Link
        href="/welcome"
        className="-ml-2 inline-flex min-h-[44px] w-fit items-center gap-1 rounded-[12px] px-2 text-sm font-medium text-text-secondary transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ChevronLeft size={18} aria-hidden />
        Back
      </Link>

      <OnboardingProgress step={1} />

      <div>
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-text">Create your household</h1>
        <p className="mt-1.5 text-sm text-text-secondary">Give your family a name. You can change this anytime in settings.</p>
      </div>

      <form action={formAction} className="flex flex-1 flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Household name</Label>
          <Input id="name" name="name" autoComplete="off" required maxLength={80} placeholder="The Parkers…" />
        </div>
        {/*
          Uncontrolled and set imperatively via ref, not React state: this needs the
          BROWSER's own IANA zone, but Intl.DateTimeFormat().resolvedOptions().timeZone
          during SSR reflects the server's zone, not the visitor's. Computing it into
          useState during render (or on first client render) would make the client's first
          paint disagree with the server-rendered HTML -- a hydration mismatch. Setting the
          DOM node's value directly after mount, outside React's render output, sidesteps
          that entirely. "UTC" is a safe default if this never runs (e.g. JS disabled) --
          create_household() falls back to it too.
        */}
        <input
          type="hidden"
          name="timezone"
          defaultValue="UTC"
          ref={(node) => {
            if (node) node.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
          }}
        />

        {state.error ? (
          <p role="alert" className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger-text">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending} className="mt-auto">
          {pending ? "Creating…" : "Continue"}
        </Button>
      </form>
    </main>
  );
}
