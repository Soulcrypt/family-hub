"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/dashboard/motion";

export type CountUpProps = {
  value: number;
  /** Design-Spec §7.1: "Numbers (points, budget, temperature) animate count-up 400ms on
   * change." */
  durationMs?: number;
  suffix?: string;
  className?: string;
};

/**
 * Animates from 0 to `value` once on mount (the dashboard's temperature is the one Numeric-size
 * count-up this build has real data for -- §8.1). This is a `requestAnimationFrame` loop, not a
 * CSS animation/transition, so app/globals.css's global `prefers-reduced-motion` rule (which
 * only ever touches `animation-duration`/`transition-duration`) cannot reach it -- this
 * component checks `prefersReducedMotion()` (lib/dashboard/motion.ts) itself and, when it's
 * set, renders the final value immediately with no animation frames at all.
 *
 * Server-rendered markup shows the FINAL value (not 0) so a client with JS disabled, or a
 * screen reader announcing content before hydration, never sees a stuck "0°". The animation is
 * a progressive enhancement layered on top via a client-only effect, matching this project's
 * existing hydration-safety pattern (see widget-entrance.tsx's identical reasoning).
 */
export function CountUp({ value, durationMs = 400, suffix = "", className }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    // The initial state above is already `value` -- nothing to synchronize here when motion is
    // reduced; the RAF loop below is what needs skipping.
    if (prefersReducedMotion()) return;

    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      // Ease-out cubic -- consistent with the rest of the app's spring-ish, decelerating feel
      // (Design-Spec §7.1) without pulling in a full easing/animation library for one number.
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    }

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [value, durationMs]);

  return (
    <span className={className} aria-hidden={false}>
      {display}
      {suffix}
    </span>
  );
}
