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
    await page.evaluate(() => {
      const t = (e) => (e.innerText || "").replace(/\s+/g, " ").trim();
      const b = [...document.querySelectorAll("main button, main a, aside button")].find(e => /dil masas/i.test(t(e)));
      if (b) b.click();
    });
    await page.waitForTimeout(2800);
    const probe = await page.evaluate(() => {
      const t = (e) => (e.innerText || "").replace(/\s+/g, " ").trim();
      const card = [...document.querySelectorAll("main *")].find(e => t(e) === "testwort" && e.children.length === 0);
      const heads = [...document.querySelectorAll("main h1, main h2, main h3")].slice(0, 4).map(h => h.tagName + ":" + t(h).slice(0, 24));
      const allBtns = [...document.querySelectorAll("main button")].map(e => t(e).slice(0, 20)).slice(0, 14);
      const cardRect = card ? (b => ({ top: Math.round(b.top), h: Math.round(b.height) }))(card.getBoundingClientRect()) : null;
      const mainEl = document.querySelector("main");
      const mainH = mainEl ? mainEl.getBoundingClientRect().height : null;
      return { hasCard: !!card, cardRect, heads, allBtns, mainH, docOverflow: document.documentElement.scrollHeight - window.innerHeight };
    });
    // kok konteyneri dibe kaydir
    await page.evaluate(() => {
      const root = document.documentElement;
      window.scrollTo(0, root.scrollHeight);
      const m = document.querySelector("main");
      let p = m?.parentElement;
      while (p && p !== document.body) { if (p.scrollHeight > p.clientHeight) p.scrollTop = p.scrollHeight; p = p.parentElement; }
    });
    await page.waitForTimeout(500);
    const probe2 = await page.evaluate(() => {
      const t = (e) => (e.innerText || "").replace(/\s+/g, " ").trim();
      const btns = [...document.querySelectorAll("main button")].filter(e => /yeni kelime|sınav|istatistik|sıfırla|quiz/i.test(t(e)));
      const rects = btns.map(e => { const b = e.getBoundingClientRect(); return { t: t(e).slice(0, 16), top: Math.round(b.top), bottom: Math.round(b.bottom), vis: b.bottom <= window.innerHeight && b.top >= 0 }; });
      const nav = [...document.querySelectorAll("div")].filter(e => {
        const cs = getComputedStyle(e);
        return cs.position === "fixed" && parseInt(cs.bottom) < 4 && e.getBoundingClientRect().height > 30 && e.getBoundingClientRect().height < 100;
      }).map(e => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), h: Math.round(b.height) }; });
      return { btns: rects, nav, scrollY: Math.round(window.scrollY), docH: document.documentElement.scrollHeight, vh: window.innerHeight };
    });
    if (spec.tag === "mobil") out.mobil = { probe, probe2 }; else out.masausti = { probe, probe2 };
  }
  return out;
}