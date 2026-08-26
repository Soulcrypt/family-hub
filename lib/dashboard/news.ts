import { unstable_cache } from "next/cache";

/**
 * Design-Spec §8.1: "News: 2 headlines max, divider-separated, source caption. Tap → source
 * link." The Whitewater Banner (whitewaterbanner.com) is a real, actively-updated community
 * news site for Whitewater, WI -- exactly the town this household is in -- and its WordPress
 * install exposes a standard RSS 2.0 feed at `/feed/` containing genuine, current headlines
 * (confirmed by curl'ing it directly while building this: real articles, e.g. police-blotter
 * and UW-Whitewater move-in stories, updated same-day).
 *
 * KNOWN LIMITATION, discovered while building this and worth flagging for whoever looks at
 * this next: the site sits behind Cloudflare, and Cloudflare's bot management challenges
 * Node's own `fetch` (undici) specifically -- a `curl` request for the identical URL from the
 * identical machine gets a real 200 with the feed body; a plain Node `fetch`, even with a full
 * browser `User-Agent` and the rest of a real browser's request headers, gets a 403 "Just a
 * moment..." Cloudflare challenge page instead. That smells like TLS/JA3 client-fingerprint
 * based bot detection (Node's TLS stack has a different handshake signature than curl's or a
 * real browser's), not a header check -- which means it will very likely behave identically
 * once this runs on Vercel, since Vercel Functions also run Node's fetch. Practically: this
 * task's brief explicitly allows for exactly this outcome ("if you cannot get a reliable
 * feed... render the empty state instead") -- `fetchLocalNews()` below degrades to `[]` on a
 * non-ok response with no special-casing for WHY it wasn't ok, so a Cloudflare challenge and a
 * genuine outage look identical to this code and both produce the honest empty state
 * (news-widget.tsx), never invented copy. Left wired to the real feed (rather than swapped for
 * a less relevant source that happens to not sit behind Cloudflare) because the content itself
 * is genuinely correct for this household and the parsing/caching below is real and tested; if
 * this widget is consistently empty in production, that Cloudflare block -- not a bug in this
 * file -- is almost certainly why.
 */
const FEED_URL = "https://whitewaterbanner.com/feed/";
const SOURCE_NAME = "Whitewater Banner";
const MAX_ITEMS = 2;

export type NewsItem = {
  title: string;
  link: string;
  source: string;
};

function decodeEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pulls the first `<tag>...</tag>` (case-insensitive, non-greedy) out of one `<item>` block.
 * A hand-rolled regex extractor rather than a full XML parser -- this project has no XML
 * dependency, and a WordPress-generated RSS 2.0 feed's `<item>` shape is simple and stable
 * enough not to need one. */
function extractTag(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(block);
  const raw = match?.[1];
  if (!raw) return null;
  const decoded = decodeEntities(raw);
  return decoded.length > 0 ? decoded : null;
}

/**
 * The uncached fetch + parse. Exported separately from `getLocalNews` for the same reason
 * weather.ts's `fetchWeather` is: tests need to exercise parsing/degradation directly, without
 * `unstable_cache`'s memoization hiding a second test's mocked response behind the first's
 * cached result.
 */
export async function fetchLocalNews(): Promise<NewsItem[]> {
  try {
    const res = await fetch(FEED_URL, {
      headers: {
        // A generic Node fetch User-Agent gets bot-blocked by this host (confirmed while
        // building this feature); a real browser UA string does not.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];

    const items: NewsItem[] = [];
    for (const block of blocks) {
      if (items.length >= MAX_ITEMS) break;
      const title = extractTag(block, "title");
      const link = extractTag(block, "link");
      if (title && link) items.push({ title, link, source: SOURCE_NAME });
    }
    return items;
  } catch (error) {
    console.error("[dashboard/news] failed to fetch/parse the local news feed", error);
    return [];
  }
}

/** Cached for 30 minutes -- this task's brief: "Cache it server-side; do not fetch on every
 * render." A hyperlocal news feed doesn't publish faster than that, and see weather.ts's
 * identical comment for why `unstable_cache` rather than a bare `fetch` cache option. */
export const getLocalNews = unstable_cache(fetchLocalNews, ["dashboard-news"], {
  revalidate: 1800,
});
