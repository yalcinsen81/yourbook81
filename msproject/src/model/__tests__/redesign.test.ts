import { describe, expect, it } from "vitest";
import { COLUMNS, DEFAULT_HIDDEN } from "../../components/TaskGrid";
import { tr } from "../../i18n/tr";
import { en } from "../../i18n/en";

// Arayüz yenileme: renk jetonları, kontrast, sütun varsayılanları ve yeni metinler
async function css(): Promise<string> {
  // Stil dosyası düz metin olarak okunur (Node türleri projede yok)
  const fsName = "node:fs";
  const { readFileSync } = (await import(/* @vite-ignore */ fsName)) as { readFileSync: (path: string, enc: string) => string };
  return readFileSync("src/styles.css", "utf8");
}

/** `:root { … }` ya da `:root[data-theme="dark"] { … }` bloğundaki ilk tanım */
function token(src: string, block: string, name: string): string {
  const start = src.indexOf(`${block} {`);
  const body = src.slice(start, src.indexOf("\n}", start));
  const m = body.match(new RegExp(`--${name}: ([^;]+);`));
  return m ? m[1].trim().toLowerCase() : "";
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe("arayüz yenileme: jetonlar", () => {
  it("açık tema istenen sıcak paleti kullanır", async () => {
    const s = await css();
    const want: Record<string, string> = {
      bg: "#faf9f5",
      surface: "#ffffff",
      "surface-2": "#f5f3ec",
      line: "#e8e6dc",
      "line-strong": "#d9d6c9",
      ink: "#141413",
      "ink-2": "#5e5d58",
      brand: "#d97757",
      "brand-strong": "#b5532f",
      "brand-hover": "#a24a29",
      "brand-tint": "#fbeee8",
      critical: "#7c3a24",
      normal: "#4c6a88",
      ok: "#788c5d",
    };
    for (const [k, v] of Object.entries(want)) expect(token(s, ":root", k), k).toBe(v);
  });

  it("koyu tema sıcak tonlarda", async () => {
    const s = await css();
    const dark = ':root[data-theme="dark"]';
    expect(token(s, dark, "bg")).toBe("#1f1e1d");
    expect(token(s, dark, "surface")).toBe("#262524");
    expect(token(s, dark, "ink")).toBe("#f3f1ea");
    expect(token(s, dark, "brand")).toBe("#e08a6b");
    expect(token(s, dark, "critical")).toBe("#c27a5c");
    expect(token(s, dark, "normal")).toBe("#7fa0c2");
  });

  it("yazı ve dolu düğme kontrastı ≥ 4.5 (iki tema)", async () => {
    const s = await css();
    for (const block of [":root", ':root[data-theme="dark"]']) {
      const bg = token(s, ":root", "bg");
      const surface = block === ":root" ? token(s, ":root", "surface") : token(s, block, "surface");
      const back = block === ":root" ? [bg, surface, token(s, ":root", "surface-2")] : [token(s, block, "bg"), surface, token(s, block, "surface-2")];
      for (const name of ["ink", "ink-2", "ink-3", "critical-ink", "ok-ink"]) {
        const fg = token(s, block, name) || token(s, ":root", name);
        for (const b of back) expect(contrast(fg, b), `${block} ${name} / ${b}`).toBeGreaterThanOrEqual(4.5);
      }
      const btn = token(s, block, "btn");
      expect(contrast("#ffffff", btn), `${block} düğme`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("parlak kırmızı, mor ve eski çivit renkleri yok; kritik desen kaldırıldı", async () => {
    const s = (await css()).toLowerCase();
    for (const old of ["#4f46e5", "#8b5cf6", "#c0262d", "#d55e00", "#0072b2", "#a03a7a", "#6366f1"]) expect(s.includes(old), old).toBe(false);
    expect(s.includes(".crit-pattern")).toBe(false);
  });

  it("araç çubuğu tek satır ve yoğunluk ayarı", async () => {
    const s = await css();
    expect(s).toMatch(/\.toolbar \{[^}]*flex-wrap: nowrap;[^}]*height: 44px;/);
    expect(s).toMatch(/\.topbar \{[^}]*height: 48px;/);
    expect(s).toMatch(/:root\[data-density="comfortable"\] \{\s*--row-h: 36px;/);
  });
});

describe("arayüz yenileme: tablo ve metinler", () => {
  it("WBS, maliyet ve tahmin varsayılan olarak gizli; ad sütunu var", () => {
    expect(DEFAULT_HIDDEN).toEqual(expect.arrayContaining(["wbs", "cost", "estimate"]));
    expect(COLUMNS.map((c) => c.key)).toEqual(expect.arrayContaining(["row", "name", "duration", "start", "finish", "preds", "resources", "percent", "slack"]));
  });

  it("yeni metinler iki dilde", () => {
    const keys = ["tb.more", "empty.first", "empty.template", "empty.open", "settings.density", "settings.compact", "settings.comfortable", "app.splitterTitle", "view.searchShort"] as const;
    const trd = tr as Record<string, unknown>;
    const end = en as Record<string, unknown>;
    for (const k of keys) {
      expect(trd[k], k).toBeTruthy();
      expect(end[k], k).toBeTruthy();
    }
    expect(trd["empty.first"]).toBe("İlk görevi ekle");
    expect(trd["empty.template"]).toBe("Şablondan başla");
    expect(trd["empty.open"]).toBe("Dosya aç");
  });
});
