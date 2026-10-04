import { describe, it, expect } from "vitest";
import {
  filterEntriesByRange,
  generateJournalPrintHtml,
} from "./journalPdfExport";
import { JournalEntry } from "../components/JournalView";

describe("journalPdfExport.ts - Rich PDF & Print Generator", () => {
  const sampleEntries: JournalEntry[] = [
    {
      id: "j1",
      dateKey: "2026-03-24",
      timeStr: "10:30",
      timestamp: 1711280000000,
      mood: "peaceful",
      content: "Bugün huzurlu bir bahar sabahı. Defterime yeni notlar aldım.",
      wordCount: 10,
    },
    {
      id: "j2",
      dateKey: "2026-03-22",
      timeStr: "21:15",
      timestamp: 1711100000000,
      mood: "productive",
      content: "Almanca kelimeleri çalıştım ve tüm testleri başarıyla geçtim.",
      promptUsed: "Bugün seni gururlandıran an nedir?",
      wordCount: 9,
    },
    {
      id: "j3",
      dateKey: "2025-11-10",
      timeStr: "18:00",
      timestamp: 1700000000000,
      mood: "calm",
      content: "Eski bir anı kaydı.",
      wordCount: 4,
    },
  ];

  it("should filter entries by range accurately", () => {
    const all = filterEntriesByRange(sampleEntries, "all");
    expect(all).toHaveLength(3);

    const thisYear = filterEntriesByRange(sampleEntries, "year");
    expect(thisYear.every((e) => e.dateKey.startsWith("2026"))).toBe(true);
  });

  it("should generate well-formed standalone HTML for print/PDF", () => {
    const html = generateJournalPrintHtml({
      entries: sampleEntries,
      paperTexture: "ruled",
      handwritingFont: "kalam",
      volume: 1,
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("DEFTER NO: 01");
    expect(html).toContain("Caveat");
    expect(html).toContain("huzurlu bir bahar sabahı");
    expect(html).toContain("Bugün seni gururlandıran an nedir?");
    expect(html).toContain("ONAYLANDI · GÜNLÜK ARŞİVİ");
  });

  it("should embed custom handwriting styling when custom font is provided", () => {
    const html = generateJournalPrintHtml({
      entries: sampleEntries,
      paperTexture: "kraft",
      handwritingFont: "custom",
      customHandwriting: {
        createdAt: 1711280000000,
        slant: 8,
        weight: 600,
        letterSpacing: 0.8,
        baseFont: "kalam",
        label: "Özel",
        sourceType: "draw",
        analysis: { strokeDensity: 30, detectedSlant: 8, inkContrast: 90, naturalJitter: 5 },
      },
      volume: 2,
    });

    expect(html).toContain("Kalam");
    expect(html).toContain("skewX");
    expect(html).toContain("#f2e7d3"); // Kraft paper background
  });
});