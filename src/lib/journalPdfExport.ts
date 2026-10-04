import { JournalEntry } from "../components/JournalView";
import {
  PaperTextureType,
  HandwritingStyleType,
  CustomHandwritingConfig,
} from "./notebookConfig";

/** Yazdırılan belgenin çevrilebilir başlıkları. Verilmezse Türkçe varsayılanlar kullanılır. */
export interface JournalExportLabels {
  title: string;
  subtitle: string;
  footer: string;
  seal: string;
  txtHeader: string;
  dateLabel: string;
  moodLabel: string;
  promptLabel: string;
  notebookNo: string;
  originalPrint: string;
  totalEntries: string;
  totalWords: string;
  handwritingLabel: string;
  exportedAt: string;
  toc: string;
  page: string;
  weekLabel: string;
  moodMap: Record<string, string>;
}

export interface JournalExportOptions {
  entries: JournalEntry[];
  paperTexture: PaperTextureType;
  handwritingFont: HandwritingStyleType;
  customHandwriting?: CustomHandwritingConfig | null;
  volume: number;
  filterRange?: "all" | "month" | "year";
  /** Icerikler (TOC) gruplamasi: aylik (varsayilan) veya haftalik. */
  tocGrouping?: "month" | "week";
  /** Çeviri etiketleri (opsiyonel). */
  labels?: Partial<JournalExportLabels>;
  /** Tarih/saat bicimlendirme icin BCP-47 locale (opsiyonel). */
  locale?: string;
}

const MOOD_META: Record<string, { emoji: string; label: string; bg: string; text: string; border: string }> = {
  peaceful: { emoji: "", label: "huzurlu", bg: "#e6f4ea", text: "#137333", border: "#ceead6" },
  productive: { emoji: "", label: "üretken", bg: "#fce8e6", text: "#c5221f", border: "#fad2cf" },
  calm: { emoji: "", label: "sakin", bg: "#e8f0fe", text: "#1a73e8", border: "#d2e3fc" },
  tired: { emoji: "", label: "yorgun", bg: "#fef7e0", text: "#b06000", border: "#feefc3" },
  tense: { emoji: "", label: "gergin", bg: "#f3e8fd", text: "#7627bb", border: "#e9d2fd" },
  hard: { emoji: "", label: "zor bir gün", bg: "#f1f3f4", text: "#5f6368", border: "#dadce0" },
};

/** Varsayılan (Türkçe) etiketler — labels verilmezse bunlar kullanılır. */
const DEFAULT_EXPORT_LABELS: JournalExportLabels = {
  title: "yourbook — sevgili günlük arşivi",
  subtitle: "Kişisel anılar, düşünceler ve günlük kayıtlar",
  footer: "yourbook Kişisel Defter Uygulaması · https://yourbook-app.vercel.app/",
  seal: "ONAYLANDI · GÜNLÜK ARŞİVİ",
  txtHeader: "       YOURBOOK KİŞİSEL GÜNLÜK ARŞİVİ    ",
  dateLabel: "TARİH",
  moodLabel: "RUH HALİ",
  promptLabel: "İSTEM",
  notebookNo: "DEFTER NO:",
  originalPrint: "ORİJİNAL BASKI",
  totalEntries: "Toplam Kayıt",
  totalWords: "Toplam Kelime",
  handwritingLabel: "Yazı Karakteri",
  exportedAt: "Dışa Aktarma",
  toc: "İÇİNDEKİLER",
  page: "sayfa",
  weekLabel: "Hafta",
  moodMap: {},
};

