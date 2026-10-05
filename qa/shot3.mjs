// Kalan modal ve temalar. Ortam: SHOT_PREFIX
export default async function run(page) {
  const prefix = process.env.SHOT_PREFIX || "s5";
  const base = page.url().split("?")[0];
  const out = [];
  const seed = () => page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Yalçın", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
  });
  const shot = async (name) => { const p = `docs/design/${prefix}-${name}.png`; await page.screenshot({ path: p }); out.push(p); };
  const clickBtn = (re) => page.evaluate((src) => { const r = new RegExp(src, "i"); const b = [...document.querySelectorAll("button")].find((x) => r.test(x.textContent) || r.test(x.getAttribute("aria-label") || "") || r.test(x.title || "")); b?.click(); return !!b; }, re);
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed();

  await page.goto(base); await page.waitForTimeout(2000);
  await clickBtn("yerel profil"); await page.waitForTimeout(700); await shot("auth-in");

  await page.goto(base); await page.waitForTimeout(1800);
  await page.keyboard.press("Control+k"); await page.waitForTimeout(700); await shot("palette");

  await page.goto(base); await page.waitForTimeout(1800);
  await clickBtn("yeni kelime . not"); await page.waitForTimeout(700); await shot("quickadd");

  await page.goto(base); await page.waitForTimeout(1800);
  await clickBtn("defter hediye"); await page.waitForTimeout(700); await shot("gift");

  // el yazısı atölyesi
  await page.goto(base); await page.waitForTimeout(1800);
  await page.evaluate(() => document.querySelector('[data-nav="appearance"]')?.click());
  await page.waitForTimeout(300);
  await clickBtn("kağıt . el yazısı"); await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelector('[data-tab="handwriting"]')?.click());
  await page.waitForTimeout(600);
  await clickBtn("atölyeyi aç|hemen oluştur"); await page.waitForTimeout(900); await shot("studio");

  // günlük PIN
  await page.goto(base + "?view=journal"); await page.waitForTimeout(2200);
  await clickBtn("pin"); await page.waitForTimeout(700); await shot("pin");

  // temalar
  for (const [name, label] of [["green", "nane yeşili"], ["ocean", "okyanus defteri"]]) {
    await page.goto(base); await page.waitForTimeout(1800);
    await page.evaluate(() => document.querySelector('[data-nav="appearance"]')?.click());
    await page.waitForTimeout(300);
    await page.evaluate((l) => { const el = [...document.querySelectorAll("aside span")].find((e) => e.textContent.trim() === l); (el?.closest("button") || el)?.click(); }, label);
    await page.waitForTimeout(600); await shot("theme-" + name);
  }
  return out;
}
