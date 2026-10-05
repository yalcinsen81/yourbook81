export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("yourbook_ui_language_v1", "tr");
    localStorage.setItem("yourbook_onboarding_v1", "1");
    localStorage.setItem("yourbook_auth_user_v1", JSON.stringify({ id: "qa-local", email: "qa@local.test", displayName: "Y", avatarLetter: "Y", isCloud: false, createdAt: 1 }));
  });
  await page.reload();
  await page.waitForTimeout(3500);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const out = await page.evaluate(async () => {
    const find = (txt) => [...document.querySelectorAll("aside span")].find((e) => e.textContent.trim().toLowerCase() === txt);
    const desc = (a) => {
      const t = a.effect?.target; const cls = (t?.className?.toString?.() || "").replace(/\s+/g, " ").slice(0, 50);
      return `${a.constructor.name}:${a.transitionProperty || a.animationName || "?"}@${t?.tagName}.${cls} dur=${Math.round(a.effect.getTiming().duration)}`;
    };
    const first = {};
    // soğuk: ilk tıklamada senkron süre kırılımı
    const orig = { now: performance.now.bind(performance) };
    const marks = [];
    const wrap = (obj, name) => { const f = obj[name]; if (typeof f !== "function") return; obj[name] = function (...a) { const t = performance.now(); const r = f.apply(this, a); marks.push(name + ":" + Math.round(performance.now() - t)); return r; }; };
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { const P = AC.prototype; ["createBuffer", "createOscillator", "createBufferSource", "resume"].forEach((n) => wrap(P, n)); }
    const el = find("klasörlenmiş notlar"); const btn = el.closest("button");
    const t0 = performance.now(); btn.click(); first.sync = Math.round(performance.now() - t0); first.audioCalls = marks.slice(0, 8);
    await new Promise((r) => setTimeout(r, 120));
    first.running120 = document.getAnimations().filter((a) => a.playState === "running").map(desc).slice(0, 10);
    await new Promise((r) => setTimeout(r, 600));
    // ikinci tıklama (sıcak)
    const el2 = find("takvim ve ajanda"); marks.length = 0;
    const t1 = performance.now(); el2.closest("button").click(); const sync2 = Math.round(performance.now() - t1); const audio2 = marks.slice(0, 8);
    await new Promise((r) => setTimeout(r, 120));
    const running2 = document.getAnimations().filter((a) => a.playState === "running").map(desc).slice(0, 10);
    return { first, second: { sync: sync2, audio: audio2, running120: running2 } };
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  return out;
}
