"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DIM_AFTER_MS = 5 * 60 * 1000;

/**
 * Wall mode's live behaviour — Design-Spec §5: "No nav. Clock + weather header, 3 glance tiles,
 * family footer. Wakes on motion, dims after 5 min. Tap anywhere → dashboard."
 *
 * The clock ticks on a timer aligned to the next whole minute rather than a 1s interval. A
 * wall display runs for days; waking the main thread 86,400 times a day to re-render the same
 * "6:12" is the kind of thing that turns a kitchen tablet warm and flat by evening.
 *
 * Dimming is opacity on a wrapper, not a route change or a blanking overlay, so the screen
 * stays readable from across the room at 35% while clearly being asleep — and any pointer,
 * key, or motion event brings it straight back.
 */
export function WallClient({
  children,
  timeZone,
}: {
  children: React.ReactNode;
  timeZone: string;
}) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [dim, setDim] = useState(false);

  // Rendered client-side only: formatting a clock on the server and hydrating it on the client
  // guarantees a mismatch, because the two run at different instants by definition.
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    // First tick is scheduled rather than called inline: a synchronous setState in an effect
    // body triggers a cascading render (and eslint's react-hooks/set-state-in-effect). Going
    // through the timer makes this a subscription to an external clock, which is exactly what
    // an effect is for.
    function tick(delay: number) {
      timeout = setTimeout(() => {
        setNow(new Date());
        const current = new Date();
        tick(60_000 - (current.getSeconds() * 1000 + current.getMilliseconds()));
      }, delay);
    }

    tick(0);
    return () => clearTimeout(timeout);
  }, []);

  const wake = useCallback(() => setDim(false), []);

  useEffect(() => {
    let idle: ReturnType<typeof setTimeout>;
    function reset() {
      clearTimeout(idle);
      setDim(false);
      idle = setTimeout(() => setDim(true), DIM_AFTER_MS);
    }
    reset();
    const events = ["pointerdown", "pointermove", "keydown", "touchstart"] as const;
    for (const event of events) window.addEventListener(event, reset, { passive: true });
    return () => {
      clearTimeout(idle);
      for (const event of events) window.removeEventListener(event, reset);
    };
  }, []);

  const time = now
    ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(now)
    : "";
  const date = now
    ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone }).format(now)
    : "";

  return (
    <div
      onClick={() => (dim ? wake() : router.push("/dashboard"))}
      className="min-h-dvh cursor-pointer px-10 py-10 transition-opacity duration-700"
      style={{ opacity: dim ? 0.35 : 1 }}
    >
      <header className="flex items-start justify-between gap-8">
        <div>
          {/* §3 Display XL, 64/700, tabular so the digits don't shuffle on every minute. */}
          <p className="tabular text-[64px] font-bold leading-none tracking-[-0.03em]" suppressHydrationWarning>
            {time || "—"}
          </p>
          <p className="mt-2 text-[15px] text-text-secondary" suppressHydrationWarning>
            {date}
          </p>
        </div>
      </header>

      {children}

      {/* A wall display is a one-way door by design — there is no nav (§5) — so the way back
          has to be discoverable without being chrome. */}
      <p className="mt-10 text-[12px] text-text-tertiary">tap anywhere to open Hearth</p>
    </div>
  );
}
