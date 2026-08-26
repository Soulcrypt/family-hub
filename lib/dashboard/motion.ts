/**
 * Design-Spec §7.4: "prefers-reduced-motion: kill all ambient motion and staggers." The global
 * CSS rule in app/globals.css (`@media (prefers-reduced-motion: reduce)`) already forces
 * `animation-duration`/`transition-duration` to 0.01ms `!important` on every element, which is
 * enough to neutralize any pure-CSS animation this task adds (the widget entrance stagger, any
 * ambient CSS keyframe). It CANNOT reach a JS-driven animation loop (a `requestAnimationFrame`
 * count-up, a `setInterval`) -- CSS has no power over imperative timers -- so any such code in
 * this dashboard must check this helper itself and skip straight to the end value instead.
 *
 * jsdom (this project's vitest environment) does not implement `matchMedia` at all by default,
 * and a real browser under stricter privacy settings can throw calling it -- both degrade to
 * `false` (motion allowed) rather than crashing the component that asked.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
