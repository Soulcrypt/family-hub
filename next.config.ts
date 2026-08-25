import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright's baseURL (playwright.config.ts) is http://127.0.0.1:3000, which Next's dev
  // server otherwise treats as a cross-origin request and silently 403s some static chunks
  // for -- breaking hydration for any client component loaded that way (discovered via
  // Task 10's onboarding Dialog: the trigger's onClick never fired because its chunk never
  // loaded). "localhost" is included too since that's what a browser opened by hand uses.
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  // The service worker (public/sw.js) must never be cached by the browser's HTTP cache --
  // a stale SW is sticky (it only updates on its own schedule) and very hard to dislodge
  // from a wall-mounted tablet that's rarely force-refreshed. See
  // node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md, section 8.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
