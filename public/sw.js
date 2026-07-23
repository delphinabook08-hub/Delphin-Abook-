self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Do not intercept non-GET requests or API calls
  if (event.request.method !== "GET" || event.request.url.includes("/api/")) {
    return;
  }
  // Simple fetch pass-through for other GET requests
  event.respondWith(fetch(event.request));
});
