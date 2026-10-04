import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { I18nProvider } from "./i18n/I18nProvider";
import "./index.css";

// Web / tarayıcı ortamında Tauri native invoke köprüsü tanımlı değilse
// TypeError fırlatılmasını engelleyen güvenli no-op shim
if (typeof window !== "undefined" && !(window as any).__TAURI_INTERNALS__) {
  (window as any).__TAURI_INTERNALS__ = {
    invoke: async () => {},
    transformCallback: () => 0,
    unregisterCallback: () => {},
  };
}

// Service Worker kaydı (Arka plan bildirimleri ve offline alarm desteği)
if (typeof window !== "undefined" && "serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>
);
