// FlexSell Wholesale Progressive Web App (PWA) & Web Push Service Worker

const CACHE_NAME = "flexsell-pwa-v5";
const OFFLINE_URL = "/offline.html";

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  "/Favicon.png",
  "/Flexsell%20Logo.png",
  "/manifest.json"
];

// Install Event — Precache core PWA assets & offline fallback
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event — Cleanup all legacy caches immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log("[ServiceWorker] Deleting legacy cache:", name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event — Network-first for dynamic navigation, Stale-While-Revalidate for CSS/JS/Fonts
// IMPORTANT: Image requests are intentionally BYPASSED so native browser HTTP caching and Next.js Image Optimization
// handle dynamic product/user images reliably on page refresh and back navigation without CORS/opaque issues.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Exclude API requests, uploads & admin dashboard from static caching
  if (
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/uploads")
  ) {
    return;
  }

  // Navigation Request (HTML page) -> Network First with Offline Fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // Static Assets (Styles, Scripts, Fonts only) -> Stale-While-Revalidate
  if (
    event.request.destination === "style" ||
    event.request.destination === "script" ||
    event.request.destination === "font"
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => {
          return cachedResponse || Response.error();
        });
        
        // Return cached immediately if available, while network request updates cache in background
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});

// Push Notification Event Listener
self.addEventListener("push", function (event) {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const title = payload.title || "FlexSell Wholesale Alert";
    const options = {
      body: payload.body || payload.message || "",
      icon: payload.icon || "/Favicon.png",
      badge: payload.badge || "/Favicon.png",
      data: {
        url: payload.url || payload.link || "/",
        entityId: payload.entityId || "",
        actionType: payload.actionType || "",
      },
      vibrate: [100, 50, 100],
      requireInteraction: false,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("Error processing web push payload:", err);
  }
});

// Notification Click Handler
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
