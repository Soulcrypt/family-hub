"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { saveWidgetsAction, type ActionState } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { DEFAULT_WIDGETS, type WidgetKey } from "@/lib/constants/features";

const INITIAL: ActionState = { error: null };

const WIDGET_COPY: Record<WidgetKey, { label: string; description: string }> = {
  schedule: { label: "Schedule", description: "today's events" },
  dinner: { label: "Dinner", description: "tonight + macros" },
  weather: { label: "Weather", description: "local forecast" },
  photos: { label: "Photos", description: "latest album" },
  news: { label: "Local news", description: "top headlines" },
};

/** Mock 4e's second row (Chores, Ivy, Fitness) — features that don't have a dashboard widget
 * built yet. Shown as inert, unchecked tiles for the mock's exact layout rather than left out
 * entirely, but they submit nothing: `saveWidgetsAction` only ever accepts the five keys in
 * `DEFAULT_WIDGETS`, and its DB trigger (`guard_dashboard_widget_layout`) would reject anything
 * else outright. */
const COMING_SOON = [
  { label: "Chores", description: "up for grabs" },
  { label: "Ivy", description: "naps & routine" },
  { label: "Fitness", description: "goals & streaks" },
];

/**
 * Step 5/5 (mock 4e). Persists the choice to `member_dashboard_layouts` via `saveWidgetsAction`
 * — see that action's doc comment for why this writes to a real table another concurrent task
 * built, rather than a new column or migration of this task's own.
 */
export function StepWidgets({ initialWidgets }: { initialWidgets: readonly WidgetKey[] }) {
  const [state, formAction, pending] = useActionState(saveWidgetsAction, INITIAL);
  const router = useRouter();
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && state.error === null) {
      router.push("/onboarding?step=ready");
    }
    wasPending.current = pending;
  }, [pending, state, router]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-4 px-6 py-8">
      <Link
        href="/onboarding?step=features"
        className="-ml-2 inline-flex min-h-[44px] w-fit items-center gap-1 rounded-[12px] px-2 text-sm font-medium text-text-secondary transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ChevronLeft size={18} aria-hidden />
        Back
      </Link>

      <OnboardingProgress step={5} />

      <div>
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-text">Build your dashboard</h1>
        <p className="mt-1.5 text-sm text-text-secondary">Pick widgets — rearrange anytime.</p>
      </div>

      <form action={formAction} className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-2 gap-2.5">
          {DEFAULT_WIDGETS.map((key) => {
            const copy = WIDGET_COPY[key];
            const checked = initialWidgets.includes(key);
            return (
              <label
                key={key}
                htmlFor={`widget-${key}`}
                className="glass-tint flex min-h-[44px] cursor-pointer flex-col gap-1 rounded-tile px-3.5 py-3"
              >
                <span className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-text">{copy.label}</span>
                  <input
                    type="checkbox"
                    id={`widget-${key}`}
                    name="widgets"
                    value={key}
                    defaultChecked={checked}
                    className="size-[18px] shrink-0 rounded-full border border-accent text-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  />
                </span>
                <span className="text-[11px] text-text-tertiary">{copy.description}</span>
              </label>
            );
          })}
          {COMING_SOON.map((widget) => (
            <div
              key={widget.label}
              aria-hidden="true"
              className="flex flex-col gap-1 rounded-tile border border-hairline bg-glass px-3.5 py-3 opacity-60"
            >
              <span className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-text">{widget.label}</span>
                <span className="size-[18px] shrink-0 rounded-full border border-hairline" />
              </span>
              <span className="text-[11px] text-text-tertiary">{widget.description}</span>
            </div>
          ))}
        </div>

        {state.error ? (
          <p role="alert" className="rounded-card border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger-text">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending} className="mt-auto">
          {pending ? "Saving…" : "Finish setup 🎉"}
        </Button>
      </form>
    </main>
  );
}
