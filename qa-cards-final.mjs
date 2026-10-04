export default async function run(page, ui) {
  const out = {};
  for (const w of [1280, 390]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({
        id: "qa-local", email: "qa@local.test", displayName: "QA",
        avatarLetter: "Q", isCloud: false, createdAt: Date.now(),
      }));
      // bir kac test karti ekle (masalar bos state'te butonlar yok)
      const deck = [];
      for (let i = 1; i <= 3; i++) {
        deck.push({ id: "qa" + i, lang: "DE", word: "testwort" + i, translation: "anlam " + i, note: "", tags: [], createdAt: Date.now(), learnedAt: null, reviewAt: null, grammar: [] });
      }
      localStorage.setItem("yourbook_deck_v7_clean", JSON.stringify(deck));
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    // masa butonuna tikla — ONCE hero icindeki "6 Dil Masasi", olmazsa sidebar
    const clicked = await page.evaluate(() => {
      const cands = [...document.querySelectorAll("main button, main a")]
        .concat([...document.querySelectorAll("aside button, aside a")]);
      const b = cands.find(e => /dil masas/i.test(e.innerText || ""));
      if (b) { b.click(); return true; }
      return false;
    });
    await page.waitForTimeout(2500);
    out[w] = await page.evaluate(() => {
      const txt = (el) => (el.innerText || "").replace(/\s+/g, " ").trim();
      const newBtn = [...document.querySelectorAll("main button")].find(e => /yeni kelime/i.test(txt(e)));
      const quizBtn = [...document.querySelectorAll("main button")].find(e => /sınav/i.test(txt(e)));
      const statBtn = [...document.querySelectorAll("main button")].find(e => /istatistik/i.test(txt(e)));
      const vis = (e) => {
        if (!e) return null;
        const b = e.getBoundingClientRect();
        return { top: Math.round(b.top), bottom: Math.round(b.bottom), onScreen: b.bottom <= window.innerHeight && b.top >= 0 };
      };
      // hangi kaplar kaydirilabilir
      const scrollers = [...document.querySelectorAll("main, main *")].filter(e => {
        const cs = getComputedStyle(e);
        return /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2;
      }).map(e => ({ cls: (e.className || "").toString().slice(0, 80), max: e.scrollHeight - e.clientHeight, st: e.scrollTop }));
      // alt nav
      const nav = [...document.querySelectorAll("div")].find(e => {
        const cs = getComputedStyle(e);
        return cs.position === "fixed" && parseInt(cs.bottom) < 5 && e.getBoundingClientRect().height > 30;
      });
      const navR = nav ? nav.getBoundingClientRect() : null;
      return {
        yeniKelime: vis(newBtn), sinav: vis(quizBtn), istatistik: vis(statBtn),
        scrollers, nav: navR ? { top: Math.round(navR.top), h: Math.round(navR.height) } : null,
        view: (() => { const h = document.querySelector("h2"); return h ? txt(h) : null; })(),
      };
    });
    // wheel ile kaydir (kart uzerine)
    await page.mouse.move(w / 2, 400);
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(500);
    out[w].afterWheel = await page.evaluate(() => {
      const txt = (el) => (el.innerText || "").replace(/\s+/g, " ").trim();
      const btn = [...document.querySelectorAll("main button")].find(e => /istatistik|sınav|yeni kelime/i.test(txt(e)));
      if (!btn) return null;
      const b = btn.getBoundingClientRect();
      return { bottomBtn: Math.round(b.bottom), vh: window.innerHeight, visible: b.bottom <= window.innerHeight && b.top >= 0 };
    });
  }
  return out;
}