// Panel gizliyken "›" düğmesi sayfa içeriğiyle çakışıyor mu? Her görünüm için kesişen metin öğelerini listeler.
export default async function run(page) {
  const base = page.url().split("?")[0];
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_sidebar_hidden_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Y", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
  });
  const out = {};
  for (const v of ["hero", "cards", "notes", "daily", "journal", "collections", "work", "calendar", "youtube"]) {
    await page.goto(base + "?view=" + v); await page.waitForTimeout(1400);
    out[v] = await page.evaluate(() => {
      const t = document.querySelector("[data-sidebar-toggle]");
      if (!t) return "düğme yok";
      const b = t.getBoundingClientRect();
      const hits = [];
      for (const e of document.querySelectorAll("main *")) {
        if (e.children.length > 0 && !/^(SPAN|H1|H2|H3|P|BUTTON|A|LABEL)$/.test(e.tagName)) continue;
        const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!own && e.tagName !== "svg" && e.tagName !== "INPUT") continue;
        const r = e.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top) hits.push(e.tagName.toLowerCase() + ":" + (e.textContent || e.getAttribute("placeholder") || "").trim().slice(0, 22));
      }
      return { toggle: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)], hits: hits.slice(0, 4) };
    });
  }
  return out;
}
