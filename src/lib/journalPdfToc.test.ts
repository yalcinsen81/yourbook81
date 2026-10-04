import { describe, it, expect } from "vitest";
import { generateJournalPrintHtml } from "./journalPdfExport";
import type { JournalEntry } from "../components/JournalView";

const mk = (id: string, dateKey: string, mood: string, words = 5): JournalEntry => ({
  id,
  dateKey,
  timeStr: "10:00",
  timestamp: 1,
  mood,
  content: "içerik " + id,
  wordCount: words,
});

const entries: JournalEntry[] = [
  mk("a", "2026-03-10", "calm"),
  mk("b", "2026-03-18", "tired"),
  mk("c", "2026-01-05", "peaceful"),
  mk("d", "2026-01-20", "productive"),
  mk("e", "2026-01-22", "hard"),
];

const opts = {
  entries,
  paperTexture: "ruled" as const,
  handwritingFont: "kalam" as const,
  customHandwriting: null,
  volume: 2,
};

const EN_LABELS = {
  title: "yourbook — dear journal archive",
  subtitle: "Personal memories",
  footer: "footer",
  seal: "VERIFIED",
  notebookNo: "NOTEBOOK NO:",
  originalPrint: "ORIGINAL PRINT",
  totalEntries: "Total Entries",
  totalWords: "Total Words",
  handwritingLabel: "Handwriting",
  exportedAt: "Exported",
  toc: "TABLE OF CONTENTS",
  page: "page",
};

describe("journalPdfExport - table of contents & page numbers", () => {
  it("renders a table of contents section", () => {
    const html = generateJournalPrintHtml({ ...opts, labels: { toc: "TABLE OF CONTENTS" } });
    expect(html).toContain('class="toc"');
    expect(html).toContain("TABLE OF CONTENTS");
  });

  it("uses the Turkish toc label by default", () => {
    const html = generateJournalPrintHtml(opts);
    expect(html).toContain("İÇİNDEKİLER");
  });

  it("groups entries by month with counts", () => {
    const html = generateJournalPrintHtml(opts);
    const months = [...html.matchAll(/class="toc-row toc-month"><span>([^<]+)<\/span><span class="toc-dots"><\/span><span class="toc-count">(\d+)<\/span>/g)];
    expect(months.length).toBe(2);
    const map = Object.fromEntries(months.map((m) => [m[1].trim(), Number(m[2])]));
    expect(map["2026-03"]).toBe(2);
    expect(map["2026-01"]).toBe(3);
  });

  it("lists every day under its month as an in-page link", () => {
    const html = generateJournalPrintHtml(opts);
    const days = [...html.matchAll(/class="toc-row toc-day"><a href="#entry-([0-9-]+)-(\d+)"/g)];
    // 5 girdi -> 5 gün satırı
    expect(days.length).toBe(5);
    // Bağlantı hedefleri gerçekten var olmalı
    for (const [, dateKey, idx] of days) {
      expect(html).toContain('id="entry-' + dateKey + '-' + idx + '"');
    }
  });

  it("each journal card carries a unique anchor id", () => {
    const html = generateJournalPrintHtml(opts);
    const ids = [...html.matchAll(/class="journal-card" id="(entry-[^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBe(5);
    expect(new Set(ids).size).toBe(5);
  });

  it("lists the newest month first", () => {
    const html = generateJournalPrintHtml(opts);
    const months = [...html.matchAll(/class="toc-row toc-month"><span>([^<]+)<\/span>/g)].map((m) => m[1].trim());
    expect(months[0]).toBe("2026-03");
    expect(months[1]).toBe("2026-01");
  });

  it("does not render a toc when there are no entries", () => {
    const html = generateJournalPrintHtml({ ...opts, entries: [] });
    // Not: sinif adlari <style> icinde de gecer; yalnizca MARKUP'i kontrol et.
    expect(html).not.toContain('class="toc-row toc-month"');
    expect(html).not.toContain('class="toc-row toc-day"');
  });

  it("prints page numbers via a CSS @page footer", () => {
    const html = generateJournalPrintHtml(opts);
    expect(html).toContain("@page");
    expect(html).toContain("@bottom-center");
    expect(html).toContain("counter(page)");
  });

  it("localises the summary card labels", () => {
    const html = generateJournalPrintHtml({ ...opts, labels: EN_LABELS });
    expect(html).toContain("NOTEBOOK NO:");
    expect(html).toContain("ORIGINAL PRINT");
    expect(html).toContain("Total Entries");
    expect(html).toContain("Total Words");
    // Türkçe varsayılanlar gitmiş olmalı
    expect(html).not.toContain("ORİJİNAL BASKI");
    expect(html).not.toContain("Toplam Kayıt");
  });

  it("keeps Turkish summary labels by default", () => {
    const html = generateJournalPrintHtml(opts);
    expect(html).toContain("DEFTER NO:");
    expect(html).toContain("ORİJİNAL BASKI");
    expect(html).toContain("Toplam Kayıt");
  });
});

describe("journalPdfExport - weekly TOC grouping (v98)", () => {
  it("defaults to monthly grouping when tocGrouping is omitted", () => {
    const html = generateJournalPrintHtml(opts);
    expect(html).toContain("2026-03");
  });

  it("groups entries by ISO week when tocGrouping='week'", () => {
    const html = generateJournalPrintHtml({ ...opts, tocGrouping: "week" });
    const weeks = [...html.matchAll(/class="toc-row toc-month"><span>([^<]+)<\/span><span class="toc-dots"><\/span><span class="toc-count">(\d+)<\/span>/g)];
    // 5 girdi birden fazla haftaya dagilir -> en az 4 hafta grubu
    expect(weeks.length).toBeGreaterThanOrEqual(4);
    for (const w of weeks) {
      expect(w[1].trim()).toMatch(/^\d{4} · Hafta \d{2}$/);
    }
    // aylik gruplama etiketi ("2026-03") ARTIK olmamali
    expect(html).not.toMatch(/toc-month"><span>2026-03</);
  });

  it("uses the localized week label", () => {
    const html = generateJournalPrintHtml({
      ...opts,
      tocGrouping: "week",
      labels: { weekLabel: "Week" },
    });
    expect(html).toContain("· Week ");
  });

  it("keeps in-page links working in weekly mode", () => {
    const html = generateJournalPrintHtml({ ...opts, tocGrouping: "week" });
    const days = [...html.matchAll(/class="toc-row toc-day"><a href="#entry-([0-9-]+)-(\d+)"/g)];
    expect(days.length).toBe(entries.length);
    expect(html).toContain("#entry-" + entries[0].dateKey);
  });

  it("assigns 2026-01-05 to ISO week 02", () => {
    // 2026-01-01 Persembe -> W01 = 29 Ara - 4 Oca; 5 Oca Pazartesi -> W02
    const html = generateJournalPrintHtml({
      entries: [mk("x", "2026-01-05", "calm")],
      paperTexture: "ruled" as const,
      handwritingFont: "kalam" as const,
      customHandwriting: null,
      volume: 1,
      tocGrouping: "week",
    });
    expect(html).toContain("Hafta 02");
  });
});
