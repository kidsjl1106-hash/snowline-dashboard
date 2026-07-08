const CACHE_NAME = "snowline-dashboard-pwa-v2026070801";
const CACHE_ASSETS = [
  "/snowline-dashboard/assets/logo.png",
  "/snowline-dashboard/assets/icon-180.png",
  "/snowline-dashboard/assets/icon-192.png",
  "/snowline-dashboard/assets/icon-512.png",
  "/snowline-dashboard/assets/icon-maskable-512.png",
  "/snowline-dashboard/manifest.webmanifest",
  "/snowline-dashboard/test/manifest.webmanifest"
];
const CACHEABLE_DESTINATIONS = new Set(["style", "script", "image", "manifest", "font"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/snowline-dashboard/")) return;
  if (request.mode === "navigate" || !CACHEABLE_DESTINATIONS.has(request.destination)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
