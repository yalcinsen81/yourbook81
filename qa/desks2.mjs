// Dil masaları: grup listesi, tek tıkla ekleme, karşılama akışından otomatik masa.
export default async function run(page) {
  const base = page.url().split("?")[0];
  await page.setViewportSize({ width: 1440, height: 900 });
  const out = {};
  const seed = (onboard) => page.evaluate((onb) => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    if (!onb) localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Yalçın", avatarLetter: "Y", isCloud: false, createdAt: onb ? Date.now() : 1 }));
    localStorage.setItem("yourbook_desks_group_open_v1", "1");
  }, onboard);
  const desks = () => page.evaluate(() => {
    const aside = document.querySelector("aside");
    const rows = [...aside.querySelectorAll("button")].map((b) => ({ t: b.textContent.trim().replace(/\s+/g, " "), add: b.hasAttribute("data-add-desk") }));
    return { desks: rows.filter((r) => /Masası/.test(r.t) && !r.add).map((r) => r.t.slice(0, 22)), addRows: rows.filter((r) => r.add).map((r) => r.t), stored: (JSON.parse(localStorage.getItem("craft_custom_spaces_v1") || "[]")).map((s) => s.languageCode) };
  });

  // 1) Taze: 2 masa + 4 ekleme satırı
  await seed(false); await page.goto(base); await page.waitForTimeout(2200);
  out.fresh = await desks();
  await page.screenshot({ path: "docs/design/desks-group.png" });

  // 2) "+ İspanyolca Masası" tıkla -> masa oluşur, kart ekranı açılır
  await page.evaluate(() => document.querySelector('[data-add-desk="es"]').click());
  await page.waitForTimeout(1200);
  out.afterAddEs = await desks();
  out.heading = await page.evaluate(() => document.querySelector("h1")?.textContent.trim());

  // 3) Yenileme sonrası kalıcı mı
  await page.reload(); await page.waitForTimeout(2000);
  out.persisted = (await desks()).desks;

  // 4) Karşılama akışı: Almanca + İspanyolca + Fransızca seç -> masalar açılır
  await seed(true); await page.goto(base); await page.waitForTimeout(2200);
  const dlg = page.getByRole("dialog");
  const click = (name) => dlg.getByRole("button", { name }).first().click();
  await click(/Almanca/); await click(/İspanyolca/); await click(/Fransızca/);
  await click("Devam"); await click(/B1/); await click("Devam"); await click(/B1/); await click("Devam"); await click(/B1/); await click("Devam");
  await click(/kapağı aç/); await page.waitForTimeout(1200);
  out.afterOnboarding = await desks();
  return out;
}
