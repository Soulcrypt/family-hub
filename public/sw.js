const CACHE = "family-hub-shell-v1";
const SHELL = ["/offline", "/icons/icon-192.png", "/logo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Navigation requests only. Household data is deliberately never cached in SP1 --
// staleness and privacy trade-offs belong to the sub-projects that own that data.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      // `caches.match` resolves to undefined if the shell entry was evicted (browsers do
      // evict under storage pressure), and `respondWith(undefined)` throws -- turning the
      // friendly fallback into the browser's raw network-error page, in the exact situation
      // this file exists to handle. Answer with something either way.
      const cached = await caches.match("/offline");
      return (
        cached ??
        new Response("<!doctype html><title>Offline</title><h1>You’re offline</h1>", {
          status: 503,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
      );
    }),
  );
});
