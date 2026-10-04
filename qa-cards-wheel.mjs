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
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("aside button, aside a")].find(e => /masa/i.test(e.innerText || ""));
      if (b) b.click();
    });
    await page.waitForTimeout(2200);

    // 1) mouse wheel ile kaydirmayi dene (sayfa merkezine)
    const cx = w / 2, cy = 400;
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(600);

    const afterWheel = await page.evaluate(() => {
      const els = [...document.querySelectorAll("main *")].filter(e => {
        const cs = getComputedStyle(e);
        return /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2;
      });
      return els.map(e => ({ cls: (e.className || "").toString().slice(0, 70), st: e.scrollTop, max: e.scrollHeight - e.clientHeight }));
    });

    // 2) dokunma surukleme (390 icin anlamlı)
    if (w === 390) {
      await page.touchscreen.tap(cx, cy).catch(() => {});
      await page.evaluate(() => {
        const el = [...document.querySelectorAll("main *")].find(e => {
          const cs = getComputedStyle(e);
          return /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2;
        });
        if (el) el.scrollTop = el.scrollHeight; // zorla dibe
      });
      await page.waitForTimeout(400);
    } else {
      await page.evaluate(() => {
        const el = [...document.querySelectorAll("main *")].find(e => {
          const cs = getComputedStyle(e);
          return /auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2;
        });
        if (el) el.scrollTop = el.scrollHeight;
      });
      await page.waitForTimeout(400);
    }

    const afterForce = await page.evaluate(() => {
      const txt = (el) => (el.innerText || "").replace(/\s+/g, " ").trim();
      const btn = [...document.querySelectorAll("main button")].find(e => /yeni kelime/i.test(txt(e)));
      let r = null;
      if (btn) { const b = btn.getBoundingClientRect(); r = { top: Math.round(b.top), bottom: Math.round(b.bottom) }; }
      // sinav + istatistik butonlari gorunur mu (gorsel olarak)?
      const quiz = [...document.querySelectorAll("main button")].find(e => /sınav|quiz/i.test(txt(e)));
      const stats = [...document.querySelectorAll("main button")].find(e => /istatistik/i.test(txt(e)));
      const vis = (e) => {
        if (!e) return null;
        const b = e.getBoundingClientRect();
        return { top: Math.round(b.top), bottom: Math.round(b.bottom), onScreen: b.bottom <= window.innerHeight && b.top >= 0 };
      };
      return { vh: window.innerHeight, yeniKelime: r, sinav: vis(quiz), istatistik: vis(stats) };
    });

    out[w] = { afterWheel, afterForce };
  }
  return out;
}