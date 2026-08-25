import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright's baseURL (playwright.config.ts) is http://127.0.0.1:3000, which Next's dev
  // server otherwise treats as a cross-origin request and silently 403s some static chunks
  // for -- breaking hydration for any client component loaded that way (discovered via
  // Task 10's onboarding Dialog: the trigger's onClick never fired because its chunk never
  // loaded). "localhost" is included too since that's what a browser opened by hand uses.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
