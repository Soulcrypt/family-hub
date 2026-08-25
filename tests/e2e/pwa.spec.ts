import { expect, test } from "@playwright/test";

test("serves a valid web manifest", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);

  const manifest = await response.json();
  expect(manifest.name).toBe("Family Hub");
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
});

test("serves the icons the manifest promises", async ({ request }) => {
  for (const path of ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png"]) {
    expect((await request.get(path)).ok()).toBe(true);
  }
});

test("serves an offline fallback page", async ({ page }) => {
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();
});

// proxy.ts / lib/supabase/middleware.ts redirect any unauthenticated visitor to /welcome
// unless the path is on an explicit public allowlist. The service worker's install step
// caches /offline so it can be served while genuinely offline -- if that route were ever
// gated behind auth, the SW would cache a redirect to the login page instead of the
// fallback, and the fallback would be useless exactly when it's needed. This test carries
// no browser session/cookies (a fresh request context), so it exercises the signed-out path
// directly, independent of whatever the "offline fallback page" test above happens to do.
test("the offline fallback is reachable when signed out", async ({ request }) => {
  const response = await request.get("/offline", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("You’re offline");
});

test("serves /sw.js with headers that prevent it from being cached", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.ok()).toBe(true);
  expect(response.headers()["cache-control"]).toMatch(/no-store/);
});

// No test here asserts the service worker actually registers. Registration
// (components/pwa/register-sw.tsx) is intentionally guarded by
// `process.env.NODE_ENV === "production"`, and this suite's webServer
// (playwright.config.ts) runs `npm run dev`, i.e. NODE_ENV is never "production" here.
// A registration assertion against a dev server would be vacuously true or false for the
// wrong reason. Verifying registration for real requires driving Playwright against a
// `next build && next start` server, which is out of scope for this task -- see the
// implementation report for how to do that separately.
