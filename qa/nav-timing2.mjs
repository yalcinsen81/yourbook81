export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("yourbook_ui_language_v1","tr"); localStorage.setItem("yourbook_onboarding_v1","1"); localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({id:"qa-local",email:"qa@local.test",displayName:"Y",avatarLetter:"Y",isCloud:false,createdAt:1})); });
  await page.reload(); await page.waitForTimeout(3000);
  return await page.evaluate(async () => {
    const labels = ["klasörlenmiş notlar","günlük notlar ve görevler","iş ve projeler.","takvim ve ajanda","youtube arşivi","arşiv","giriş & defter kapağı"];
    const mainEl = () => document.querySelector("main") || document.body;
    const sig = () => (mainEl().innerText || "").slice(0, 400) + "|" + mainEl().children.length;
    const find = (txt) => [...document.querySelectorAll("aside span, aside div, aside button")].find((e) => e.children.length === 0 && e.textContent.trim().toLowerCase() === txt);
    const out = [];
    for (const l of labels) {
      const el = find(l); const before = sig(); const t0 = performance.now(); (el.closest("button") || el).click();
      let tc = null, last = before, lc = t0;
      while (performance.now() - t0 < 3000) { await new Promise((r) => setTimeout(r, 4)); const s = sig(), n = performance.now(); if (s !== last) { if (tc === null) tc = n - t0; last = s; lc = n; } if (tc !== null && n - lc > 200) break; }
      out.push(l.slice(0, 14) + ":" + Math.round(tc));
      await new Promise((r) => setTimeout(r, 300));
    }
    return out.join(" | ");
  });
}
