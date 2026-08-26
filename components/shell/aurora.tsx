/**
 * The signature "alive" cue (Design-Spec §2.1 `bg/aurora`, §7.2 aurora drift): two slow radial
 * glows behind everything, drifting ~30s with ±4% translate and scale.
 *
 * Deliberately a `fixed`, `aria-hidden`, pointer-events-none layer rather than a background on
 * a content wrapper. Spec §7 sets the rule that ambient motion "never moves text" — animating
 * an ancestor of the content would move every glyph with it, and on a wall-mounted tablet that
 * reads as a rendering fault rather than atmosphere. Keeping it behind `-z-10` also means the
 * glass cards' own `backdrop-filter` samples it, which is where the depth comes from.
 *
 * `will-change: transform` on the two blobs keeps them on their own compositor layers, so the
 * drift is a GPU transform rather than a repaint of the page behind them.
 *
 * Reduced motion is handled globally in `app/globals.css` (animations collapse to 0.01ms), and
 * reduced transparency blanks `--aurora-a/-b` to `transparent` there too — so this component
 * needs no branch of its own for either.
 */
export function Aurora({ deep = false }: { deep?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ backgroundColor: deep ? "var(--color-base-deep)" : "var(--color-base)" }}
    >
      <div
        className="absolute -left-[15%] -top-[20%] h-[70vmax] w-[70vmax] rounded-full"
        style={{
          background: "radial-gradient(circle, var(--aurora-a) 0%, transparent 65%)",
          animation: "aurora-drift-a 30s ease-in-out infinite",
          willChange: "transform",
        }}
      />
      <div
        className="absolute -right-[20%] -top-[10%] h-[60vmax] w-[60vmax] rounded-full"
        style={{
          background: "radial-gradient(circle, var(--aurora-b) 0%, transparent 65%)",
          animation: "aurora-drift-b 34s ease-in-out infinite",
          willChange: "transform",
        }}
      />
    </div>
  );
}
