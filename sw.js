// Derleme sırasında üretilir (vite.config.ts)
const CACHE = "proje-planlayici-51cf5b4ce20e";
const ASSETS = ["./","./index.html","./assets/index-DYiVqHQM.js","./assets/GanttExportDialog-CbCpXDcM.js","./assets/ImportDialog-0siFI4V0.js","./assets/PrintPreview-BvcSt-DE.js","./assets/ReportsView-Ce27hgfd.js","./assets/RisksView-BQNqxnEo.js","./assets/react-FH9VspHR.js","./assets/xlsx-C5-XB7LI.js","./assets/index-BCOmdOI9.css","./assets/inter-cyrillic-ext-wght-normal-BOeWTOD4.woff2","./assets/inter-cyrillic-wght-normal-DqGufNeO.woff2","./assets/inter-greek-ext-wght-normal-DlzME5K_.woff2","./assets/inter-greek-wght-normal-CkhJZR-_.woff2","./assets/inter-latin-ext-wght-normal-DO1Apj_S.woff2","./assets/inter-latin-wght-normal-Dx4kXJAl.woff2","./assets/inter-vietnamese-wght-normal-CBcvBZtf.woff2","./assets/simWorker-B7Nfj1Os.js","./assets/source-serif-4-cyrillic-ext-wght-normal-DHTKMUil.woff2","./assets/source-serif-4-cyrillic-wght-normal-B1g8a0vD.woff2","./assets/source-serif-4-greek-wght-normal-BpXpdlRW.woff2","./assets/source-serif-4-latin-ext-wght-normal-BVZ5su8S.woff2","./assets/source-serif-4-latin-wght-normal-DMe4EKeb.woff2","./assets/source-serif-4-vietnamese-wght-normal-BsaNuasd.woff2","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./icons/icon-maskable.svg","./icons/icon.svg","./manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k.startsWith("proje-planlayici-")).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    // Sayfa: sunucu açıksa güncel sürüm, kapalıysa önbellekteki
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("./index.html", copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html")),
    );
    return;
  }
  // Dosyalar: önce önbellek (adları içerik özetli, değişmez)
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
