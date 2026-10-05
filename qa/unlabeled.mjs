// Etiketsiz (erişilebilir adı olmayan) etkileşimli öğeleri HTML parçasıyla listeler.
export default async function run(page) {
  const base = page.url().split("?")[0];
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Y", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
  });
  const out = {};
  for (const v of ["cards", "notes", "daily", "journal", "collections", "work", "calendar", "youtube"]) {
    await page.goto(base + "?view=" + v); await page.waitForTimeout(1300);
    out[v] = await page.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
      const nm = (e) => (e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") || e.title || e.textContent || e.getAttribute("placeholder") || "").trim();
      return [...document.querySelectorAll("button,a[href],input,select,textarea,[role=button]")]
        .filter((e) => vis(e) && !nm(e) && e.type !== "hidden")
        .map((e) => e.outerHTML.replace(/\s+/g, " ").replace(/class="[^"]{70,}"/, (m) => m.slice(0, 70) + '…"').slice(0, 210));
    });
  }
  return out;
}
