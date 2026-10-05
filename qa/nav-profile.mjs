// İşlemci yavaşlatmalı (CPU_RATE, varsayılan 4) sol bant tıklama profili.
export default async function run(page) {
  const rate = Number(process.env.CPU_RATE || 4);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Y", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
  });
  await page.reload();
  await page.waitForTimeout(3500);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  const res = await page.evaluate(async () => {
    const labels = ["klasörlenmiş notlar", "günlük notlar ve görevler", "iş ve projeler.", "takvim ve ajanda", "youtube arşivi", "arşiv", "sevgili günlük", "giriş & defter kapağı"];
    const find = (txt) => [...document.querySelectorAll("aside span, aside div, aside button")].find((e) => e.children.length === 0 && e.textContent.trim().toLowerCase() === txt);
    const longTasks = [];
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => longTasks.push(Math.round(e.duration)))).observe({ entryTypes: ["longtask"] }); } catch {}
    const rows = [];
    for (const l of labels) {
      const el = find(l); if (!el) { rows.push(l + ": yok"); continue; }
      const btn = el.closest("button") || el;
      longTasks.length = 0;
      const t0 = performance.now();
      btn.click();
      const tSync = performance.now() - t0;                       // tıklama işleyicisinin senkron süresi
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const tPaint = performance.now() - t0;                      // iki kare sonra (ilk görünür tepki)
      let tSettled = null;
      while (performance.now() - t0 < 2000) {
        await new Promise((r) => setTimeout(r, 8));
        if (document.getAnimations().filter((a) => a.playState === "running").length === 0) { tSettled = performance.now() - t0; break; }
      }
      rows.push(`${l.slice(0, 16).padEnd(16)} sync:${Math.round(tSync)} paint:${Math.round(tPaint)} settled:${Math.round(tSettled)} longTasks:[${longTasks.join(",")}]`);
      await new Promise((r) => setTimeout(r, 350));
    }
    return rows;
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  return { cpuRate: rate, rows: res };
}
