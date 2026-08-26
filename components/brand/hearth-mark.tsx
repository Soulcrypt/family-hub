import { cn } from "@/lib/utils";

/**
 * The Hearth mark: a blue rounded square with a white "H" (Design-Spec §5, README "Assets" —
 * "recreate in code/SVG", no image asset).
 *
 * Drawn as geometry rather than typeset text on purpose. A `<text>` element would render in
 * whatever the viewer's system stack resolves to — and the spec bans webfonts, so the mark's
 * proportions would drift between macOS, Windows and Android, and again inside the PWA icon
 * where no page CSS applies at all. Three rectangles look identical everywhere.
 *
 * `--color-accent` (#0A84FF) is correct here despite failing 4.5:1 as *text*: the white "H" is
 * a graphical object, so WCAG 1.4.11's 3:1 applies, and white on #0A84FF measures 3.65:1.
 */
export function HearthMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Hearth"
      className={cn("shrink-0", className)}
    >
      {/* iOS-style superellipse-ish corner: 28% of the side, matching the mock's soft square. */}
      <rect width="64" height="64" rx="18" fill="var(--color-accent, #0A84FF)" />
      <g fill="#FFFFFF">
        <rect x="18" y="16" width="7.5" height="32" rx="3.75" />
        <rect x="38.5" y="16" width="7.5" height="32" rx="3.75" />
        <rect x="18" y="28.25" width="28" height="7.5" rx="3.75" />
      </g>
    </svg>
  );
}

/** Mark + wordmark, as the top bar renders it (§5). */
export function HearthLockup({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <HearthMark size={size} />
      <span className="text-[17px] font-bold tracking-[-0.02em] text-text">Hearth</span>
    </span>
  );
}
