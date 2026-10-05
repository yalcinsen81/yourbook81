// Kullanım: node qa/missing-keys.mjs <dil>  → tr'de olup dilde olmayan anahtarlar
import fs from "fs";
const load = (c) => {
  const d = {};
  for (const f of [`src/i18n/locales/${c}.ts`, `src/i18n/locales/${c}-extra.ts`]) {
    if (!fs.existsSync(f)) continue;
    for (const m of fs.readFileSync(f, "utf8").matchAll(/^\s*"([^"]+)":\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)) d[m[1]] = m[2];
  }
  return d;
};
const code = process.argv[2] || "en";
const tr = load("tr"), d = load(code);
const miss = Object.keys(tr).filter((k) => !(k in d));
console.log(miss.map((k) => `${k} = ${tr[k].slice(0, 60)}`).join("\n") || "eksik yok");
