// Kullanım: node <skill>/browser.mjs http://localhost:PORT/ --script qa/shot.mjs
// Ortam: SHOT_PREFIX (dosya öneki), SHOT_THEME (tema adı, ops.)
import fs from "fs";
export default async function run(page) {
  const prefix = process.env.SHOT_PREFIX || "shot";
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Yalçın", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
  });
  await page.reload();
  await page.waitForTimeout(2500);
  const out = [];
  const shots = [["hero", null], ["calendar", "takvim ve ajanda"], ["journal", "günlük notlar ve görevler"], ["work", "iş ve projeler."]];
  for (const [name, label] of shots) {
    if (label) {
      await page.evaluate((l) => {
        const el = [...document.querySelectorAll("aside span, aside div, aside button")].find((e) => e.children.length === 0 && e.textContent.trim().toLowerCase() === l);
        (el?.closest("button") || el)?.click();
      }, label);
      await page.waitForTimeout(900);
    }
    const p = `docs/design/${prefix}-${name}.png`;
    await page.screenshot({ path: p });
    out.push(p);
  }
  return out;
}
