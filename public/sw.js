// yourbook Progressive Web App (PWA) Service Worker
const CACHE_NAME = "yourbook-pwa-v3";

const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable.png",
  "/apple-touch-icon.png",
];

// 1. Kurulum ve statik varlıkları önbelleğe alma
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("[SW] Precache hatası (normal, ilk açılış):", err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Aktivasyon ve eski önbellek temizliği
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Çevrimdışı Çalışma & Akıllı Fetch Stratejisi
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Sadece aynı origin HTTP(S) GET isteklerini yakala
  if (req.method !== "GET" || !url.protocol.startsWith("http")) return;

  // Supabase REST ve dış API isteklerini önbelleğe alma
  if (url.origin.includes("supabase.co") || url.origin.includes("googleapis.com")) {
    return;
  }

  // HTML Sayfa Gezinmeleri: Network-First (çevrimdışıysa önbellekten "/")
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(req);
          if (cached) return cached;
          const fallback = await cache.match("/");
          if (fallback) return fallback;
          return new Response("Çevrimdışı Mod", { headers: { "Content-Type": "text/html" } });
        })
    );
    return;
  }

  // Statik Varlıklar (JS, CSS, Fontlar, Görseller): Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedRes) => {
      const fetchPromise = fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => cachedRes);

      return cachedRes || fetchPromise;
    })
  );
});

// 4. Masaüstü & Mobil Bildirim Tıklaması / Aksiyonları
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = data.url || "/";

  // "ertele" aksiyonu: 5 dakika sonra tekrar bildir
  if (event.action === "snooze") {
    event.waitUntil(
      (async () => {
        await new Promise((r) => setTimeout(r, 5 * 60 * 1000));
        await self.registration.showNotification(data.title || "Hatırlatıcı", {
          body: data.body || "",
          icon: data.icon || "/icon-192.png",
          badge: "/icon-192.png",
          tag: data.tag || "yourbook-alarm",
          renotify: true,
          data,
        });
      })()
    );
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Uygulama zaten acik bir pencerede varsa onu odakla
      for (const client of clientList) {
        if (client.url && "focus" in client) {
          if ("navigate" in client) {
            client.navigate(targetUrl).catch(() => {});
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// 5. Alarm Ön Plan Bildirimi (sayfa -> SW mesaji ile)
// Sayfa tarafi, zamanlanmis bir alarmi bu mesajla SW'ye iletebilir.
self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (msg.type === "SHOW_ALARM") {
    event.waitUntil(
      self.registration.showNotification(msg.title || "Hatırlatıcı", {
        body: msg.body || "",
        icon: msg.icon || "/icon-192.png",
        badge: "/icon-192.png",
        tag: msg.tag || "yourbook-alarm",
        renotify: true,
        requireInteraction: true,
        actions: [
          { action: "open", title: msg.actionOpen || "Aç" },
          { action: "snooze", title: msg.actionSnooze || "5 dk ertele" },
        ],
        data: { url: msg.url || "/", title: msg.title, body: msg.body, tag: msg.tag, icon: msg.icon },
      })
    );
  }
});
