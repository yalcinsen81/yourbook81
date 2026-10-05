// Çeviri denetimi: dilde değeri Türkçe kaynakla AYNI kalan (çevrilmemiş) uzun metinleri sayar.
import fs from "fs";
const load = (code) => {
  const d = {};
  for (const f of [`src/i18n/locales/${code}.ts`, `src/i18n/locales/${code}-extra.ts`]) {
    if (!fs.existsSync(f)) continue;
    for (const m of fs.readFileSync(f, "utf8").matchAll(/^\s*"([^"]+)":\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)) d[m[1]] = m[2];
  }
  return d;
};
const tr = load("tr");
const TR_CHARS = /[çğıöşüÇĞİÖŞÜ]/;
const rows = [];
for (const code of ["en", "de", "es", "fr", "it", "pt", "nl", "ru", "ar"]) {
  const d = load(code);
  const keys = Object.keys(tr);
  const missing = keys.filter((k) => !(k in d)).length;
  const same = keys.filter((k) => k in d && d[k] === tr[k] && tr[k].length > 14 && TR_CHARS.test(tr[k]));
  const sameAny = keys.filter((k) => k in d && d[k] === tr[k] && tr[k].length > 14);
  rows.push(`${code}: anahtar ${Object.keys(d).length}/${keys.length}, eksik ${missing}, Türkçe kalan(uzun,TR harfli) ${same.length}, aynı(uzun) ${sameAny.length}${same.length ? "  örn: " + same.slice(0, 3).map((k) => k + "=«" + tr[k].slice(0, 28) + "»").join("; ") : ""}`);
}
console.log(rows.join("\n"));
console.log("kaynak (tr) anahtar:", Object.keys(tr).length);
