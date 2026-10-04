const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ headless: true });
  for (const W of [1024, 1280, 1440, 1600]) {
    const ctx = await b.newContext({ viewport: { width: W, height: 900 } });
    const p = await ctx.newPage();
    await p.goto("http://localhost:5299/", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1500);
    await p.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("yourbook_ui_lang_v1", "tr");
      localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa", email: "q@q.t", displayName: "QA", avatarLetter: "Q", isCloud: false, createdAt: Date.now() }));
    });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForTimeout(5000);

    const r = await p.evaluate(() => {
      const out = { vw: window.innerWidth };
      const aside = document.querySelector("aside");
      out.asideW = aside ? +aside.getBoundingClientRect().width.toFixed(1) : 0;
      const h1 = document.getElementById("hero-headline");
      if (h1) {
        const bb = h1.getBoundingClientRect();
        const lh = parseFloat(getComputedStyle(h1).lineHeight) || 1;
        out.h1 = { w: +bb.width.toFixed(1), h: +bb.height.toFixed(1), fs: getComputedStyle(h1).fontSize, lines: Math.round(bb.height / lh), right: +bb.right.toFixed(1) };
        // sol sutunun genisligi
        const col = h1.parentElement;
        out.leftCol = { w: +col.getBoundingClientRect().width.toFixed(1) };
      }
      // defter paneli (sag sutun) - "DEFTER NO" iceren en yakin blok
      const defter = [...document.querySelectorAll("div")].find((d) => /DEFTER NO/i.test(d.textContent || "") && d.getBoundingClientRect().width > 150 && d.getBoundingClientRect().width < 700);
      if (defter) {
        const bb = defter.getBoundingClientRect();
        out.defter = { x: +bb.x.toFixed(1), w: +bb.width.toFixed(1), right: +bb.right.toFixed(1) };
      }
      // cakisma: h1 sag kenari defter sol kenarini asiyor mu?
      if (out.h1 && out.defter) out.cakisma = out.h1.right > out.defter.x;
      return out;
    });
    console.log("=== " + W + "px ===");
    console.log(JSON.stringify(r));
    await ctx.close();
  }
  await b.close();
})();