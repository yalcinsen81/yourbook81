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
  await page.screenshot({ path: "docs/design/side-closed.png" });
  const before = await page.evaluate(() => ({ themes: !![...document.querySelectorAll("aside span")].find((e) => e.textContent.trim() === "krem portakal"), expanded: document.querySelector('[data-nav="appearance"]')?.getAttribute("aria-expanded") }));
  await page.evaluate(() => document.querySelector('[data-nav="appearance"]').click());
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => ({ themes: !![...document.querySelectorAll("aside span")].find((e) => e.textContent.trim() === "krem portakal"), expanded: document.querySelector('[data-nav="appearance"]')?.getAttribute("aria-expanded"), stored: localStorage.getItem("yourbook_appearance_group_open_v1") }));
  await page.screenshot({ path: "docs/design/side-open.png" });
  await page.reload(); await page.waitForTimeout(1500);
  const persisted = await page.evaluate(() => document.querySelector('[data-nav="appearance"]')?.getAttribute("aria-expanded"));
  return { before, after, persistedAfterReload: persisted };
}
