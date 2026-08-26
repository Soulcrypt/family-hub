"use client";

import { useLayoutEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/dashboard/motion";

const SESSION_KEY = "hearth-dashboard-entrance-played";

export type WidgetEntranceProps = {
  /** Position in the render order -- drives the 40ms stagger delay. */
  index: number;
  children: React.ReactNode;
  className?: string;
};

/**
 * Design-Spec §7.3: "Staggered widget entrance: on dashboard load, cards fade + rise 12px, 40ms
 * stagger, once per session (not on back-nav)." app/globals.css already defines the `rise-in`
 * keyframe this uses; this component's only job is deciding WHETHER and with WHAT delay to
 * apply it.
 *
 * "Once per session, not on back-nav" is a client-only fact (sessionStorage), which creates a
 * hydration constraint: the server has no way to know whether this browser tab already played
 * the entrance, so it always renders the pre-animation state (opacity 0, translateY(12px)) as
 * a plain inline style -- deterministic, no branching on client-only state during render, so
 * the client's first pass matches the server exactly. A `useLayoutEffect` (client-only, runs
 * after the DOM commits but before the browser paints) then either:
 *   - leaves the CSS `rise-in` animation running (first time this session) with this widget's
 *     own `index * 40ms` delay, or
 *   - immediately snaps to the settled state with no animation at all (already played this
 *     session, OR `prefers-reduced-motion` is set) -- before paint, so there is no visible
 *     flash of the hidden state.
 *
 * `prefers-reduced-motion` is ALSO already handled globally (app/globals.css forces
 * `animation-duration: 0.01ms !important`), so the explicit check here is redundant for the
 * animation's timing -- but without it, a reduced-motion viewer would still sit at
 * `opacity: 0` for 0.01ms and then it would not be reset by the sessionStorage branch below
 * (that branch never turns off the animation's `both` fill-mode's start state on its own if
 * the animation itself doesn't run for some other reason). Snapping to the settled state
 * explicitly is the belt to globals.css's suspenders.
 */
export function WidgetEntrance({ index, children, className }: WidgetEntranceProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    let played = false;
    try {
      played = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      // Storage can throw in a locked-down/private context -- degrade to "not played yet" so
      // the entrance still runs once per LOAD even if it can't remember across a back-nav.
      played = false;
    }

    if (played || prefersReducedMotion()) {
      el.style.animation = "none";
      el.style.opacity = "1";
      el.style.transform = "none";
    } else {
      el.style.animation = `rise-in 400ms var(--ease-spring) both`;
      el.style.animationDelay = `${index * 40}ms`;
    }

    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Nothing to do -- worst case the entrance replays on the next load within this tab.
    }
  }, [index]);

  return (
    <div ref={ref} className={className} style={{ opacity: 0, transform: "translateY(12px)" }}>
      {children}
    </div>
  );
}
