// Tema ve görünüm geçiş sürelerini ölçer. Eski arayüz (tema listesi) ve yeni (renk noktaları) ikisini de dener.
export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Yalçın", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
    localStorage.setItem("yourbook_appearance_group_open_v1", "1");
  });
  await page.reload();
  await page.waitForTimeout(2500);
  const res = [];
  const themes = ["nane yeşili", "okyanus defteri", "gece defteri", "krem portakal"];
  for (const name of themes) {
    const r = await page.evaluate(async (n) => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const find = () => {
        const byAria = document.querySelector(`aside button[aria-label="${n}"]`);
        if (byAria) return byAria;
        const span = [...document.querySelectorAll("aside span")].find((e) => e.textContent.trim() === n);
        return span?.closest("button") || span;
      };
      const el = find(); if (!el) return { n, err: "bulunamadı" };
      const before = getComputedStyle(document.body).backgroundColor;
      const t0 = performance.now();
      el.click();
      let tColor = null, tSettled = null;
      while (performance.now() - t0 < 3000) {
        await new Promise((r) => setTimeout(r, 4));
        const bg = getComputedStyle(document.body).backgroundColor;
        const rootBg = getComputedStyle(document.documentElement).getPropertyValue("--app-bg").trim();
        if (tColor === null && rootBg) { /* değişken güncellendi mi: renk değişimini bekle */ }
        if (tColor === null && bg !== before) tColor = performance.now() - t0;
        const running = document.getAnimations().filter((a) => a.playState === "running").length;
        if (tColor !== null && running === 0) { tSettled = performance.now() - t0; break; }
      }
      return { n, colorChangedMs: tColor && Math.round(tColor), settledMs: tSettled && Math.round(tSettled) };
    }, name);
    res.push(r);
    await page.waitForTimeout(400);
  }
  return res;
}
