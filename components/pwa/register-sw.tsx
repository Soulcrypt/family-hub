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

    navigator.serviceWorker.register("/sw.js");
  }, []);

  return null;
}
