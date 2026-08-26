import Link from "next/link";
import { Button } from "@/components/ui/button";

export type EmptyWidgetBodyProps = {
  /** Sentence-case, lowercase-calm per Design-Spec §11 -- e.g. "no dinner planned yet". */
  message: string;
  /** e.g. "+ Add meal" -- Design-Spec §6 empty states: "one-line prompt + accent action." */
  actionLabel: string;
  actionHref: string;
};

/**
 * Design-Spec §6: "Empty states: Dashed-border card (border/dashed), centered: one-line
 * prompt in text/secondary + accent action. No illustrations, no mascots." The dashed border
 * itself lives on the parent `WidgetCard` (its `dashed` prop) so it wraps the whole card, not
 * just this inner content block -- this component is just the centered message + CTA.
 *
 * The action is a real navigation link (to the feature's own route, which -- per
 * lib/constants/features.ts -- renders its own honest "not built yet" screen for every widget
 * here except weather/news) rather than a dead button, satisfying Design-Spec §1's "every
 * widget deep-links to its full screen" without a widget ever claiming a screen exists when it
 * doesn't.
 */
export function EmptyWidgetBody({ message, actionLabel, actionHref }: EmptyWidgetBodyProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
      <p className="text-sm text-text-secondary">{message}</p>
      <Button asChild variant="ghost" size="sm">
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    </div>
  );
}
