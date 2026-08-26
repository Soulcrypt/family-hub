"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { saveLocationAction, type ActionState } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";

const INITIAL: ActionState = { error: null };

/**
 * Step 3/5 (mock 4d). The mock also shows a "Connected ✓" Google Calendar row and a
 * paste-a-webcal-link HEY row — left out on purpose. Google's OAuth app isn't configured in
 * this project (a later, blocked task) and there's no ICS-fetching backend at all for HEY;
 * both would be controls that look wired and do nothing, which this task's brief calls out as
 * worse than not having them. What's left is the one thing this step can do for real: collect
 * a home location for the weather/news widgets to use later.
 */
export function StepLocation({ initialLabel }: { initialLabel: string }) {
  const [state, formAction, pending] = useActionState(saveLocationAction, INITIAL);
  const router = useRouter();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && state.error === null) {
      router.push("/onboarding?step=features");
    }
    wasPending.current = pending;
  }, [pending, state, router]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-4 px-6 py-8">
      <Link
        href="/onboarding?step=members"
        className="-ml-2 inline-flex min-h-[44px] w-fit items-center gap-1 rounded-[12px] px-2 text-sm font-medium text-text-secondary transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ChevronLeft size={18} aria-hidden />
        Back
      </Link>

      <OnboardingProgress step={3} />

      <div>
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-text">Bring your calendars</h1>
        <p className="mt-1.5 text-sm text-text-secondary">Everything lands in one family view.</p>
      </div>

      <p className="dashed rounded-card px-4 py-3.5 text-sm text-text-secondary">
        Google Calendar and HEY connections are coming soon — for now, just set your home location.
      </p>

      <form action={formAction} className="flex flex-1 flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="label">Home location — for weather &amp; local news</Label>
          <Input id="label" name="label" autoComplete="off" maxLength={100} placeholder="City, state" defaultValue={initialLabel} />
        </div>

        {state.error ? (
          <p role="alert" className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger-text">
            {state.error}
          </p>
        ) : null}

        <div className="mt-auto flex flex-col gap-2.5">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Continue"}
          </Button>
          <Link
            href="/onboarding?step=features"
            className="flex min-h-[44px] items-center justify-center text-[13px] font-semibold text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Skip for now
          </Link>
        </div>
      </form>
    </main>
  );
}
