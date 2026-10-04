export default async function run(page, ui) {
  const out = {};
  // 1280x700 (laptop) + uzun notlu kart
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({
      id: "qa-local", email: "qa@local.test", displayName: "QA",
      avatarLetter: "Q", isCloud: false, createdAt: Date.now(),
    }));
    const longNote = "uzun not satiri. ".repeat(60);
    const deck = [{ id: "qa1", lang: "DE", word: "testwort", translation: "anlam", note: longNote, tags: [], createdAt: Date.now(), learnedAt: null, reviewAt: null, grammar: ["örnek cümle buraya uzun uzun yazılmış olabilir " + longNote.slice(0, 120)] }];
    localStorage.setItem("yourbook_deck_v7_clean", JSON.stringify(deck));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("main button, main a, aside button")].find(e => /dil masas/i.test(e.innerText || ""));
    if (b) b.click();
  });
  await page.waitForTimeout(2500);
  out["1280x700"] = await page.evaluate(() => {
    const txt = (el) => (el.innerText || "").replace(/\s+/g, " ").trim();
    const btns = [...document.querySelectorAll("main button")].filter(e => /yeni kelime|sınav|istatistik|sıfırla/i.test(txt(e)));
    const rects = btns.map(e => { const b = e.getBoundingClientRect(); return { t: txt(e).slice(0, 14), top: Math.round(b.top), bottom: Math.round(b.bottom), vis: b.bottom <= window.innerHeight && b.top >= 0 }; });
    const scrollers = [...document.querySelectorAll("main, main *")].filter(e => {
      const cs = getComputedStyle(e);
      return /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2;
    }).map(e => ({ cls: (e.className || "").toString().slice(0, 60), max: e.scrollHeight - e.clientHeight }));
    return { vh: window.innerHeight, btns: rects, scrollers };
  });
  // wheel
  await page.mouse.move(640, 350);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(500);
  out["1280x700"].afterWheel = await page.evaluate(() => {
    const txt = (el) => (el.innerText || "").replace(/\s+/g, " ").trim();
    const btn = [...document.querySelectorAll("main button")].find(e => /istatistik/i.test(txt(e)));
    if (!btn) return null;
    const b = btn.getBoundingClientRect();
    return { bottom: Math.round(b.bottom), vh: window.innerHeight, visible: b.bottom <= window.innerHeight && b.top >= 0 };
  });
  return out;
}