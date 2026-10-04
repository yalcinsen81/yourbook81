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
    // hero'daki 6 Dil Masasi'na tikla -> modal acilir
    await page.evaluate(() => {
      const t = (e) => (e.innerText || "").replace(/\s+/g, " ").trim();
      const b = [...document.querySelectorAll("main button")].find(e => /6\s*Dil Masası/i.test(t(e)));
      if (b) b.click();
    });
    await page.waitForTimeout(1200);
    // modal icinde Almanca Masasi'na tikla (dialog/z-50 taramasi)
    const step2 = await page.evaluate(() => {
      const t = (e) => (e.innerText || "").replace(/\s+/g, " ").trim();
      // dialog kokunu bul
      const dlg = [...document.querySelectorAll('[role="dialog"], div')].find(e => {
        const cs = getComputedStyle(e);
        return cs.position === "fixed" && cs.zIndex !== "auto" && parseInt(cs.zIndex) >= 50 && e.getBoundingClientRect().height > 200;
      });
      const scope = dlg || document;
      const desk = [...scope.querySelectorAll("button, a")].find(e => /almanca/i.test(t(e)));
      if (desk) { desk.click(); return "clicked:" + t(desk).slice(0, 24); }
      return "dialog:" + (dlg ? "var, buton yok" : "yok");
    });
    await page.waitForTimeout(2800);
    out[spec.tag] = await page.evaluate(() => {
      const txt = (el) => (el.innerText || "").replace(/\s+/g, " ").trim();
      const card = [...document.querySelectorAll("main *")].find(e => txt(e) === "testwort" && e.children.length === 0);
      const cardRect = card ? (b => ({ top: Math.round(b.top), h: Math.round(b.height), bottom: Math.round(b.bottom) }))(card.getBoundingClientRect()) : null;
      const btns = [...document.querySelectorAll("main button")].filter(e => /yeni kelime|sınav|istatistik|sıfırla|öğrendim|hatırlayamadım/i.test(txt(e)));
      const rects = btns.map(e => { const b = e.getBoundingClientRect(); return { t: txt(e).slice(0, 16), top: Math.round(b.top), bottom: Math.round(b.bottom), vis: b.bottom <= window.innerHeight && b.top >= 0 }; });
      return { cardRect, btns: rects, docOverflow: document.documentElement.scrollHeight - window.innerHeight, vh: window.innerHeight };
    });
    out[spec.tag].step2 = step2;
    // dibe kaydir
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      const m = document.querySelector("main");
      let p = m?.parentElement;
      while (p && p !== document.body) { if (p.scrollHeight > p.clientHeight) p.scrollTop = p.scrollHeight; p = p.parentElement; }
      const sc = [...document.querySelectorAll("main, main *")].filter(e => { const cs = getComputedStyle(e); return /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2; });
      sc.forEach(e => (e.scrollTop = e.scrollHeight));
    });
    await page.waitForTimeout(500);
    out[spec.tag].afterScroll = await page.evaluate(() => {
      const txt = (el) => (el.innerText || "").replace(/\s+/g, " ").trim();
      const btns = [...document.querySelectorAll("main button")].filter(e => /istatistik|sınav|öğrendim|hatırlayamadım|yeni kelime/i.test(txt(e)));
      return btns.map(e => { const b = e.getBoundingClientRect(); return { t: txt(e).slice(0, 16), top: Math.round(b.top), bottom: Math.round(b.bottom), vis: b.bottom <= window.innerHeight && b.top >= 0 }; });
    });
  }
  return out;
}