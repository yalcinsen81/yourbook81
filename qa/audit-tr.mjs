// Kaynakta kalan sabit Türkçe metinleri bulur (yorum, import, locales, testler hariç).
// Kullanım: node qa/audit-tr.mjs [--files]
import fs from "fs";
import path from "path";

const TR = /[çğıöşüÇĞİÖŞÜ]/;
const SKIP_DIR = new Set(["locales", "node_modules"]);
const SKIP_ATTR = /(data-lovable-[a-z]+|data-qa-[a-z-]+|className|class)\s*=/;

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIR.has(e.name)) yield* walk(path.join(dir, e.name)); }
    else if (/\.(tsx?|jsx?)$/.test(e.name) && !/\.test\./.test(e.name)) yield path.join(dir, e.name);
  }
}

const hits = [];
for (const f of walk("src")) {
  const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
  let inBlock = false;
  lines.forEach((raw, i) => {
    let line = raw;
    if (inBlock) { if (line.includes("*/")) { inBlock = false; line = line.slice(line.indexOf("*/") + 2); } else return; }
    line = line.replace(/\/\*.*?\*\//g, "");
    if (line.includes("/*")) { inBlock = true; line = line.slice(0, line.indexOf("/*")); }
    line = line.replace(/\{\/\*.*?\*\/\}/g, "");
    // satır sonu yorumu (URL'lerdeki // hariç)
    line = line.replace(/(^|\s)\/\/.*$/, "$1");
    if (!TR.test(line)) return;
    if (/^\s*import /.test(line)) return;
    if (SKIP_ATTR.test(line) && !/>[^<]*[çğıöşü]/i.test(line)) return;
    if (/\bt\(\s*["'`]/.test(line) && !/["'`][^"'`]*[çğıöşüÇĞİÖŞÜ][^"'`]*["'`]\s*[,)]/.test(line.replace(/\bt\(\s*["'`][^"'`]*["'`]/g, ""))) return;
    hits.push({ f: f.split(path.sep).join("/"), n: i + 1, text: raw.trim().slice(0, 140) });
  });
}
const byFile = {};
for (const h of hits) (byFile[h.f] ||= []).push(h);
const files = Object.entries(byFile).sort((a, b) => b[1].length - a[1].length);
if (process.argv.includes("--files")) {
  for (const [f, hs] of files) console.log(String(hs.length).padStart(4), f);
} else {
  for (const [f, hs] of files) { console.log(`\n== ${f} (${hs.length})`); hs.forEach((h) => console.log(`  ${h.n}: ${h.text}`)); }
}
console.log(`\ntoplam: ${hits.length} satır, ${files.length} dosya`);
