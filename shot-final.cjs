const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ headless: true });
  const OUT = "C:/Users/yalci/CodeGPT/saas-project-2-2";
  for (const W of [1024, 1280, 390]) {
    const ctx = await b.newContext({
      viewport: { width: W, height: W < 700 ? 844 : 900 },
      userAgent: W < 700 ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" : undefined,
      hasTouch: W < 700,
      isMobile: W < 700,
      deviceScaleFactor: 2,
    });
    const p = await ctx.newPage();
    await p.goto("http://localhost:5299/", { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1500);
    await p.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("yourbook_ui_lang_v1", "tr");
      localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa", email: "q@q.t", displayName: "QA", avatarLetter: "Q", isCloud: false, createdAt: Date.now() }));
      const now = Date.now();
      localStorage.setItem("yourbook_deck_v7_clean", JSON.stringify([
        { id: "c1", lang: "EN", word: "resilience", translation: "dayanıklılık", note: "", tags: [], createdAt: now, learnedAt: null, reviewAt: null, grammar: [] },
        { id: "c2", lang: "DE", word: "nehmen", translation: "almak", note: "", tags: [], createdAt: now, learnedAt: null, reviewAt: null, grammar: [] },
      ]));
      localStorage.setItem("lexi_engagement_v1", JSON.stringify({ xp: 420, streak: 5 }));
    });
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForTimeout(6000);
    await p.screenshot({ path: OUT + "/SON-" + W + "-ana.png" });
    console.log(W + "px alindi");
    await ctx.close();
  }
  await b.close();
})();