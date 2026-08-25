import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Playwright's own process doesn't get Next.js's automatic .env.local loading -- only the
// `npm run dev` server (spawned below via webServer) does. tests/e2e/switcher.spec.ts needs
// NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY itself, to seed a PIN hash directly in
// the database, so load the same file explicitly here before workers are spawned -- they
// inherit process.env from this process.
loadEnv({ path: ".env.local" });

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry" },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    // `devices["iPad (gen 7)"]` defaults to WebKit, which this sandbox cannot run — it needs
    // system libraries (libicu74 and friends) that require root to install, and installing
    // them is out of scope here. Retargeted to Chromium at the same 810x1080 iPad viewport so
    // this project still exercises the tablet-width responsive layout the spec calls for.
    // Tradeoff: no WebKit engine coverage from this suite, so Safari-specific CSS/layout bugs
    // will not be caught here. If root access to install WebKit's deps becomes available,
    // switch back to `devices["iPad (gen 7)"]` — that's a one-line change.
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 810, height: 1080 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "kitchen", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
