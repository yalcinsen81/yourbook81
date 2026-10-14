// Eksik çeviri denetimi: tr.ts ve en.ts aynı anahtarları içermeli, her metindeki {yer tutucular} iki dilde aynı olmalı.
// Kullanım: npm run check:i18n  (hata varsa çıkış kodu 1)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "i18n");

/** "anahtar": metin satırlarını okur; çoğul girişlerin tüm biçimleri birleştirilir */
function entries(file) {
  const src = readFileSync(join(dir, file), "utf8");
  const map = new Map();
  const re = /^\s*"([\w.]+)":\s*([\s\S]*?),?\s*$(?=\n\s*"[\w.]+":|\n\s*\}|\n\s*\/\/)/gm;
  for (const m of src.matchAll(re)) map.set(m[1], m[2]);
  return map;
}

const placeholders = (text) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort().join(",");

const tr = entries("tr.ts");
const en = entries("en.ts");
const problems = [];
for (const k of tr.keys()) if (!en.has(k)) problems.push(`en.ts eksik: ${k}`);
for (const k of en.keys()) if (!tr.has(k)) problems.push(`tr.ts'te yok (fazla): ${k}`);
for (const [k, v] of tr) {
  if (!en.has(k)) continue;
  const a = placeholders(v);
  const b = placeholders(en.get(k));
  if (a !== b) problems.push(`yer tutucu farkı ${k}: tr {${a}} / en {${b}}`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`i18n: ${tr.size} anahtar, tr ve en eşit.`);
