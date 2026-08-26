import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type WidgetCardProps = {
  /** Used to derive a stable heading id for `aria-labelledby` -- Design-Spec §10 "sections
   * labelled" -- so each widget is its own landmark, distinct from the page's single `<h1>`. */
  id: string;
  title: string;
  /** Right-aligned caption in the header row -- Design-Spec §6 "Header row = Headline title
   * left + Caption meta right." (e.g. a source name, a location). */
  meta?: ReactNode;
  /** Design-Spec §6: "One widget per screen may be featured (accent-tint gradient card) -- on
   * the dashboard that's Tonight's Dinner." */
  featured?: boolean;
  /** Design-Spec §6 empty states: "Dashed-border card." */
  dashed?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * The shared shell every dashboard widget renders inside -- Design-Spec §6 "Cards / widgets":
 * glass card, radius 24, padding 24-26, header row (title + meta). `featured`/`dashed` switch
 * between the three surface treatments this dashboard actually uses (plain glass, the one
 * accent-tint featured card, and the dashed empty-state border) without every widget file
 * re-deriving the same class list.
 *
 * §7.3's "hover lift 2px + border brightens" applies to the whole card unconditionally, even
 * though most widgets here render an empty state with their own explicit CTA rather than the
 * whole card being a tap target -- see the individual widgets' doc comments for why none of
 * them wrap themselves in an outer `<Link>` (nested interactive elements/invalid HTML), and
 * lets the CTA itself be the one real tap target while the card still reads as "alive."
 */
export function WidgetCard({ id, title, meta, featured = false, dashed = false, className, children }: WidgetCardProps) {
  const headingId = `${id}-widget-heading`;
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex h-full flex-col rounded-card p-6 transition-transform duration-150 md:hover:-translate-y-0.5",
        featured ? "glass-tint" : "glass",
        dashed && "dashed",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-[15px] font-semibold text-text">
          {title}
        </h2>
        {meta ? <span className="text-xs text-text-secondary">{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}
