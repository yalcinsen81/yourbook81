export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Yalçın", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
  });
  await page.reload();
  await page.waitForTimeout(2500);
  const probe = () => page.evaluate(() => {
    const pills = [...document.querySelectorAll("aside [class*='-z-10']")].map((e) => {
      const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return { rect: [r.left, r.top, r.width, r.height].map(Math.round), opacity: cs.opacity, transform: cs.transform.slice(0, 40), bg: cs.backgroundColor, display: cs.display };
    });
    return pills;
  });
  const out = { hero: await probe() };
  await page.evaluate(() => {
    const el = [...document.querySelectorAll("aside span")].find((e) => e.textContent.trim() === "günlük notlar ve görevler");
    (el.closest("button") || el).click();
  });
  for (const ms of [50, 300, 1200, 3000]) {
    await page.waitForTimeout(ms === 50 ? 50 : ms - (ms === 300 ? 50 : ms === 1200 ? 300 : 1200));
    out["t" + ms] = await probe();
  }
  const mr = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  out.reducedMotion = mr;
  return out;
}
