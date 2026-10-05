export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("yourbook_ui_language_v1","tr"); localStorage.setItem("yourbook_onboarding_v1","1"); localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({id:"qa-local",email:"qa@local.test",displayName:"Y",avatarLetter:"Y",isCloud:false,createdAt:1})); });
  await page.reload(); await page.waitForTimeout(2500);
  const m = await page.evaluate(() => {
    const top = (e) => e ? Math.round(e.getBoundingClientRect().top + scrollY) : null;
    const bot = (e) => e ? Math.round(e.getBoundingClientRect().bottom + scrollY) : null;
    const ritual = document.querySelector('[class*="border-[var(--line)]"][class*="backdrop-blur"]');
    const card = [...document.querySelectorAll("div")].find((d) => /max-w-\[380px\]/.test(d.className) && /p-5/.test(d.className));
    const panels = [...document.querySelectorAll("h3")].find((h) => /kelime masaları/i.test(h.textContent))?.closest("div[class*='card'], div[class*='rounded']");
    return { ritualTop: top(ritual), cardTop: top(card), cardBottom: bot(card), panelsTop: top(panels) };
  });
  await page.screenshot({ path: "docs/design/h2-hero.png", fullPage: true });
  return m;
}
