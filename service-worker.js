// service-worker.js
// Network-first for index.html (and navigations), cache-first for assets

const APP_VERSION = "v9";                 // bump this on every deployment
const CACHE_NAME = `maxbid-${APP_VERSION}`;

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.webmanifest"
  // If you add icons:
  // "./icon-192.png",
  // "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request, { cache: "no-store" });
    // Cache a copy of the latest response
    cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Fallback to cached index.html for navigations
    const fallback = await cache.match("./index.html");
    if (fallback) return fallback;
    throw err;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const fresh = await fetch(request);
  // Only cache successful basic responses
  if (fresh && fresh.ok) {
    cache.put(request, fresh.clone());
  }
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  // Network-first for:
  // - navigations (page loads)
  // - index.html specifically
  const url = new URL(req.url);
  const isNavigation = req.mode === "navigate";
  const isIndex =
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/maxbid/") ||
    url.pathname.endsWith("/maxbid");

  if (isNavigation || isIndex) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Everything else: cache-first (fast)
  event.respondWith(cacheFirst(req));
});
