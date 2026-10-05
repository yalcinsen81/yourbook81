export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("yourbook_ui_language_v1","tr"); localStorage.setItem("yourbook_onboarding_v1","1"); localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({id:"qa-local",email:"qa@local.test",displayName:"Y",avatarLetter:"Y",isCloud:false,createdAt:1})); });
  await page.reload(); await page.waitForTimeout(2200);
  return await page.evaluate(() => {
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { left: +b.left.toFixed(1), top: +b.top.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; };
    const toggle = document.querySelector("[data-sidebar-toggle]");
    const plus = [...document.querySelectorAll("button")].find((e) => e.title === "Takvim ve Ajandayı Aç");
    const logo = document.querySelector('[data-nav="hero"]');
    return { toggle: r(toggle), plus: r(plus), logo: r(logo), toggleStyle: toggle?.getAttribute("style"), toggleCls: toggle?.className.slice(0, 160) };
  });
}
