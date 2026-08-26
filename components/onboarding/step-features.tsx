"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { saveFeaturesAction, type ActionState } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { FEATURES, isFeatureEnabled, type EnabledFeatures } from "@/lib/constants/features";

const INITIAL: ActionState = { error: null };

/**
 * Step 4 of 5 — kept exactly as it already worked (real data: `household_settings.enabled_features`),
 * per this task's "keep every step that already works and is wired to real data" instruction.
 * No mock was handed down for this slot (4c/4d/4e cover members/location/widgets only, captioned
 * 2/5, 3/5 and 5/5 respectively) — restyled to the current design tokens and given the shared
 * progress indicator, nothing else changed. Its "Continue" used to hand off straight to the
 * `ready` screen; it now hands off to the new `widgets` step (5/5) instead.
 */
export function StepFeatures({ enabledFeatures }: { enabledFeatures: EnabledFeatures }) {
  const [state, formAction, pending] = useActionState(saveFeaturesAction, INITIAL);
  const router = useRouter();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && state.error === null) {
      router.push("/onboarding?step=widgets");
    }
    wasPending.current = pending;
  }, [pending, state, router]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-4 px-6 py-8">
      <Link
        href="/onboarding?step=location"
        className="-ml-2 inline-flex min-h-[44px] w-fit items-center gap-1 rounded-[12px] px-2 text-sm font-medium text-text-secondary transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ChevronLeft size={18} aria-hidden />
        Back
      </Link>

      <OnboardingProgress step={4} />

      <div>
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-text">Choose your features</h1>
        <p className="mt-1.5 text-sm text-text-secondary">Turn on what your family will use. You can change these anytime in settings.</p>
      </div>

      <form action={formAction} className="flex flex-1 flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {FEATURES.map((feature) => (
            <li key={feature.key} className="rounded-card bg-glass has-disabled:opacity-80">
              {/*
                The checkbox and its text share ONE <label> (rather than an input + a
                separately-htmlFor'd label) so the whole row is a >=44px tap target, not just
                the 20px checkbox square -- easier to hit correctly, especially one-handed or
                on a shared kitchen tablet.
              */}
              <label htmlFor={`feature-${feature.key}`} className="flex min-h-[44px] items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  id={`feature-${feature.key}`}
                  name="features"
                  value={feature.key}
                  defaultChecked={feature.locked || isFeatureEnabled(enabledFeatures, feature.key)}
                  disabled={feature.locked}
                  className="size-5 shrink-0 rounded border-hairline disabled:opacity-60"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold text-text">
                    {feature.label}
                    {feature.locked ? <span className="ml-2 text-xs text-text-tertiary">Always on</span> : null}
                  </span>
                  <span className="text-xs text-text-secondary">{feature.description}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        {state.error ? (
          <p role="alert" className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger-text">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending} className="mt-auto">
          {pending ? "Saving…" : "Continue"}
        </Button>
      </form>
    </main>
  );
}
