export default async function run(page, ui) {
  const out = {};
  for (const spec of [{ w: 390, h: 844, tag: "mobil-uzun-kart" }, { w: 1280, h: 700, tag: "masausti-uzun-kart" }]) {
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
      const b = [...document.querySelectorAll("main button, main a, aside button")].find(e => /dil masas/i.test(e.innerText || ""));
      if (b) b.click();
    });
    await page.waitForTimeout(2600);
    out[spec.tag] = await page.evaluate(() => {
      const txt = (el) => (el.innerText || "").replace(/\s+/g, " ").trim();
      const isDesk = !!document.querySelector("h2") && /masa/i.test(txt(document.querySelector("h2")));
      const btns = [...document.querySelectorAll("main button")].filter(e => /yeni kelime|sınav|istatistik|sıfırla/i.test(txt(e)) && !/^\+/.test(txt(e)));
      const rects = btns.map(e => { const b = e.getBoundingClientRect(); return { t: txt(e).slice(0, 14), top: Math.round(b.top), bottom: Math.round(b.bottom), vis: b.bottom <= window.innerHeight && b.top >= 0 }; });
      const scrollers = [...document.querySelectorAll("main, main *")].filter(e => {
        const cs = getComputedStyle(e);
        return /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2;
      }).map(e => ({ cls: (e.className || "").toString().slice(0, 55), max: e.scrollHeight - e.clientHeight }));
      const docOverflow = document.documentElement.scrollHeight - window.innerHeight;
      return { isDesk, btns: rects, scrollers, docOverflow };
    });
    // wheel denemesi
    await page.mouse.move(spec.w / 2, Math.min(300, spec.h / 2));
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(600);
    out[spec.tag].afterWheel = await page.evaluate(() => {
      const txt = (el) => (el.innerText || "").replace(/\s+/g, " ").trim();
      const btn = [...document.querySelectorAll("main button")].find(e => /istatistik|sınav/i.test(txt(e)));
      if (!btn) return null;
      const b = btn.getBoundingClientRect();
      return { bottom: Math.round(b.bottom), vh: window.innerHeight, visible: b.bottom <= window.innerHeight && b.top >= 0 };
    });
  }
  return out;
}