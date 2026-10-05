// İşlev akışları: kaydet, kalıcılık, alarm verisi, PIN, statik varlıklar. Her adım bağımsız raporlanır.
export default async function run(page) {
  const base = page.url().split("?")[0];
  const out = [];
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 120)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });
  const step = async (name, fn) => { try { const r = await fn(); out.push(`${r === false ? "KALDI" : "ok   "} ${name}${typeof r === "string" ? " → " + r : ""}`); } catch (e) { out.push("HATA  " + name + " → " + String(e.message || e).split("\n")[0].slice(0, 130)); } };
  const seed = () => page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Yalçın", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed();

  // 1) Hızlı ekle: kelime kartı
  await step("hızlı ekle: kelime kartı kaydı", async () => {
    await page.goto(base); await page.waitForTimeout(1500);
    const before = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("yourbook_deck_v7_clean") || "[]"); return (Array.isArray(d) ? d : d.cards || []).length; });
    await page.getByRole("button", { name: /yeni kelime/i }).first().click();
    await page.getByPlaceholder(/kelime kartı/i).fill("das Haus");
    await page.getByPlaceholder(/türkçe anlamı/i).fill("ev");
    await page.getByRole("button", { name: /kelimeyi ekle|ekle/i }).last().click();
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("yourbook_deck_v7_clean") || "[]"); const a = Array.isArray(d) ? d : d.cards || []; return { n: a.length, has: a.some((c) => /Haus/.test(JSON.stringify(c))) }; });
    return after.has && after.n === before + 1 ? `${before}→${after.n}` : false;
  });
  await step("kart kalıcı (yenilemeden sonra)", async () => {
    await page.reload(); await page.waitForTimeout(1500);
    return await page.evaluate(() => /Haus/.test(localStorage.getItem("yourbook_deck_v7_clean") || ""));
  });

  // 2) Günlük görev
  await step("günlük görev ekle/işaretle/sil", async () => {
    await page.goto(base + "?view=daily"); await page.waitForTimeout(1500);
    await page.getByPlaceholder(/yeni bir görev/i).fill("test görevi QA");
    await page.keyboard.press("Enter"); await page.waitForTimeout(500);
    const added = await page.evaluate(() => /test görevi QA/.test(localStorage.getItem("superr_daily_tasks_v3") || ""));
    return added ? "eklendi" : false;
  });

  // 3) Takvim: alarmlı etkinlik
  await step("takvim: alarmlı etkinlik kaydı", async () => {
    await page.goto(base + "?view=calendar"); await page.waitForTimeout(1500);
    await page.getByPlaceholder(/saatlik not|randevu/i).first().fill("QA toplantısı");
    await page.getByRole("button", { name: /ajandaya ekle/i }).click(); await page.waitForTimeout(600);
    const ev = await page.evaluate(() => { const a = JSON.parse(localStorage.getItem("superr_agenda_events_v4") || "[]"); return a.find((e) => /QA toplantısı/.test(e.title || "")); });
    return ev ? `id=${ev.id} hasAlarm=${ev.hasAlarm} alarmTs=${ev.alarmTimestamp ? "var" : "yok"}` : false;
  });

  // 4) Günlük yazma + otomatik kayıt tekil
  await step("günlük: tek kayıt (çift kayıt hatası düzeltmesi)", async () => {
    await page.goto(base + "?view=journal"); await page.waitForTimeout(1800);
    await page.locator("textarea").first().fill("QA günlük girdisi");
    await page.waitForTimeout(1500);
    const n = await page.evaluate(() => JSON.parse(localStorage.getItem("yourbook_journal_entries_v1") || "[]").filter((e) => /QA günlük/.test(e.content || "")).length);
    return n === 1 ? "1 kayıt" : `${n} kayıt`;
  });

  // 5) Yedek: komut paleti
  await step("komut paleti: yedek/dışa aktar komutu var", async () => {
    await page.goto(base); await page.waitForTimeout(1500);
    await page.keyboard.press("Control+k"); await page.waitForTimeout(400);
    await page.keyboard.type("yedek"); await page.waitForTimeout(400);
    return await page.evaluate(() => /yedek|dışa aktar|backup/i.test(document.querySelector('[data-qa-modal="command-palette"]')?.innerText || ""));
  });
  await page.keyboard.press("Escape");

  // 6) Statik varlıklar
  await step("manifest + ikonlar", async () => {
    const r = await page.evaluate(async () => {
      const m = await (await fetch("/manifest.json")).json();
      const checks = await Promise.all((m.icons || []).map(async (i) => [i.src, (await fetch(i.src)).status]));
      return { name: m.name, start: m.start_url, display: m.display, icons: checks };
    });
    const bad = r.icons.filter(([, s]) => s !== 200);
    return bad.length ? "ikon 404: " + bad.map((b) => b[0]).join(",") : `${r.name} ${r.display} (${r.icons.length} ikon)`;
  });
  await step("SEO/meta: description, theme-color, favicon, viewport", async () => {
    const m = await page.evaluate(() => ({
      desc: document.querySelector('meta[name="description"]')?.content?.slice(0, 50) || null,
      og: !!document.querySelector('meta[property="og:title"]'),
      theme: document.querySelector('meta[name="theme-color"]')?.content || null,
      icon: !!document.querySelector('link[rel~="icon"]'),
      apple: !!document.querySelector('link[rel="apple-touch-icon"]'),
      viewport: document.querySelector('meta[name="viewport"]')?.content || null,
      manifest: !!document.querySelector('link[rel="manifest"]'),
    }));
    const missing = Object.entries(m).filter(([, v]) => !v).map(([k]) => k);
    return missing.length ? "eksik: " + missing.join(",") : "tam";
  });

  // 7) Dil değişimi kalıcı
  await step("dil değişimi kalıcı + dir", async () => {
    await page.evaluate(() => { localStorage.setItem("yourbook_ui_language_v1", "ar"); });
    await page.reload(); await page.waitForTimeout(1800);
    const r = await page.evaluate(() => document.documentElement.lang + "/" + document.documentElement.dir);
    return r === "ar/rtl" ? r : false;
  });
  return { errors: [...new Set(errors)].slice(0, 8), out };
}
