"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { saveFeaturesAction, type ActionState } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { FEATURES, isFeatureEnabled, type EnabledFeatures } from "@/lib/constants/features";

const INITIAL: ActionState = { error: null };

export function StepFeatures({ enabledFeatures }: { enabledFeatures: EnabledFeatures }) {
  const [state, formAction, pending] = useActionState(saveFeaturesAction, INITIAL);
  const router = useRouter();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && state.error === null) {
      router.push("/onboarding?step=ready");
    }
    wasPending.current = pending;
  }, [pending, state, router]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-8 px-6 py-16">
      <Link
        href="/onboarding?step=members"
        className="-ml-2 inline-flex min-h-[44px] w-fit items-center gap-1 rounded-[12px] px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ChevronLeft size={18} aria-hidden />
        Back
      </Link>

      <div>
        <p className="text-sm text-muted-foreground">Step 4 of 4</p>
        <h1 className="text-3xl">Choose your features</h1>
        <p className="mt-2 text-muted-foreground">
          Turn on what your family will use. You can change these anytime in Settings.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {FEATURES.map((feature) => (
            <li
              key={feature.key}
              className="rounded-[14px] bg-surface shadow-elevation ring-1 ring-[color:var(--color-muted)] has-disabled:opacity-80"
            >
              {/*
                The checkbox and its text share ONE <label> (rather than an input + a
                separately-htmlFor'd label) so the whole row is a >=44px tap target, not just
                the 20px checkbox square -- easier to hit correctly, especially one-handed or
                on a shared kitchen tablet.
              */}
              <label
                htmlFor={`feature-${feature.key}`}
                className="flex min-h-[44px] items-center gap-3 px-4 py-3"
              >
                <input
                  type="checkbox"
                  id={`feature-${feature.key}`}
                  name="features"
                  value={feature.key}
                  defaultChecked={feature.locked || isFeatureEnabled(enabledFeatures, feature.key)}
                  disabled={feature.locked}
                  className="size-5 shrink-0 rounded border-[var(--color-muted)] disabled:opacity-60"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">
                    {feature.label}
                    {feature.locked ? <span className="ml-2 text-xs text-muted-foreground">Always on</span> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">{feature.description}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        {state.error ? (
          <p role="alert" className="rounded-[12px] bg-destructive-bg px-4 py-3 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Continue"}
        </Button>
      </form>
    </main>
  );
}
