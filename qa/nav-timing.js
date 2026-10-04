// Tarayıcıda çalıştır: sol banttaki her görünüm düğmesine tıklar, içerik değişene kadar geçen süreyi (ms) ölçer.
// Önce localStorage'da giriş/onboarding anahtarlarını ayarlayıp sayfayı yenilemiş olmalısın.
(async () => {
  const labels = ["klasörlenmiş notlar", "günlük notlar ve görevler", "iş ve projeler.", "takvim ve ajanda", "youtube arşivi", "arşiv", "giriş & defter kapağı"];
  const mainEl = () => document.querySelector("main") || document.body;
  const sig = () => (mainEl().innerText || "").slice(0, 400) + "|" + mainEl().children.length;
  const find = (txt) => [...document.querySelectorAll("aside span, aside div, aside button")].find((e) => e.children.length === 0 && e.textContent.trim().toLowerCase() === txt);
  const results = [];
  for (const l of labels) {
    const el = find(l);
    if (!el) { results.push({ l, err: "bulunamadı" }); continue; }
    const before = sig();
    const t0 = performance.now();
    (el.closest("button") || el).click();
    let tChange = null, tStable = null, last = before, lastChangeAt = t0;
    while (performance.now() - t0 < 4000) {
      await new Promise((r) => requestAnimationFrame(r));
      const s = sig(); const now = performance.now();
      if (s !== last) { if (tChange === null) tChange = now - t0; last = s; lastChangeAt = now; }
      if (tChange !== null && now - lastChangeAt > 150) { tStable = lastChangeAt - t0; break; }
    }
    results.push({ l, firstChangeMs: tChange && Math.round(tChange), settledMs: tStable && Math.round(tStable) });
    await new Promise((r) => setTimeout(r, 400));
  }
  return JSON.stringify(results);
})();
