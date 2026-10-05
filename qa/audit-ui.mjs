// Genel arayüz taraması: taşma, kesilen metin, etiketsiz kontrol, küçük dokunma hedefi, başlık yapısı.
export default async function run(page) {
  const base = page.url().split("?")[0];
  const views = ["hero", "cards", "notes", "daily", "journal", "collections", "work", "calendar", "youtube"];
  const viewports = [[390, 844], [768, 1024], [1440, 900]];
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 140)); });
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 140)));
  const seed = (lang, theme) => page.evaluate(([lg, th]) => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", lg);
    localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Yalçın", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
    if (th) localStorage.setItem("superr_theme_v1", th);
  }, [lang, theme]);
  const check = () => page.evaluate(() => {
    const vw = innerWidth;
    const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05; };
    const name = (e) => (e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") || e.title || e.textContent || e.getAttribute("alt") || e.getAttribute("placeholder") || "").trim();
    const short = (e) => `${e.tagName.toLowerCase()}.${(e.className?.toString?.() || "").split(/\s+/).slice(0, 3).join(".")}`.slice(0, 70);
    const res = {};
    res.hScroll = document.documentElement.scrollWidth - vw;
    const off = [...document.querySelectorAll("body *")].filter((e) => vis(e) && getComputedStyle(e).position !== "fixed" && e.getBoundingClientRect().right > vw + 3 && !e.closest("[aria-hidden='true']") && !e.closest("svg")).slice(0, 4).map(short);
    res.offscreen = off;
    res.clipped = [...document.querySelectorAll("span,p,h1,h2,h3,button,label,a")].filter((e) => vis(e) && e.children.length === 0 && e.scrollWidth > e.clientWidth + 3 && !/ellipsis/.test(getComputedStyle(e).textOverflow) && /hidden|clip/.test(getComputedStyle(e).overflowX)).slice(0, 4).map((e) => short(e) + "«" + e.textContent.trim().slice(0, 24) + "»");
    res.unlabeled = [...document.querySelectorAll("button,a[href],input,select,textarea,[role=button]")].filter((e) => vis(e) && !name(e) && e.type !== "hidden").slice(0, 5).map(short);
    res.imgNoAlt = [...document.querySelectorAll("img")].filter((e) => vis(e) && !e.hasAttribute("alt")).length;
    const small = [...document.querySelectorAll("button,a[href],[role=button],input[type=checkbox],select")].filter((e) => { if (!vis(e)) return false; const r = e.getBoundingClientRect(); return (r.width < 32 || r.height < 32); });
    res.smallTargets = small.length;
    res.h1 = document.querySelectorAll("h1").length;
    res.title = document.title.slice(0, 40);
    res.lang = document.documentElement.lang + "/" + document.documentElement.dir;
    return res;
  });
  const results = [];
  for (const [lang, theme, vps] of [["tr", "", viewports], ["tr", "theme-night", [[390, 844], [1440, 900]]], ["ar", "", [[390, 844], [1440, 900]]]]) {
    for (const [w, h] of vps) {
      await page.setViewportSize({ width: w, height: h });
      await seed(lang, theme);
      for (const v of views) {
        await page.goto(base + "?view=" + v);
        await page.waitForTimeout(1300);
        const r = await check();
        const issues = [];
        if (r.hScroll > 2) issues.push("yatay kayma +" + r.hScroll + "px");
        if (r.offscreen.length) issues.push("taşan: " + r.offscreen.join(" | "));
        if (r.clipped.length) issues.push("kesilen: " + r.clipped.join(" | "));
        if (r.unlabeled.length) issues.push("etiketsiz: " + r.unlabeled.join(" | "));
        if (r.imgNoAlt) issues.push("alt'sız img: " + r.imgNoAlt);
        if (w < 1024 && r.smallTargets > 0) issues.push("küçük hedef(<32px): " + r.smallTargets);
        if (r.h1 !== 1) issues.push("h1 sayısı: " + r.h1);
        results.push(`[${lang}${theme ? "/gece" : ""} ${w}] ${v}: ${issues.length ? issues.join("  ;  ") : "temiz"}  (${r.lang}, ${r.title})`);
      }
    }
  }
  return { errors: [...new Set(errors)].slice(0, 10), results };
}
