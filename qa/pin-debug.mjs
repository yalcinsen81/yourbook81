export default async function run(page) {
  const base = page.url().split("?")[0];
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Y", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
    localStorage.setItem("yourbook_journal_pin_v1", "1234");
  });
  const out = {};
  await page.goto(base + "?view=journal"); await page.waitForTimeout(2000);
  out.lockedShown = await page.evaluate(() => ({ text: /kilitli|kilidi aç/i.test(document.body.innerText), inputs: [...document.querySelectorAll("input")].map((i) => i.type + ":" + (i.inputMode || "") + ":" + (i.placeholder || "").slice(0, 20)), pinStored: localStorage.getItem("yourbook_journal_pin_v1") }));
  await page.screenshot({ path: "docs/design/pin-lock.png" });
  const locked=()=>page.evaluate(()=>/günlük kilitli|kilidi aç/i.test(document.body.innerText));
  await page.locator("input[type=password]").fill("0000"); await page.keyboard.press("Enter"); await page.waitForTimeout(500);
  out.wrongPinStillLocked = await locked();
  await page.locator("input[type=password]").fill("1234"); await page.keyboard.press("Enter"); await page.waitForTimeout(700);
  out.correctPinUnlocked = !(await locked());
  // PIN'i arayüzden koy, sonra yenile
  await page.evaluate(() => { localStorage.removeItem("yourbook_journal_pin_v1"); });
  await page.goto(base + "?view=journal"); await page.waitForTimeout(1800);
  out.afterRemove = await page.evaluate(() => /kilitli|kilidi aç/i.test(document.body.innerText));
  return out;
}
