const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    hasTouch: true, isMobile: true, deviceScaleFactor: 2,
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

  const r = await p.evaluate(() => {
    const out = { vh: window.innerHeight };
    const q = (sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect() : null; };
    const hdr = q("header"); out.header = hdr ? { h: +hdr.height.toFixed(1), bottom: +hdr.bottom.toFixed(1) } : null;
    const nav = q("nav"); out.nav = nav ? { h: +nav.height.toFixed(1), top: +nav.top.toFixed(1) } : null;
    out.icAlan = out.header && out.nav ? +(out.nav.top - out.header.bottom).toFixed(1) : null;

    const h1 = document.getElementById("hero-headline");
    if (h1) { const bb = h1.getBoundingClientRect(); out.baslik = { top: +bb.top.toFixed(1), bottom: +bb.bottom.toFixed(1), h: +bb.height.toFixed(1) }; }

    // gulen yuz + el yazisi grubunun en ust noktasi = hero baslangici
    const smiley = [...document.querySelectorAll("svg")].find((s) => { const bb = s.getBoundingClientRect(); return bb.width > 30 && bb.width < 80 && bb.top > 200; });
    if (smiley) { const bb = smiley.getBoundingClientRect(); out.greetingUst = +bb.top.toFixed(1); }

    // giris paragrafi
    const par = [...document.querySelectorAll("p")].find((x) => /muhteşem|öğrenmek/i.test(x.textContent || "") && x.getBoundingClientRect().width > 150);
    if (par) { const bb = par.getBoundingClientRect(); out.giris = { top: +bb.top.toFixed(1), bottom: +bb.bottom.toFixed(1), h: +bb.height.toFixed(1) }; }

    // ilk aksiyon karti (masa/kart) - article veya "masa" iceren buton
    const kart = document.querySelector("article");
    if (kart) { const bb = kart.getBoundingClientRect(); out.ilkKart = { top: +bb.top.toFixed(1) }; }
    // "defter hediye et" gibi aksiyonlarin altinda kalan gercek icerik
    const deskBtn = [...document.querySelectorAll("button")].find((x) => /masasını aç|masayı aç|çalışmaya başla/i.test(x.textContent || ""));
    if (deskBtn) { const bb = deskBtn.getBoundingClientRect(); out.ilkAksiyon = { text: (deskBtn.textContent || "").trim().slice(0, 30), top: +bb.top.toFixed(1), ekranda: bb.top < window.innerHeight }; }

    // hero'nun toplam yuksekligi: gulen yuzden giris metninin altina
    if (out.greetingUst && out.giris) out.heroYuksekligi = +(out.giris.bottom - out.greetingUst).toFixed(1);
    out.heroEkranOrani = out.heroYuksekligi && out.vh ? +(out.heroYuksekligi / out.vh * 100).toFixed(0) + "%" : null;
    out.docH = document.body.scrollHeight;
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();