// service-worker.js
// Simple PWA cache for the Max Bid calculator

const CACHE_NAME = "maxbid-v2";

// Files to cache for offline use
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.webmanifest"
  // Add icons if/when you create them:
  // "./icon-192.png",
  // "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  // Activate the new service worker immediately
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Remove older caches
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      // Take control of pages ASAP
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== "GET") return;

  event.respondWith(
    (async () => {
      // Try cache first
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        // Otherwise fetch from network
        const fresh = await fetch(req);

        // Cache a copy of successful responses
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());

        return fresh;
      } catch (err) {
        // If offline and requesting a page, return cached index.html
        if (req.mode === "navigate") {
          const fallback = await caches.match("./index.html");
          if (fallback) return fallback;
        }
        // Last resort: just throw
        throw err;
      }
    })()
  );
});

