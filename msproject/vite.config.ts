import { createHash } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** public/ altındaki dosyalar (göreli yol) */
function publicFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? publicFiles(full, root) : [relative(root, full).split("\\").join("/")];
  });
}

/**
 * Çevrimdışı çalışma için service worker: derlemedeki tüm dosyaları önbelleğe alır.
 * Sürüm, dosya listesinin özetidir; yeni derleme eski önbelleği temizler.
 */
function serviceWorker(): Plugin {
  return {
    name: "proje-planlayici-sw",
    apply: "build",
    generateBundle(_, bundle) {
      const files = ["", "index.html", ...Object.keys(bundle), ...publicFiles("public")]
        .filter((f) => f !== "sw.js" && !f.endsWith(".map"))
        .map((f) => `./${f}`);
      const version = createHash("sha256").update(files.join("\n")).digest("hex").slice(0, 12);
      const source = `// Derleme sırasında üretilir (vite.config.ts)
const CACHE = "proje-planlayici-${version}";
const ASSETS = ${JSON.stringify([...new Set(files)])};

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
`;
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  // Başlat dosyası ve kurulu uygulama hep aynı adresi kullanır (veriler adrese bağlıdır)
  server: { port: 5173, strictPort: true },
  preview: { port: 5173, strictPort: true },
  // Testler Türkçe metinle yazıldı; dil testleri kendi içinde İngilizceye geçer
  test: { setupFiles: ["./src/test-setup.ts"] },
});
