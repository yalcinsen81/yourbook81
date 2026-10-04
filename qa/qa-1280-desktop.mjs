export default async function run(page, ui) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(2500);

  // Oturum: login ekranini atla
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      "yourbook_auth_user_v1",
      JSON.stringify({
        id: "qa-local",
        email: "qa@local.test",
        displayName: "QA",
        avatarLetter: "Q",
        isCloud: false,
        createdAt: Date.now(),
      }),
    );
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const report = await page.evaluate(() => {
    const out = { vw: window.innerWidth, vh: window.innerHeight };
    const txt = (el) => (el ? el.innerText.replace(/\s+/g, " ").trim() : null);

    // 1) BASLIK (h1)
    const h1 = document.querySelector("h1");
    if (h1) {
      const r = h1.getBoundingClientRect();
      const cs = getComputedStyle(h1);
      out.h1 = {
        text: txt(h1).slice(0, 80),
        fs: cs.fontSize,
        lh: cs.lineHeight,
        h: Math.round(r.height),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        left: Math.round(r.left),
        right: Math.round(r.right),
        // gercek satir sayisi
        lines: Math.round(r.height / parseFloat(cs.lineHeight)),
      };
    }

    // 2) DEFTER PANELI (hero'daki kart) — baslikla kesisiyor mu?
    const all = [...document.querySelectorAll("main *")];
    const defEl = all.find((el) => {
      const t = txt(el);
      return t && /defter|notebook|masa/i.test(t) && el.getBoundingClientRect().width > 200;
    });

    // baslik ile kesisen elemanlari bul (sadece anlamli olanlar)
    const overlaps = [];
    if (h1) {
      const hr = h1.getBoundingClientRect();
      all.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 60 || r.height < 20) return;
        if (el === h1 || h1.contains(el) || el.contains(h1)) return;
        const ox = Math.min(hr.right, r.right) - Math.max(hr.left, r.left);
        const oy = Math.min(hr.bottom, r.bottom) - Math.max(hr.top, r.top);
        if (ox > 4 && oy > 4) {
          const t = txt(el);
          if (t && t.length > 2) {
            overlaps.push({
              text: t.slice(0, 40),
              ox: Math.round(ox),
              oy: Math.round(oy),
              x: Math.round(r.left),
              y: Math.round(r.top),
            });
          }
        }
      });
    }
    // en buyuk kesisen 5
    overlaps.sort((a, b) => b.ox * b.oy - a.ox * a.oy);
    out.h1Overlaps = overlaps.slice(0, 5);

    // 3) SIDEBAR etiket kirpilma testi
    const aside = document.querySelector("aside");
    if (aside) {
      const links = [...aside.querySelectorAll("a, button")];
      const clipped = [];
      links.forEach((el) => {
        const t = txt(el);
        if (!t || t.length < 6) return;
        if (el.scrollWidth > el.clientWidth + 1) {
          clipped.push({
            text: t.slice(0, 30),
            scrollW: el.scrollWidth,
            clientW: el.clientWidth,
          });
        }
      });
      out.sidebarClipped = clipped.slice(0, 6);
    }

    // 4) Yatay tasma
    out.hOverflow =
      document.documentElement.scrollWidth > window.innerWidth
        ? {
            scrollW: document.documentElement.scrollWidth,
            innerW: window.innerWidth,
          }
        : false;

    return out;
  });

  return report;
}