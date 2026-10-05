// İkinci tarama: dokunmatik hedefler (pointer: coarse), klavye ile gezinme, günlük PIN akışı, hediye penceresi.
export default async function run(page) {
  const base = page.url().split("?")[0];
  const out = {};
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 120)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 120)); });
  const seed = () => page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Yalçın", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
  });

  // 1) Dokunmatik emülasyon: (pointer: coarse) açıkken küçük hedefler
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "pointer", value: "coarse" }, { name: "hover", value: "none" }] });
  const touch = {};
  for (const [w, h] of [[390, 844], [768, 1024]]) {
    await page.setViewportSize({ width: w, height: h });
    await seed();
    for (const v of ["hero", "cards", "daily", "journal", "calendar", "youtube"]) {
      await page.goto(base + "?view=" + v); await page.waitForTimeout(1200);
      const r = await page.evaluate(() => {
        const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
        const small = [...document.querySelectorAll("button,a[href],[role=button],select,input:not([type=hidden])")].filter((e) => vis(e) && (e.getBoundingClientRect().width < 40 || e.getBoundingClientRect().height < 40));
        return { coarse: matchMedia("(pointer: coarse)").matches, small: small.length, sample: small.slice(0, 3).map((e) => e.tagName.toLowerCase() + "." + (e.className?.toString?.() || "").split(" ").slice(0, 2).join(".") + " " + Math.round(e.getBoundingClientRect().width) + "x" + Math.round(e.getBoundingClientRect().height)) };
      });
      touch[`${w}/${v}`] = `coarse=${r.coarse} <40px:${r.small}${r.small ? " " + r.sample.join(" | ") : ""}`;
    }
  }
  out.touchTargets = touch;
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "pointer", value: "fine" }, { name: "hover", value: "hover" }] });

  // 2) Klavye: Tab ile ilk 14 odak, görünür odak halkası
  await page.setViewportSize({ width: 1440, height: 900 });
  await seed(); await page.goto(base); await page.waitForTimeout(1800);
  const focusTrail = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    focusTrail.push(await page.evaluate(() => {
      const e = document.activeElement; if (!e || e === document.body) return "body";
      const cs = getComputedStyle(e);
      const name = (e.getAttribute("aria-label") || e.title || e.textContent || e.tagName).trim().replace(/\s+/g, " ").slice(0, 22);
      return `${name} [outline:${cs.outlineStyle === "none" ? "yok" : cs.outlineWidth}]`;
    }));
  }
  out.tabOrder = focusTrail;
  out.focusWithoutRing = focusTrail.filter((t) => /outline:yok/.test(t)).length;

  // 3) Günlük PIN akışı
  await seed(); await page.goto(base + "?view=journal"); await page.waitForTimeout(1800);
  const pinFlow = [];
  try {
  await page.getByRole("button", { name: /PIN/i }).first().click(); await page.waitForTimeout(500);
  const pinInput = page.locator('input[type="password"], input[inputmode="numeric"]').first();
  pinFlow.push("pin penceresi açıldı: " + (await pinInput.count() > 0));
  await pinInput.fill("1234");
  await page.getByRole("button", { name: /kaydet|belirle|kilitle/i }).last().click(); await page.waitForTimeout(500);
  pinFlow.push("pin kayıtlı: " + (await page.evaluate(() => !!localStorage.getItem("yourbook_journal_pin_v1"))));
  await page.reload(); await page.waitForTimeout(1800);
  pinFlow.push("yenilemede kilit ekranı: " + (await page.evaluate(() => /günlük kilitli/i.test(document.body.innerText))));
  await page.locator('input[type="password"]').first().fill("0000");
  await page.keyboard.press("Enter"); await page.waitForTimeout(400);
  pinFlow.push("yanlış PIN reddedildi: " + (await page.evaluate(() => /günlük kilitli/i.test(document.body.innerText))));
  await page.locator('input[type="password"]').first().fill("1234");
  await page.keyboard.press("Enter"); await page.waitForTimeout(600);
  pinFlow.push("doğru PIN açtı: " + (await page.evaluate(() => !/günlük kilitli/i.test(document.body.innerText))));
  } catch (e) { pinFlow.push("HATA: " + String(e.message).slice(0, 140)); }
  out.pinFlow = pinFlow;

  // 4) Hediye penceresi
  await seed(); await page.goto(base); await page.waitForTimeout(1800);
  try { await page.getByRole("button", { name: /defter hediye/i }).first().click({ timeout: 8000 }); await page.waitForTimeout(700); } catch (e) { out.giftErr = String(e.message).slice(0, 140); }
  out.gift = await page.evaluate(() => { const d = document.querySelector('[data-qa-modal="gift-notebook"]'); return d ? { text: d.innerText.replace(/\s+/g, " ").slice(0, 160), hasLink: /yourbook|http/.test(d.innerText) } : "modal yok"; });
  out.errors = [...new Set(errors)].slice(0, 6);
  return out;
}