/** labels + varsayılanları birleştir. */
/** v-pen: vektor cizimi PDF icin INLINE SVG'ye cevirir (resim degil, vektor kalir). */
function penLayerToSvg(pen: unknown, width = 520, height = 200): string {
  const layer = pen as { strokes?: Array<{ points?: Array<{ x: number; y: number; p?: number }> }> } | null;
  const strokes = layer?.strokes;
  if (!Array.isArray(strokes) || !strokes.length) return "";

  const f = (n: number) => Number.isFinite(n) ? n.toFixed(4) : "0";
  const paths: string[] = [];

  for (const st of strokes) {
    const pts = Array.isArray(st?.points) ? st.points : [];
    if (!pts.length) continue;

    if (pts.length === 1) {
      const p0 = pts[0];
      const r = (0.9 + (p0.p ?? 0.5) * 1.2).toFixed(2);
      paths.push(`<circle cx="${f(p0.x * width)}" cy="${f(p0.y * height)}" r="${r}" fill="#1c1917" />`);
      continue;
    }

    // Basinca gore degisen kalinlik -> segment segment yol (quadratic yumusatma)
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const w = (0.9 + (b.p ?? 0.5) * 0.7).toFixed(2);
      const x1 = f(a.x * width), y1 = f(a.y * height);
      const x2 = f(b.x * width), y2 = f(b.y * height);
      paths.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1c1917" stroke-width="${w}" stroke-linecap="round" />`);
    }
  }

  if (!paths.length) return "";
  return `<div class="entry-pen"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img">${paths.join("")}</svg></div>`;
}

function resolveLabels(labels?: Partial<JournalExportLabels>): JournalExportLabels {
  return { ...DEFAULT_EXPORT_LABELS, ...(labels || {}), moodMap: { ...(labels?.moodMap || {}) } };
}
export function filterEntriesByRange(entries: JournalEntry[], range: "all" | "month" | "year"): JournalEntry[] {
  if (range === "all") return entries;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  return entries.filter((e) => {
    const d = new Date(e.dateKey);
    if (range === "year") return d.getFullYear() === currentYear;
    if (range === "month") return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    return true;
  });
}

