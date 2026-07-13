// sw.js — offline resilience for the signage display. Caches the app shell, the content
// config, and the media so a TV keeps playing through a Wi-Fi outage — even across a
// reboot — with no extra hardware. Scoped to the signage display only; it deliberately
// does NOT touch the dashboard (admin.html), the product page, or any /api/ call.
//
// Strategy:
//   - signage.html / content.json / branding.json / signage-version.json → network-first
//     (always prefer fresh when online; serve the last cached copy when offline)
//   - images & videos loaded by the <img>/<video> tags → cache-first (instant + offline)

const CACHE = "cruisecast-signage-v1";
const SHELL = ["signage.html", "branding.json"];
const MEDIA_RE = /\.(jpe?g|png|webp|gif|mp4|webm|ogg|mov|m4v)(\?|$)/i;

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function stripQuery(req) {
  const u = new URL(req.url); u.search = "";
  return u.toString();
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const keyUrl = stripQuery(req);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(keyUrl, res.clone());   // keep the freshest copy
    return res;
  } catch (err) {
    const hit = (await cache.match(keyUrl)) || (await cache.match(req, { ignoreSearch: true }));
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  try { if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); } catch (_) {}
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                       // never touch API POSTs
  let url; try { url = new URL(req.url); } catch (_) { return; }
  const path = url.pathname;

  // Leave the dashboard, product page and APIs entirely on the network.
  if (path.startsWith("/api/")) return;
  if (/\/(admin|product|index)\.html$/.test(path)) return;

  // App shell + config: prefer fresh, fall back to cache when offline.
  if (/\/signage\.html$/.test(path) || req.mode === "navigate" ||
      /\/content\.json$/.test(path) || /\/signage-version\.json$/.test(path) || /\/branding\.json$/.test(path)) {
    // Only take over navigations that are the signage page.
    if (req.mode === "navigate" && !/\/signage\.html$/.test(path)) return;
    e.respondWith(networkFirst(req));
    return;
  }

  // Media actually painted on screen (the <img>/<video> tags): cache-first so it survives
  // outages/reboots. The in-memory preload fetch() (destination "empty") is left alone.
  if ((req.destination === "image" || req.destination === "video") &&
      (MEDIA_RE.test(path) || MEDIA_RE.test(url.href))) {
    e.respondWith(cacheFirst(req));
    return;
  }
});
