"use client";

import { useEffect } from "react";

// Guarded to production only: `next dev` recompiles routes on the fly, and a service
// worker aggressively caching navigations during development would serve stale pages
// and fight the dev server's own hot-reloading. It also means this registration is
// never exercised by `npm run test:e2e` (which runs `next dev`) -- see tests/e2e/pwa.spec.ts.
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // `.catch` is not optional: registration rejects on its own for reasons outside our
    // control (an unsupported context, a user blocking site data), and an unhandled promise
    // rejection in production is noise at best and a reported error at worst. The app works
    // fine without a service worker, so a failure here is worth a log line and nothing more.
    navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
      console.error("[pwa] service worker registration failed", error);
    });
  }, []);

  return null;
}
