// Sol bant tıklaması: vurgu (aktif zemin) ve içerik ne zaman değişiyor? CPU_RATE ile yavaşlatma (varsayılan 4).
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
  const ORDER = process.env.NAV_ORDER || "";
  await page.evaluate((o) => { window.__ORDER = o; }, ORDER);
  const rows = await page.evaluate(async () => {
    const nav = [["notes", "klasörlenmiş notlar"], ["daily", "günlük notlar ve görevler"], ["work", "iş ve projeler."], ["calendar", "takvim ve ajanda"], ["youtube", "youtube arşivi"], ["collections", "arşiv"], ["journal", "sevgili günlük"], ["hero", "giriş & defter kapağı"]];
    const mainSig = () => { const m = document.querySelector("main") || document.body; return (m.innerText || "").slice(0, 300) + "|" + m.children.length; };
    const hasPill = (id) => { const b = document.querySelector(`[data-nav="${id}"]`); const p = b?.querySelector('[class*="-z-10"]'); const r = p?.getBoundingClientRect(); return !!r && r.width > 0; };
    const out = [];
    const order = (window.__ORDER ? window.__ORDER.split(",") : null);
    const list = order ? order.map((k) => nav.find((n) => n[0] === k)) : nav;
    for (const [id, label] of list) {
      const btn = document.querySelector(`[data-nav="${id}"]`);
      if (!btn) { out.push(id + ": yok"); continue; }
      const before = mainSig();
      const t0 = performance.now();
      btn.click();
      let tHi = null, tContent = null;
      await new Promise((resolve) => {
        const tick = () => {
          const now = performance.now() - t0;
          if (tHi === null && hasPill(id)) tHi = now;
          if (tContent === null && mainSig() !== before) tContent = now;
          if ((tHi !== null && tContent !== null) || now > 2500) return resolve();
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      out.push(`${id.padEnd(11)} highlight:${tHi === null ? "-" : Math.round(tHi)}ms  content:${tContent === null ? "-" : Math.round(tContent)}ms`);
      await new Promise((r) => setTimeout(r, 500));
    }
    return out;
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  return { cpuRate: rate, rows };
}