export function generateJournalPrintHtml({
  entries,
  paperTexture,
  handwritingFont,
  customHandwriting,
  volume,
  locale,
  labels,
  tocGrouping,
}: JournalExportOptions): string {
  const L = resolveLabels(labels);
  const sortedEntries = [...entries].sort((a, b) => b.timestamp - a.timestamp);

  // Determine font family & variables
  let fontFamily = "'Kalam', cursive";
  let fontTransform = "none";
  let fontWeight = "500";
  let letterSpacing = "0.2px";

  if (handwritingFont === "kalam") {
    fontFamily = "'Kalam', cursive";
  } else if (handwritingFont === "architect") {
    fontFamily = "'Architects Daughter', cursive";
  } else if (handwritingFont === "marck") {
    fontFamily = "'Marck Script', cursive";
  } else if (handwritingFont === "custom" && customHandwriting) {
    const baseMap = {
      kalam: "'Kalam', cursive",
      architect: "'Architects Daughter', cursive",
      marck: "'Marck Script', cursive",
    };
    fontFamily = baseMap[customHandwriting.baseFont] || "'Kalam', cursive";
    if (customHandwriting.slant) {
      fontTransform = `skewX(${-customHandwriting.slant * 0.7}deg)`;
    }
    fontWeight = String(customHandwriting.weight || 500);
    letterSpacing = `${customHandwriting.letterSpacing || 0.2}px`;
  }

  // Paper styling
  let paperBg = "#faf7f0";
  let lineRuleStyle = "background-image: repeating-linear-gradient(to bottom, transparent, transparent 31px, rgba(160, 120, 80, 0.22) 31px, rgba(160, 120, 80, 0.22) 32px); line-height: 32px;";

  if (paperTexture === "dotted") {
    lineRuleStyle = "background-image: radial-gradient(rgba(140, 100, 60, 0.35) 1.2px, transparent 1.2px); background-size: 20px 20px; line-height: 28px;";
  } else if (paperTexture === "kraft") {
    paperBg = "#f2e7d3";
    lineRuleStyle = "background-image: repeating-linear-gradient(to bottom, transparent, transparent 31px, rgba(120, 80, 40, 0.28) 31px, rgba(120, 80, 40, 0.28) 32px); line-height: 32px;";
  } else if (paperTexture === "plain") {
    lineRuleStyle = "line-height: 30px;";
  }

  const exportDateStr = new Intl.DateTimeFormat(locale || "tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  const totalWords = sortedEntries.reduce((acc, cur) => acc + (cur.wordCount || 0), 0);

  const entriesHtml = sortedEntries
    .map((e, idx) => {
      const mood = MOOD_META[e.mood] || MOOD_META.peaceful;
      const formattedDate = new Intl.DateTimeFormat(locale || "tr-TR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(e.dateKey));

      const formattedContent = e.content
        .split("\n")
        .map((paragraph) => `<p class="journal-paragraph">${paragraph || "&nbsp;"}</p>`)
        .join("");

      return `
        <article class="journal-card" id="entry-${e.dateKey}-${idx}">
          <header class="entry-header">
            <div class="entry-meta-left">
              <span class="entry-number">#${sortedEntries.length - idx}</span>
              <span class="entry-date">${formattedDate}</span>
              <span class="entry-time">${e.timeStr}</span>
            </div>
            <div class="entry-meta-right">
              <span class="mood-badge" style="background: ${mood.bg}; color: ${mood.text}; border-color: ${mood.border};">
                ${mood.label}
              </span>
              <span class="word-count">${e.wordCount || 0} kelime</span>
            </div>
          </header>

          ${
            e.promptUsed
              ? `<div class="prompt-box">
                  <span class="prompt-icon"></span>
                  <span class="prompt-text">"${e.promptUsed}"</span>
                </div>`
              : ""
          }

          <div class="entry-body">
            ${formattedContent}
          </div>

          ${penLayerToSvg(e.pen)}
        </article>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>${L.title} - Cilt 0${volume}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Architects+Daughter&family=Caveat:wght@400;600;700&family=Inter:wght@400;600;700&family=Kalam:wght@400;700&family=Marck+Script&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 16mm 14mm 18mm 14mm;
      /* Yazdırma alt bilgisi: sayfa numarası */
      @bottom-center {
        content: counter(page);
        font-family: ui-monospace, monospace;
        font-size: 9px;
        color: #a8a29e;
      }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: ${paperBg};
      color: #241c15;
      font-size: 13px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .page-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 24px;
    }
    /* COVER / HEADER BANNER */
    .archive-cover-header {
      border-bottom: 2px solid #241c15;
      padding-bottom: 16px;
      margin-bottom: 28px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .cover-title-group h1 {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #241c15;
      text-transform: lowercase;
    }
    .cover-title-group p {
      font-size: 11px;
      color: #6b5d4e;
      margin-top: 3px;
    }
    .volume-stamp {
      border: 2px dashed #a05a2c;
      padding: 6px 12px;
      border-radius: 6px;
      text-align: center;
      color: #a05a2c;
    }
    .volume-stamp-title {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .volume-stamp-sub {
      font-size: 9px;
      opacity: 0.85;
    }

    /* SUMMARY STATS */
    .summary-bar {
      display: flex;
      gap: 16px;
      background: rgba(180, 140, 90, 0.12);
      border: 1px solid rgba(180, 140, 90, 0.25);
      border-radius: 10px;
      padding: 10px 16px;
      margin-bottom: 30px;
      font-size: 11px;
      color: #554433;
    }
    .summary-stat strong {
      color: #241c15;
    }

    /* JOURNAL CARDS */
    .journal-card {
      scroll-margin-top: 12mm;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px dashed rgba(160, 120, 80, 0.35);
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .entry-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .entry-meta-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .entry-number {
      font-family: monospace;
      font-size: 10px;
      font-weight: bold;
      background: #241c15;
      color: #faf7f0;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .entry-date {
      font-size: 13px;
      font-weight: 700;
      color: #241c15;
    }
    .entry-time {
      font-size: 11px;
      color: #7a6b5c;
    }
    .entry-meta-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .mood-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 12px;
      border: 1px solid transparent;
      font-size: 10.5px;
      font-weight: 600;
    }
    .word-count {
      font-size: 10px;
      color: #8c7d6e;
    }

    /* PROMPT BOX */
    .prompt-box {
      background: rgba(217, 119, 6, 0.08);
      border-left: 3px solid #d97706;
      padding: 6px 12px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 14px;
      font-size: 11px;
      color: #92400e;
      font-style: italic;
    }
    .prompt-icon {
      margin-right: 4px;
      font-style: normal;
    }

    /* ENTRY BODY WITH NOTEBOOK LINES */
    .entry-body {
      font-family: ${fontFamily};
      font-weight: ${fontWeight};
      letter-spacing: ${letterSpacing};
      transform: ${fontTransform};
      font-size: 19px;
      color: #211912;
      padding: 6px 8px;
      border-radius: 6px;
      ${lineRuleStyle}
    }

    /* v-pen: kalemle yazilan cizim (vektor SVG). */
    .entry-pen {
      margin-top: 10px;
      border: 1px solid rgba(28, 25, 23, 0.12);
      border-radius: 10px;
      background: rgba(250, 247, 242, 0.6);
      padding: 6px;
      page-break-inside: avoid;
    }
    .entry-pen svg {
      display: block;
      width: 100%;
      height: auto;
      max-height: 180px;
    }
    .journal-paragraph {
      margin-bottom: 12px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    /* FOOTER */
    .archive-footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid rgba(160, 120, 80, 0.3);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #8c7d6e;
    }
    .archive-stamp-seal {
      font-family: monospace;
      font-weight: bold;
      color: #a05a2c;
    }

    /* İçindekiler (Table of Contents) */
    .toc {
      margin: 0 0 22px;
      padding: 14px 16px;
      border: 1.5px solid #1c1917;
      border-radius: 8px;
      background: rgba(28, 25, 23, 0.03);
      page-break-inside: avoid;
    }
    .toc-title {
      font-family: ui-monospace, monospace;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.4px;
      color: #1c1917;
      margin-bottom: 8px;
    }
    .toc-row {
      display: flex;
      align-items: baseline;
      gap: 6px;
      font-size: 11px;
      color: #44403c;
      padding: 1.5px 0;
    }
    .toc-dots {
      flex: 1;
      border-bottom: 1px dotted #a8a29e;
    }
    .toc-month {
      font-weight: 700;
      color: #1c1917;
      margin-top: 4px;
    }
    .toc-day {
      padding-left: 14px;
      font-size: 10px;
    }
    .toc-day a {
      color: #44403c;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .toc-day a:hover { color: #ff6f1e; }
    .journal-card:target {
      outline: 2px solid #ff6f1e;
      outline-offset: 2px;
    }
    .toc-count {
      font-family: ui-monospace, monospace;
      font-size: 10px;
      color: #ff6f1e;
      font-weight: 700;
    }

    @media print {
      body {
        background: ${paperBg} !important;
      }
      .page-container {
        padding: 0;
        max-width: 100%;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="page-container">
    <header class="archive-cover-header">
      <div class="cover-title-group">
        <h1>${L.title}</h1>
        <p>${L.subtitle}</p>
      </div>
      <div class="volume-stamp">
        <div class="volume-stamp-title">${L.notebookNo} 0${volume}</div>
        <div class="volume-stamp-sub">${L.originalPrint}</div>
      </div>
    </header>

    <div class="summary-bar">
      <div class="summary-stat">${L.totalEntries}: <strong>${sortedEntries.length}</strong></div>
      <div class="summary-stat">${L.totalWords}: <strong>${totalWords}</strong></div>
      <div class="summary-stat">${L.handwritingLabel}: <strong>${handwritingFont}</strong></div>
      <div class="summary-stat">${L.exportedAt}: <strong>${exportDateStr}</strong></div>
    </div>

    <!-- İçindekiler (Table of Contents): aya göre gruplanmış kayıt sayısı -->
    <section class="toc">
 <div class="toc-title">${L.toc}</div>
  ${(() => {
    // Icerikler (TOC): aya gore (varsayilan) veya haftaya gore gruplanir.
    // Her alt satir ilgili girdiye sayfa ici baglanti verir (#entry-...).
    const groupKey = (dateKey: string | undefined) => {
      const dk = dateKey || "";
      if (tocGrouping !== "week") return dk.slice(0, 7) || "?"; // YYYY-MM
      // ISO hafta: Persembe gunu o haftanin hangi yila ait oldugunu belirler.
      const dt = new Date(dk + "T00:00:00");
      if (isNaN(dt.getTime())) return dk.slice(0, 7) || "?";
      const th = new Date(dt);
      const dow = (th.getDay() + 6) % 7; // Pazartesi = 0
      th.setDate(th.getDate() - dow + 3); // Persembe
      const firstThursday = new Date(th.getFullYear(), 0, 4);
      const fDow = (firstThursday.getDay() + 6) % 7;
      firstThursday.setDate(firstThursday.getDate() - fDow + 3);
      const weekNo = 1 + Math.round((th.getTime() - firstThursday.getTime()) / (7 * 86400000));
      return th.getFullYear() + "-W" + String(weekNo).padStart(2, "0");
    };

    const labelOf = (k: string) => {
      if (tocGrouping !== "week") return k; // "2026-03"
      const y = k.slice(0, 4);
      const w = k.slice(6);
      return `${y} · ${L.weekLabel} ${w}`;
    };

    const groups = new Map<string, { dateKey: string; idx: number }[]>();
    sortedEntries.forEach((e, idx) => {
      const k = groupKey(e.dateKey);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push({ dateKey: e.dateKey, idx });
    });
    return Array.from(groups.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // en yeni grup ustte
      .map(([k, days]) => {
        const groupRow = `<div class="toc-row toc-month"><span>${labelOf(k)}</span><span class="toc-dots"></span><span class="toc-count">${days.length}</span></div>`;
        const dayRows = days
          .slice()
          .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1))
          .map((d) => {
            const dayNum = (d.dateKey || "").slice(8, 10) || "—";
            return `<div class="toc-row toc-day"><a href="#entry-${d.dateKey}-${d.idx}"><span>${dayNum}</span></a></div>`;
          })
          .join("");
        return groupRow + dayRows;
      })
      .join("");
  })()}
</section>

    <main class="entries-container">
      ${entriesHtml}
    </main>

    <footer class="archive-footer">
      <div>${L.footer}</div>
      <div class="archive-stamp-seal">${L.seal}</div>
    </footer>
  </div>

  <script>
    // Sayfa tamamen yüklendiğinde otomatik yazdırma iletişim kutusunu tetikle
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>`;
}

/**
 * Sayfalanmış zengin PDF çıktısı için gizli iframe veya yeni pencere oluşturup
 * sistemin yerel PDF/Print penceresini açar.
 */
export function printJournalAsPdf(options: JournalExportOptions): void {
  const html = generateJournalPrintHtml(options);

  const printWindow = window.open("", "_blank", "width=850,height=900");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    // Popup engellendiyse görünmez bir iframe kullanarak yazdır
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.style.opacity = "0.01";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 2000);
      }, 600);
    }
  }
}

