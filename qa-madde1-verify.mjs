export default async function run(page, ui) {
  const out = {};
  for (const spec of [{ w: 390, h: 844, tag: "mobil" }, { w: 1280, h: 700, tag: "masausti" }]) {
    await page.setViewportSize({ width: spec.w, height: spec.h });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({
        id: "qa-local", email: "qa@local.test", displayName: "QA",
        avatarLetter: "Q", isCloud: false, createdAt: Date.now(),
      }));
      const longNote = "uzun not satiri. ".repeat(80);
      const deck = [{ id: "qa1", lang: "DE", word: "testwort", translation: "anlam", note: longNote, tags: ["#test"], createdAt: Date.now(), learnedAt: null, reviewAt: null, grammar: ["örnek cümle: " + longNote.slice(0, 200)] }];
      localStorage.setItem("yourbook_deck_v7_clean", JSON.stringify(deck));
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    // Sidebar: calisma masalari bolumunu ac, sonra Almanca Masasi'na tikla
    await page.evaluate(() => {
      const t = (e) => (e.innerText || "").replace(/\s+/g, " ").trim();
      // mobilde sidebar acik degilse, masa listesini hero'dan ac
      let b = [...document.querySelectorAll("aside button")].find(e => /çalışma masaları/i.test(t(e)));
      if (b && !/giriş|kapak/.test(t(b))) b.click();
      await0: { }
    });
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      const t = (e) => (e.innerText || "").replace(/\s+/g, " ").trim();
      const items = [...document.querySelectorAll("aside button, aside a, main button")];
      const desk = items.find(e => /almanca masası/i.test(t(e)) && !/6 dil/i.test(t(e)));
      if (desk) desk.click();
    });
    await page.waitForTimeout(2800);
    out[spec.tag] = await page.evaluate(() => {
      const txt = (el) => (el.innerText || "").replace(/\s+/g, " ").trim();
      const h2 = document.querySelector("h2");
      const isDesk = !!h2 && /masa/i.test(txt(h2));
      const btns = [...document.querySelectorAll("main button")].filter(e => /yeni kelime|sınav|istatistik|sıfırla/i.test(txt(e)));
      const rects = btns.map(e => { const b = e.getBoundingClientRect(); return { t: txt(e).slice(0, 16), top: Math.round(b.top), bottom: Math.round(b.bottom), vis: b.bottom <= window.innerHeight && b.top >= 0 }; });
      const docOverflow = document.documentElement.scrollHeight - window.innerHeight;
      return { isDesk, h2: h2 ? txt(h2).slice(0, 30) : null, btns: rects, docOverflow, vh: window.innerHeight };
    });
    // kok konteyneri dibe kaydir
    await page.evaluate(() => {
      const root = document.querySelector("main")?.closest("div");
      if (root && root.scrollHeight > root.clientHeight) root.scrollTop = root.scrollHeight;
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(500);
    out[spec.tag].afterScroll = await page.evaluate(() => {
      const txt = (el) => (el.innerText || "").replace(/\s+/g, " ").trim();
      const btn = [...document.querySelectorAll("main button")].find(e => /istatistik|sınav/i.test(txt(e)));
      if (!btn) return null;
      const b = btn.getBoundingClientRect();
      return { bottom: Math.round(b.bottom), vh: window.innerHeight, visible: b.bottom <= window.innerHeight && b.top >= 0 };
    });
  }
  return out;
}