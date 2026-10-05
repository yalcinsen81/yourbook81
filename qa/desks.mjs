// Taze veriyle sol bandın "dil masaları" grubunu açar, listelenen masaları ve etiketi döker.
export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Y", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
    localStorage.setItem("yourbook_desks_group_open_v1", "1");
  });
  await page.reload(); await page.waitForTimeout(2500);
  return await page.evaluate(() => {
    const aside = document.querySelector("aside");
    const items = [...aside.querySelectorAll("button")].map((b) => b.textContent.trim().replace(/\s+/g, " ")).filter((t) => /masası|masa|desk|tisch/i.test(t));
    const heroLabel = [...document.querySelectorAll("span,div,p")].find((e) => e.children.length === 0 && /dil masası/.test(e.textContent) && !aside.contains(e));
    return { groupItems: items.slice(0, 12), heroLabel: heroLabel?.textContent.trim(), spacesStorage: localStorage.getItem("craft_custom_spaces_v1") };
  });
}
