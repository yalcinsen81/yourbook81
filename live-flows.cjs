const { chromium } = require("playwright");

const URL = "https://yourbook-app.vercel.app/";
const OUT = "C:/Users/yalci/CodeGPT/saas-project-2-2";
const L = (s) => console.log(s);

const SEED = () => {
  localStorage.clear();
  localStorage.setItem("yourbook_ui_lang_v1", "tr");
  localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "QA", avatarLetter: "Q", isCloud: false, createdAt: Date.now() }));
  const now = Date.now();
  localStorage.setItem("yourbook_deck_v7_clean", JSON.stringify([
    { id: "c1", lang: "DE", word: "nehmen", translation: "almak", note: "", tags: [], createdAt: now, learnedAt: null, reviewAt: null, grammar: [] },
    { id: "c2", lang: "DE", word: "Geduld", translation: "sabır", note: "", tags: [], createdAt: now, learnedAt: null, reviewAt: null, grammar: [] },
  ]));
  localStorage.setItem("lexi_engagement_v1", JSON.stringify({ xp: 420, streak: 5 }));
};

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const bad = [];
  p.on("response", (r) => { if (r.status() >= 400) bad.push(r.status() + " " + r.url().split("?")[0].slice(0, 90)); });
  p.on("pageerror", (e) => bad.push("PAGEERROR " + String(e).slice(0, 120)));

  await p.goto(URL, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2000);
  await p.evaluate(SEED);
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.waitForTimeout(7000);

  // --- TEST 1: Ctrl+K KOMUT PALETI ---
  L("### TEST 1: Ctrl+K");
  await p.mouse.click(700, 400); // odagi govdeye al
  await p.waitForTimeout(400);
  await p.keyboard.press("Control+k");
  await p.waitForTimeout(2000);
  const pal = await p.evaluate(() => {
    const dialogs = [...document.querySelectorAll("[role=dialog], [role=listbox], [data-cmdk], [cmdk-root]")];
    const inps = [...document.querySelectorAll("input")].filter((e) => e.offsetParent !== null);
    const bodyHas = /komut|ara veya komut|ne yapmak/i.test(document.body.innerText);
    // input'un gercekten gorunur oldugunu elementFromPoint ile dogrula
    let inputHit = null;
    if (inps.length) {
      const bb = inps[0].getBoundingClientRect();
      const cx = Math.round(bb.left + bb.width / 2), cy = Math.round(bb.top + bb.height / 2);
      const h = document.elementFromPoint(cx, cy);
      inputHit = h ? (h === inps[0] || inps[0].contains(h)) : false;
    }
    return { dialogSayisi: dialogs.length, gorunurInput: inps.length, metindeKomut: bodyHas, inputTiklanabilir: inputHit };
  });
  L("  palet: " + JSON.stringify(pal));
  await p.screenshot({ path: OUT + "/T-cmdk.png" });
  await p.keyboard.press("Escape");
  await p.waitForTimeout(1200);

  // --- TEST 2: MASA AC (hero butonu) ---
  L("\n### TEST 2: Masa ac (hero 'defteri ac & calis')");
  const clicked = await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const b2 = btns.find((x) => /defteri aç|çalış/i.test(x.textContent || ""));
    if (b2) { b2.click(); return (b2.textContent || "").trim().slice(0, 35); }
    return "buton yok: " + btns.slice(0, 6).map((x) => (x.textContent || "").trim().slice(0, 18)).join(" | ");
  });
  L("  tiklanan: " + clicked);
  await p.waitForTimeout(5000);
  await p.screenshot({ path: OUT + "/T-masa.png" });

  const masaDurum = await p.evaluate(() => {
    const txt = document.body.innerText.replace(/\n+/g, " | ");
    const btns = [...new Set([...document.querySelectorAll("button")].map((x) => (x.textContent || "").trim()).filter((s) => s && s.length < 28))];
    // kart alani: en buyuk article veya kelime iceren buyuk blok
    const kart = document.querySelector("article");
    const kartR = kart ? kart.getBoundingClientRect() : null;
    // "yeni kelimeler N" sayaci
    const sayac = (txt.match(/yeni kelimeler[:\s]*(\d+)/i) || [])[1];
    return {
      metin: txt.slice(0, 240),
      sayac: sayac,
      kart: kartR ? { w: +kartR.width.toFixed(0), h: +kartR.height.toFixed(0) } : null,
      ogrenBtn: btns.filter((s) => /öğrendim|hatırlayamadım/i.test(s)),
      butonlar: btns.slice(0, 14),
    };
  });
  L("  sayac: " + masaDurum.sayac);
  L("  kart: " + JSON.stringify(masaDurum.kart));
  L("  ogrenme butonlari: " + JSON.stringify(masaDurum.ogrenBtn));
  L("  ekran: " + masaDurum.metin.slice(0, 200));

  // --- TEST 3: KELIME EKLEME ---
  L("\n### TEST 3: Kelime ekleme");
  const addForm = await p.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const b3 = btns.find((x) => /kelime ekle|yeni kelime/i.test(x.textContent || ""));
    if (b3) { b3.click(); return (b3.textContent || "").trim().slice(0, 30); }
    return null;
  });
  L("  'kelime ekle' butonu: " + addForm);
  await p.waitForTimeout(2500);

  const fields = await p.evaluate(() => {
    return [...document.querySelectorAll("input, textarea")]
      .filter((e) => e.offsetParent !== null)
      .map((e, i) => ({ i, tag: e.tagName, ph: (e.placeholder || "").slice(0, 30) }));
  });
  L("  alanlar: " + JSON.stringify(fields));

  if (addForm && fields.length >= 2) {
    const inputs = await p.$$("input:visible, textarea:visible");
    if (inputs[0]) await inputs[0].fill("Prüfung");
    if (inputs[1]) await inputs[1].fill("sınav");
    await p.waitForTimeout(600);
    const saved = await p.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const b4 = btns.find((x) => /deftere ekle|kaydet|ekle/i.test(x.textContent || "") && !/kelime ekle/i.test(x.textContent || ""));
      if (b4) { b4.click(); return (b4.textContent || "").trim().slice(0, 25); }
      return "kaydet butonu yok";
    });
    L("  kaydet butonu: " + saved);
    await p.waitForTimeout(2500);
    const after = await p.evaluate(() => {
      const raw = localStorage.getItem("yourbook_deck_v7_clean");
      let n = null, found = false;
      try { const arr = JSON.parse(raw || "[]"); n = arr.length; found = arr.some((c) => /prüfung/i.test(c.word || "")); } catch { }
      return { kartSayisi: n, pruefungEklendi: found };
    });
    L("  SONUC: " + JSON.stringify(after));
    await p.screenshot({ path: OUT + "/T-kelime-ekle.png" });
  }

  // --- TEST 4: TEMA DEGISIMI ---
  L("\n### TEST 4: Tema degisimi (performans)");
  const theme = await p.evaluate(async () => {
    const aside = document.querySelector("aside");
    if (!aside) return { hata: "aside yok" };
    // tema butonlari: aria-label veya title "tema" iceren, ya da renk dairesi iceren
    let btns = [...aside.querySelectorAll("button")].filter((x) => /tema|theme/i.test((x.getAttribute("aria-label") || "") + (x.getAttribute("title") || "")));
    if (!btns.length) {
      // renk dairesi olan butonlar
      btns = [...aside.querySelectorAll("button")].filter((x) => x.querySelector("span[style*='background-color'], span[style*='background:']"));
    }
    if (!btns.length) return { hata: "tema butonu bulunamadi", asideBtn: aside.querySelectorAll("button").length };
    const before = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
    const times = [];
    for (let i = 0; i < 4; i++) {
      const btn = btns[i % btns.length];
      const t0 = performance.now();
      btn.click();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      times.push(Math.round(performance.now() - t0));
      await new Promise((r) => setTimeout(r, 450));
    }
    const after = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
    const sorted = [...times].sort((a, b) => a - b);
    return { temaSayisi: btns.length, ms: times, medyan: sorted[Math.floor(sorted.length / 2)], inkDegisti: before !== after, inkOnce: before, inkSonra: after };
  });
  L("  " + JSON.stringify(theme));

  // --- TEST 5: SAGLIK ---
  L("\n### TEST 5: Saglik");
  L("  hatali istek / sayfa hatasi: " + bad.length + " " + JSON.stringify([...new Set(bad)].slice(0, 4)));
  L("  yatay tasma: " + await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));

  await b.close();
})();