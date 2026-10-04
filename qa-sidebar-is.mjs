export default async function run(page, ui) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem(
      "yourbook_auth_user_v1",
      JSON.stringify({
        id: "qa-local", email: "qa@local.test", displayName: "QA",
        avatarLetter: "Q", isCloud: false, createdAt: Date.now(),
      }),
    );
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  return await page.evaluate(() => {
    const aside = document.querySelector("aside");
    if (!aside) return { error: "aside yok" };

    // Sidebar'daki TUM metin dugumlerini gez; "İŞ"/"iş" icerenleri bul
    const hits = [];
    const walk = (root) => {
      const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = it.nextNode())) {
        const t = (n.textContent || "").trim();
        if (t && /^(İŞ|iş|İş)$/i.test(t)) {
          let el = n.parentElement;
          const chain = [];
          for (let d = 0; d < 4 && el; d++) {
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            chain.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.className || "").toString().slice(0, 150),
              bg: cs.backgroundColor,
              color: cs.color,
              border: cs.border,
              radius: cs.borderRadius,
              font: cs.fontFamily.split(",")[0],
              fs: cs.fontSize,
              text: (el.innerText || "").replace(/\s+/g, " ").slice(0, 40),
              box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
            });
            el = el.parentElement;
          }
          hits.push({ text: t, chain });
        }
      }
    };
    walk(aside);

    // Sidebar'daki tum kisa etiketlerin (menu ogeleri) gorunumu
    const items = [];
    aside.querySelectorAll("button, a").forEach((el) => {
      const t = (el.innerText || "").replace(/\s+/g, " ").trim();
      if (!t || t.length > 26) return;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 12) return;
      items.push({
        text: t.slice(0, 26),
        bg: cs.backgroundColor,
        color: cs.color,
        fw: cs.fontWeight,
        box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
      });
    });

    return { isHits: hits, menuItems: items.slice(0, 22) };
  });
}