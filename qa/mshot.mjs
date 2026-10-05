// Mobil ekran görüntüleri: SHOT_PREFIX, SHOT_VIEWS (virgüllü), SHOT_W/H
export default async function run(page) {
  const base = page.url().split("?")[0];
  const prefix = process.env.SHOT_PREFIX || "m";
  const W = Number(process.env.SHOT_W || 390), H = Number(process.env.SHOT_H || 844);
  await page.setViewportSize({ width: W, height: H });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Y", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
  });
  const out = [];
  for (const v of (process.env.SHOT_VIEWS || "journal,calendar,youtube").split(",")) {
    await page.goto(base + "?view=" + v); await page.waitForTimeout(1500);
    const p = `docs/design/${prefix}-${v}.png`; await page.screenshot({ path: p }); out.push(p);
  }
  return out;
}
