// Deliberately network-first for navigations.
//
// A cache-first service worker would pin whatever build a phone happened to
// install and keep serving it after every deploy — the worst failure mode for
// a product being fixed daily, because the user sees old bugs and no amount
// of reloading helps. This one always tries the network and only falls back
// to the cached shell when the device is actually offline, which on a
// construction site happens often enough to matter.

const SHELL = "field-shell-v1";
const SHELL_URL = "/index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.add(SHELL_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // API calls are never cached: a stale estimate or invoice is worse than an
  // error message.
  if (request.method !== "GET" || new URL(request.url).pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          caches.open(SHELL).then((cache) => cache.put(SHELL_URL, response.clone()));
          return response;
        })
        .catch(() => caches.match(SHELL_URL).then((cached) => cached ?? Response.error()))
    );
  }
});
