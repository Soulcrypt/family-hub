import Link from "next/link";
import { WidgetCard } from "@/components/dashboard/widget-card";
import type { NewsItem } from "@/lib/dashboard/news";

export type NewsWidgetProps = {
  items: NewsItem[];
};

/**
 * Design-Spec §8.1: "News: 2 headlines max, divider-separated, source caption. Tap → source
 * link." Real data (lib/dashboard/news.ts's `getLocalNews()`, the Whitewater Banner's RSS
 * feed) -- but per this task's brief, "If you cannot get a reliable feed, say so... render the
 * empty state instead," so `items` can legitimately be `[]` (a transient fetch failure, or the
 * feed genuinely having nothing) and this renders the honest empty state rather than ever
 * inventing a headline.
 *
 * Each headline is its OWN link straight to the source article -- not the whole card wrapped
 * in one outer link -- both because that's what the spec's "tap -> source link" literally
 * means (two different articles, two different destinations) and because it avoids nesting an
 * `<a>` inside another interactive element.
 */
export function NewsWidget({ items }: NewsWidgetProps) {
  if (items.length === 0) {
    return (
      <WidgetCard id="news" title="Local news" dashed>
        <p className="flex flex-1 items-center justify-center text-center text-sm text-text-secondary">
          no local headlines available right now
        </p>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard id="news" title="Local news" meta={items[0]?.source}>
      <ul className="divide-y divide-hairline">
        {items.map((item) => (
          <li key={item.link} className="py-2.5 first:pt-0 last:pb-0">
            <Link
              href={item.link}
              target="_blank"
              rel="noreferrer noopener"
              className="block rounded-sm text-sm leading-snug text-text transition-colors hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[.97]"
            >
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
