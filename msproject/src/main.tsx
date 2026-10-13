import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { getLang, subscribe } from "./i18n";
import { applySavedLocale } from "./settings";

// Dil ayarı proje yüklenmeden önce uygulanır (varsayılan adlar seçili dilde üretilsin)
applySavedLocale();
document.documentElement.lang = getLang();
subscribe(() => {
  document.documentElement.lang = getLang();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Kurulabilir uygulama (PWA): derlenmiş sürümde service worker çevrimdışı açılışı sağlar
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Desteklenmiyor ya da güvenli olmayan adres: uygulama yine çalışır
    });
  });
}
