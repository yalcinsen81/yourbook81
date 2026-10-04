import { describe, it, expect } from "vitest";
import { generateJournalPrintHtml } from "./journalPdfExport";
import type { JournalEntry } from "../components/JournalView";

const entries: JournalEntry[] = [
  {
    id: "p1",
    dateKey: "2026-03-10",
    timeStr: "10:00",
    timestamp: 1,
    mood: "calm",
    content: "Bugün güzel bir gündü.",
    wordCount: 4,
  },
];

const opts = {
  entries,
  paperTexture: "ruled" as const,
  handwritingFont: "kalam" as const,
  customHandwriting: null,
  volume: 1,
};

describe("journalPdfExport - i18n labels", () => {
  it("uses Turkish defaults when no labels are given", () => {
    const html = generateJournalPrintHtml(opts);
    expect(html).toContain("yourbook — sevgili günlük arşivi");
    expect(html).toContain("Kişisel anılar, düşünceler ve günlük kayıtlar");
    expect(html).toContain("ONAYLANDI · GÜNLÜK ARŞİVİ");
  });

  it("applies English labels when provided", () => {
    const html = generateJournalPrintHtml({
      ...opts,
      labels: {
        title: "yourbook — dear journal archive",
        subtitle: "Personal memories, thoughts and daily entries",
        footer: "yourbook Personal Notebook App",
        seal: "VERIFIED · JOURNAL ARCHIVE",
      },
    });
    expect(html).toContain("yourbook — dear journal archive");
    expect(html).toContain("Personal memories, thoughts and daily entries");
    expect(html).toContain("VERIFIED · JOURNAL ARCHIVE");
    expect(html).not.toContain("sevgili günlük arşivi");
  });

  it("applies Arabic labels (RTL document)", () => {
    const html = generateJournalPrintHtml({
      ...opts,
      labels: {
        title: "yourbook — أرشيف اليوميات العزيزة",
        subtitle: "ذكريات وأفكار",
        seal: "مُعتمد · أرشيف اليوميات",
      },
    });
    expect(html).toContain("أرشيف اليوميات العزيزة");
    expect(html).toContain("مُعتمد");
  });

  it("keeps unspecified labels at their Turkish default", () => {
    const html = generateJournalPrintHtml({
      ...opts,
      labels: { title: "Custom Title Only" },
    });
    expect(html).toContain("Custom Title Only");
    // subtitle verilmedi -> varsayılan Türkçe kalmalı
    expect(html).toContain("Kişisel anılar, düşünceler ve günlük kayıtlar");
  });

  it("still renders the seeded entry content", () => {
    const html = generateJournalPrintHtml(opts);
    expect(html).toContain("Bugün güzel bir gündü.");
  });
});
