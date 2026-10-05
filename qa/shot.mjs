// Kullanım: node <skill>/browser.mjs http://localhost:PORT/ --script qa/shot.mjs
// Ortam: SHOT_PREFIX, SHOT_W, SHOT_H, SHOT_THEME (örn. "gece defteri"), SHOT_VIEWS ("hero,calendar,...")
export default async function run(page) {
  const prefix = process.env.SHOT_PREFIX || "shot";
  const W = Number(process.env.SHOT_W || 1440), H = Number(process.env.SHOT_H || 900);
  const theme = process.env.SHOT_THEME || "";
  await page.setViewportSize({ width: W, height: H });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Yalçın", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
  });
  await page.reload();
  await page.waitForTimeout(2500);
  const all = {
    hero: null,
    archive: "arşiv",
    daily: "günlük notlar ve görevler",
    notes: "klasörlenmiş notlar",
    work: "iş ve projeler.",
    calendar: "takvim ve ajanda",
    youtube: "youtube arşivi",
  };
  const want = (process.env.SHOT_VIEWS || "hero,calendar,daily,work").split(",");
  const mobile = W < 1024;
  if (theme) {
    await page.evaluate((t) => {
      const el = [...document.querySelectorAll("span,div")].find((e) => e.children.length === 0 && e.textContent.trim() === t);
      (el?.closest("button") || el)?.click();
    }, theme);
    await page.waitForTimeout(500);
  }
  const out = [];
  for (const name of want) {
    const label = all[name];
    if (label && !mobile) {
      await page.evaluate((l) => {
        const el = [...document.querySelectorAll("aside span, aside div, aside button")].find((e) => e.children.length === 0 && e.textContent.trim().toLowerCase() === l);
        (el?.closest("button") || el)?.click();
      }, label);
      await page.waitForTimeout(900);
    }
    if (name === "cards" && !mobile) {
      await page.evaluate(() => {
        const el = [...document.querySelectorAll("aside span")].find((e) => /almanca/i.test(e.textContent) && e.children.length === 0);
        (el?.closest("button") || el)?.click();
      });
      await page.waitForTimeout(900);
    }
    const p = `docs/design/${prefix}-${name}.png`;
    await page.screenshot({ path: p });
    out.push(p);
  }
  return out;
}
