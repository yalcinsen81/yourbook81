export default async function run(page) {
  const base = page.url().split("?")[0];
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Y", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
  });
  const out = {};
  await page.goto(base + "?view=journal"); await page.waitForTimeout(1800);
  await page.locator('button[aria-label="günlük PIN ayarları"]').click(); await page.waitForTimeout(500);
  out.modal = await page.evaluate(() => {
    const m = [...document.querySelectorAll("h4")].find((e) => /mahremiyet/i.test(e.textContent))?.closest("div[class*='fixed'], div[role='dialog'], div");
    const root = document.querySelector('[data-qa-modal]') || m;
    const box = [...document.querySelectorAll("input")].map((i) => i.type + ":" + (i.getAttribute("inputmode") || "") + ":" + (i.placeholder || "").slice(0, 16) + ":max" + i.maxLength);
    return { inputs: box, buttons: [...document.querySelectorAll("button")].map((b) => b.textContent.trim()).filter((t) => /kaydet|kilit|vazgeç|iptal|kaldır/i.test(t)).slice(0, 8) };
  });
  const pinInput = page.locator('input[type="password"]').first();
  await pinInput.fill("1234");
  const saveBtn = page.getByRole("button", { name: /^(kaydet|kilitle|pin.*kaydet|pin belirle)$/i }).first();
  out.saveBtnCount = await saveBtn.count();
  if (out.saveBtnCount) await saveBtn.click(); await page.waitForTimeout(600);
  out.afterSave = await page.evaluate(() => ({ pin: localStorage.getItem("yourbook_journal_pin_v1"), lockedNow: /günlük kilitli|kilidi aç/i.test(document.body.innerText) }));
  await page.reload(); await page.waitForTimeout(1800);
  out.afterReload = await page.evaluate(() => ({ pin: localStorage.getItem("yourbook_journal_pin_v1"), locked: /günlük kilitli|kilidi aç/i.test(document.body.innerText), pwInputs: document.querySelectorAll('input[type="password"]').length }));
  return out;
}
