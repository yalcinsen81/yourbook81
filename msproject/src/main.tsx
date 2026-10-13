import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

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
