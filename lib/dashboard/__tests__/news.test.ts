import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLocalNews } from "@/lib/dashboard/news";

function textResponse(body: string, ok = true): Response {
  return {
    ok,
    text: async () => body,
  } as Response;
}

const SAMPLE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Whitewater Banner</title>
<item>
  <title><![CDATA[Farmers market moves to City Market grounds this Saturday]]></title>
  <link>https://whitewaterbanner.com/farmers-market-moves/</link>
  <pubDate>Wed, 26 Aug 2026 12:00:00 +0000</pubDate>
</item>
<item>
  <title><![CDATA[UW-Whitewater fall move-in begins next week &#8212; expect traffic on Main St]]></title>
  <link>https://whitewaterbanner.com/uw-whitewater-fall-move-in/</link>
  <pubDate>Wed, 26 Aug 2026 09:00:00 +0000</pubDate>
</item>
<item>
  <title><![CDATA[A third story that should never appear]]></title>
  <link>https://whitewaterbanner.com/third-story/</link>
</item>
</channel></rss>`;

describe("fetchLocalNews", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses at most 2 headlines from a well-formed feed, decoding CDATA and entities", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(textResponse(SAMPLE_FEED)));

    const items = await fetchLocalNews();
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      title: "Farmers market moves to City Market grounds this Saturday",
      link: "https://whitewaterbanner.com/farmers-market-moves/",
      source: "Whitewater Banner",
    });
    expect(items[1]?.title).toContain("UW-Whitewater fall move-in begins next week");
    expect(items[1]?.title).not.toContain("&#8212;");
  });

  it("returns [] (never invented headlines) when the feed responds not-ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(textResponse("", false)));
    expect(await fetchLocalNews()).toEqual([]);
  });

  it("returns [] when the body has no <item> blocks at all", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(textResponse("<rss><channel></channel></rss>")));
    expect(await fetchLocalNews()).toEqual([]);
  });

  it("returns [] (does not throw) when fetch itself rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    expect(await fetchLocalNews()).toEqual([]);
  });

  it("skips an item missing a title or link rather than producing a broken entry", async () => {
    const partial = `<rss><channel>
      <item><title><![CDATA[Has both]]></title><link>https://example.test/a</link></item>
      <item><title><![CDATA[Missing link]]></title></item>
    </channel></rss>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(textResponse(partial)));
    const items = await fetchLocalNews();
    expect(items).toEqual([{ title: "Has both", link: "https://example.test/a", source: "Whitewater Banner" }]);
  });
});