/**
 * Düz metin (.txt) dışa aktarımı
 */
export function downloadJournalAsTxt(entries: JournalEntry[], labels?: Partial<JournalExportLabels>): void {
  const L = resolveLabels(labels);
  const todayKey = new Date().toISOString().slice(0, 10);
  const lines: string[] = [
    "========================================",
    L.txtHeader,
    "========================================\n",
  ];
  entries.forEach((e) => {
    lines.push(`${L.dateLabel}: ${e.dateKey} · ${e.timeStr}`);
    lines.push(`${L.moodLabel}: ${L.moodMap[e.mood] || e.mood}`);
    if (e.promptUsed) lines.push(`${L.promptLabel || L.dateLabel}: "${e.promptUsed}"`);
    lines.push("----------------------------------------");
    lines.push(e.content);
    lines.push("\n\n");
  });
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `yourbook-gunluk-${todayKey}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Taşınabilir JSON formatında tam veri yedeklemesi
 */
export function downloadJournalAsJson(entries: JournalEntry[]): void {
  const todayKey = new Date().toISOString().slice(0, 10);
  const exportPayload = {
    schemaVersion: "yourbook_journal_v1",
    exportedAt: new Date().toISOString(),
    count: entries.length,
    entries,
  };
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `yourbook-gunluk-yedek-${todayKey}.json`;
  a.click();
  URL.revokeObjectURL(url);
}