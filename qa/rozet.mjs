export default async function run(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Y", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
  });
  await page.reload(); await page.waitForTimeout(2000);
  const info = await page.evaluate(() => {
    const el = [...document.querySelectorAll("span,div")].find((e) => e.children.length === 0 && /kapak rozetleri/i.test(e.textContent));
    el?.scrollIntoView({ block: "center" });
    const cards = [...document.querySelectorAll(".postit-card")].map((c) => { const r = c.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right)]; });
    const parent = document.querySelector(".postit-card")?.parentElement;
    return { vw: innerWidth, cards, parentOverflow: parent ? getComputedStyle(parent).overflowX : null, parentW: parent ? Math.round(parent.getBoundingClientRect().width) : null };
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "docs/design/w1-m-rozet.png" });
  return info;
}
