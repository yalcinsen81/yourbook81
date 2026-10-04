export default async function run(page, ui) {
  const out = {};
  for (const w of [1280, 390]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({
        id: "qa-local", email: "qa@local.test", displayName: "QA",
        avatarLetter: "Q", isCloud: false, createdAt: Date.now(),
      }));
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    // Masalar ekranina git
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("aside button, aside a")].find(e => /masa/i.test(e.innerText || ""));
      if (b) b.click();
    });
    await page.waitForTimeout(2500);
    out[w] = await page.evaluate(() => {
      const txt = (el) => (el.innerText || "").replace(/\s+/g, " ").trim();
      const btn = [...document.querySelectorAll("main button")].find(e => /yeni kelime/i.test(txt(e)));
      const scrollables = [];
      // main ve atalarindaki kaydirma kaplarini tarama
      const main = document.querySelector("main");
      const chain = [];
      let el = btn?.parentElement;
      while (el && el !== document.body) {
        const cs = getComputedStyle(el);
        if (/auto|scroll/.test(cs.overflowY)) {
          chain.push({
            tag: el.tagName, cls: (el.className || "").toString().slice(0, 90),
            scrollH: el.scrollHeight, clientH: el.clientHeight,
            scrollTop: el.scrollTop, maxScroll: el.scrollHeight - el.clientHeight,
          });
        }
        el = el.parentElement;
      }
      let btnInfo = null, navInfo = null;
      if (btn) {
        const r = btn.getBoundingClientRect();
        btnInfo = { top: Math.round(r.top), bottom: Math.round(r.bottom) };
      }
      const nav = document.querySelector("nav") || [...document.querySelectorAll("div")].find(e => e.className && /fixed/.test(String(e.className)) && /bottom-0|z-40|z-50/.test(String(e.className)));
      if (nav) {
        const r = nav.getBoundingClientRect();
        navInfo = { top: Math.round(r.top), bottom: Math.round(r.bottom) };
      }
      return { btnInfo, navInfo, scrollChain: chain, vh: window.innerHeight };
    });
  }
  return out;
}