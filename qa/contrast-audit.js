// Tarayıcı konsolunda / javascript_tool ile çalıştırılır: görünür düğme ve metinlerin yazı-zemin kontrastını ölçer.
// Eşik altındakileri döndürür. Kullanım: sayfada yapıştır, sonuç JSON'dur.
(() => {
  const parse = (c) => { const m = c.match(/[\d.]+/g); return m ? m.map(Number) : null; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && (c.length < 4 || c[3] > 0.9)) return c.slice(0, 3);
    }
    return [255, 255, 255];
  };
  const out = [];
  const seen = new Set();
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 4 && r.height > 4 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.3; };
  for (const el of document.querySelectorAll("button, a, [role=button], svg, h1, h2, h3, p, span, label")) {
    if (!visible(el)) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    const isIcon = el.tagName.toLowerCase() === "svg";
    if (!own && !isIcon) continue;
    const cs = getComputedStyle(el);
    const fg = parse(isIcon ? cs.color : cs.color);
    if (!fg) continue;
    const bg = bgOf(el);
    const r = ratio(fg.slice(0, 3), bg);
    const size = parseFloat(cs.fontSize);
    const min = isIcon ? 3 : (size >= 18 ? 3 : 4.5);
    if (r < min) {
      const label = (el.getAttribute("aria-label") || el.title || el.textContent || el.parentElement?.title || "").trim().slice(0, 40);
      const key = el.tagName + label + r.toFixed(1);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ tag: el.tagName, label, ratio: Number(r.toFixed(2)), fg: cs.color, bg: `rgb(${bg.join(",")})` });
    }
  }
  return JSON.stringify(out.sort((a, b) => a.ratio - b.ratio).slice(0, 25));
})();
