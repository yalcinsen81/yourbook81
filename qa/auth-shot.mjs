export default async function run(page) {
  const base = page.url().split("?")[0];
  await page.setViewportSize({ width: 1440, height: 900 });
  const out = [];
  for (const mode of ["in", "out"]) {
    await page.evaluate((m) => {
      localStorage.clear();
      localStorage.setItem("yourbook_ui_language_v1", "tr");
      localStorage.setItem("yourbook_onboarding_v1", "1");
      if (m === "in") localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Yalçın", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
    }, mode);
    await page.goto(base); await page.waitForTimeout(2000);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("aside button")].find((x) => /k.mlik|giriş|kaydol/i.test(x.textContent));
      b?.click();
    });
    await page.waitForTimeout(800);
    const p = `docs/design/auth-${mode}.png`;
    await page.screenshot({ path: p }); out.push(p);
  }
  return out;
}
