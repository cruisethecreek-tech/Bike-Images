// sw.js — SELF-DESTRUCT. The offline cache this used to provide caused some Fire TVs to
// get stuck serving stale/broken copies of the app. This version does the opposite: any TV
// still running the old worker will update to this one, which clears all caches, unregisters
// itself, and reloads the page so the TV returns to always-fresh content. No interception.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (_) {}
    try { await self.registration.unregister(); } catch (_) {}
    try {
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((c) => { try { c.navigate(c.url); } catch (_) {} });
    } catch (_) {}
  })());
});

// Deliberately no fetch handler — all requests go straight to the network.
