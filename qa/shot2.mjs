// Kalan ekranlar: kartlar, modallar, mobil. Ortam: SHOT_PREFIX, SHOT_THEME
export default async function run(page) {
  const prefix = process.env.SHOT_PREFIX || "s2";
  const theme = process.env.SHOT_THEME || "";
  const base = page.url().split("?")[0];
  const out = [];
  const seed = () => page.evaluate((onb) => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    if (!onb) localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Yalçın", avatarLetter: "Y", isCloud: false, createdAt: onb ? Date.now() : 1 }));
  }, false);
  const shot = async (name) => { const p = `docs/design/${prefix}-${name}.png`; await page.screenshot({ path: p }); out.push(p); };
  const clickText = (sel, txt) => page.evaluate(([s, t]) => {
    const el = [...document.querySelectorAll(s)].find((e) => e.children.length === 0 && e.textContent.trim().toLowerCase() === t);
    (el?.closest("button") || el)?.click(); return !!el;
  }, [sel, txt]);

  // ---- Masaüstü ----
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed();
  await page.goto(base + "?view=cards"); await page.waitForTimeout(2500);
  if (theme) { await clickText("span,div", theme); await page.waitForTimeout(400); }
  await shot("cards");
  // giriş modalı
  await page.goto(base); await page.waitForTimeout(2000);
  await page.evaluate(() => [...document.querySelectorAll("aside button")].find((b) => /kimlik/i.test(b.textContent))?.click());
  await page.waitForTimeout(700); await shot("auth");
  // kağıt & el yazısı
  await page.goto(base); await page.waitForTimeout(2000);
  await page.evaluate(() => document.querySelector('[data-nav="appearance"]')?.click());
  await page.waitForTimeout(300);
  await page.evaluate(() => [...document.querySelectorAll("aside button")].find((b) => /kağıt|kagit/i.test(b.textContent))?.click());
  await page.waitForTimeout(800); await shot("customize");
  // karşılama akışı
  await page.evaluate(() => { localStorage.removeItem("yourbook_onboarding_v1"); const u = JSON.parse(localStorage.getItem("yourbook_auth_user_v1")); u.createdAt = Date.now(); localStorage.setItem("yourbook_auth_user_v1", JSON.stringify(u)); });
  await page.goto(base); await page.waitForTimeout(2200); await shot("onboarding");
  // günlük
  await seed(); await page.goto(base + "?view=journal"); await page.waitForTimeout(2200); await shot("journal");

  // ---- Mobil ----
  await page.setViewportSize({ width: 390, height: 844 });
  await seed();
  await page.goto(base + "?view=cards"); await page.waitForTimeout(2200); await shot("m-cards");
  await page.goto(base + "?view=journal"); await page.waitForTimeout(2200); await shot("m-journal");
  await page.goto(base + "?view=calendar"); await page.waitForTimeout(2200); await shot("m-calendar");
  await page.goto(base); await page.waitForTimeout(2000);
  await page.evaluate(() => [...document.querySelectorAll("header button, button")].find((b) => /menüyü aç/i.test(b.getAttribute("aria-label") || b.title || ""))?.click());
  await page.waitForTimeout(800); await shot("m-drawer");
  return out;
}
