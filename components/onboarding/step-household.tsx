"use client";

import { useActionState } from "react";
import { createHouseholdAction, type ActionState } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: ActionState = { error: null };

export function StepHousehold() {
  // No client-side navigation on success: createHouseholdAction redirect()s itself (see its
  // own comment for why) -- this hook only ever needs to surface a validation/RPC error and
  // the pending state.
  const [state, formAction, pending] = useActionState(createHouseholdAction, INITIAL);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-8 px-6">
      <div>
        <p className="text-sm text-muted">Step 2 of 4</p>
        <h1 className="text-3xl">Create your household</h1>
        <p className="mt-2 text-muted">Give your family a name. You can change this anytime in Settings.</p>
      </div>

      <form action={formAction} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Household name</Label>
          <Input id="name" name="name" autoComplete="off" required maxLength={80} placeholder="The Parkers" />
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
          <p role="alert" className="rounded-[12px] bg-[#F5DEDA] px-4 py-3 text-sm text-[#9B4A38]">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Creating…" : "Continue"}
        </Button>
      </form>
    </main>
  );
}
