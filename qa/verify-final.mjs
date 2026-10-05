export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Yalçın", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
  });
  await page.reload();
  await page.waitForTimeout(2500);
  const out = {};
  out.fontOnStartup = await page.evaluate(async () => {
    await document.fonts.ready;
    const g = [...document.querySelectorAll("span")].find((e) => e.children.length === 0 && /merhaba/i.test(e.textContent));
    const cs = g && getComputedStyle(g);
    return {
      family: cs?.fontFamily.slice(0, 70),
      fontSize: cs?.fontSize,
      loadedArchitect: [...document.fonts].filter((f) => f.family.replace(/"/g, "") === "Architects Daughter" && f.status === "loaded").map((f) => f.unicodeRange.slice(0, 30)),
      checkTr: document.fonts.check('20px "Architects Daughter"', "ğüşİıöç"),
    };
  });
  out.journalItem = await page.evaluate(() => {
    const b = document.querySelector('[data-nav="journal"]');
    const r = b?.getBoundingClientRect();
    return b ? { text: b.textContent.trim().slice(0, 40), visible: r.width > 0 && r.height > 0, display: getComputedStyle(b).display } : null;
  });
  await page.evaluate(() => document.querySelector('[data-nav="journal"]')?.click());
  await page.waitForTimeout(900);
  out.afterClick = await page.evaluate(() => ({
    title: [...document.querySelectorAll("h1,h2")].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 2),
    activePillVisible: (() => { const p = document.querySelector('[data-nav="journal"] [class*="-z-10"]'); const r = p?.getBoundingClientRect(); return !!r && r.width > 0; })(),
  }));
  await page.screenshot({ path: "docs/design/final-journal.png" });
  await page.evaluate(() => document.querySelector('[data-nav="hero"]')?.click());
  await page.waitForTimeout(900);
  await page.screenshot({ path: "docs/design/final-hero.png" });
  return out;
}
