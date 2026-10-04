const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ headless: true });
  for (const W of [1024, 1100, 1280]) {
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
      const h1 = document.getElementById("hero-headline");
      const h1b = h1.getBoundingClientRect();
      out.h1 = { left: +h1b.left.toFixed(1), right: +h1b.right.toFixed(1), top: +h1b.top.toFixed(1), bottom: +h1b.bottom.toFixed(1) };

      // Sol sutun ve sag sutun: grid'in dogrudan cocuklari
      const grid = h1.closest(".grid") || h1.parentElement.parentElement;
      const cols = [...grid.children];
      out.gridCols = cols.map((c) => {
        const bb = c.getBoundingClientRect();
        return { cls: (c.className || "").toString().slice(0, 55), x: +bb.x.toFixed(1), w: +bb.width.toFixed(1), right: +bb.right.toFixed(1) };
      });

      // Sag sutunun ilk buyuk cocugu = defter paneli
      if (cols.length > 1) {
        const rightCol = cols[1];
        const bb = rightCol.getBoundingClientRect();
        out.defterPanel = { x: +bb.x.toFixed(1), w: +bb.width.toFixed(1), right: +bb.right.toFixed(1) };
        out.cakisma = h1b.right > bb.x + 1;
        out.bosluk = +(bb.x - h1b.right).toFixed(1);
      }
      // yatay tasma
      out.yatayTasma = document.documentElement.scrollWidth > window.innerWidth;
      return out;
    });
    console.log("=== " + W + "px ===");
    console.log(JSON.stringify(r, null, 1));
    await ctx.close();
  }
  await b.close();
})();