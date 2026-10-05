// Dış yazı tipi isteği var mı + azaltılmış harekette sonsuz animasyonlar duruyor mu?
export default async function run(page) {
  const base = page.url().split("?")[0];
  await page.setViewportSize({ width: 1440, height: 900 });
  const reqs = [];
  page.on("request", (r) => reqs.push(r.url()));
  const seed = () => page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Y", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
  });
  const probe = async () => {
    await page.waitForTimeout(2500);
    return await page.evaluate(async () => {
      const els = [...document.querySelectorAll("body *")];
      const snap = () => els.map((e) => getComputedStyle(e).transform);
      const s0 = snap(); await new Promise((r) => setTimeout(r, 700));
      const s1 = snap(); await new Promise((r) => setTimeout(r, 700));
      const s2 = snap();
      const moving = els.filter((e, i) => s0[i] !== s1[i] || s1[i] !== s2[i]);
      return { movingElements: moving.length, sample: moving.slice(0, 4).map((e) => e.tagName.toLowerCase() + "." + (e.className?.baseVal ?? e.className ?? "").toString().split(" ").slice(0, 2).join(".")) };
        });
  };
  const out = {};
  await seed();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(base);
  out.normal = await probe();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base);
  out.reduced = await probe();
  out.externalFontRequests = reqs.filter((u) => /fonts\.googleapis|fonts\.gstatic/.test(u));
  out.fontFilesLoaded = [...new Set(reqs.filter((u) => /\.woff2?$/.test(u)).map((u) => u.split("/").pop().replace(/-[A-Za-z0-9_]{6,10}\.woff2?$/, "")))].sort();
  return out;
}
