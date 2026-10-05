import React, { useState, useEffect } from "react";
import { useT } from "../i18n/I18nProvider";
import { langToLocale } from "../i18n";
import { motion, AnimatePresence } from "framer-motion";
import {
  DX as Close,
    DDownload as Download,
  
  DCheck as Check,
  DCalendar as CalendarIcon,
} from "./icons/doodle";
import { JournalEntry } from "./JournalView";
import { SketchDocument } from "./icons/sketchIcons";
import {
  getSavedPaperTexture,
  getSavedHandwriting,
  getSavedCustomHandwriting,
  getCurrentVolume,
  PAPER_TEXTURES,
  HANDWRITING_STYLES,
} from "../lib/notebookConfig";
import {
  printJournalAsPdf,
  downloadJournalAsTxt,
  downloadJournalAsJson,
  filterEntriesByRange,
} from "../lib/journalPdfExport";
import { playPopSound, playSuccessSound, playPaperRustle } from "../lib/sound";

interface JournalExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: JournalEntry[];
}

export function JournalExportModal({
  isOpen,
  onClose,
  entries,
}: JournalExportModalProps) {
  const { t, lang } = useT();
  const [range, setRange] = useState<"all" | "month" | "year">("all");
  const [tocGrouping, setTocGrouping] = useState<"month" | "week">("month");
  const [isExporting, setIsExporting] = useState(false);

  
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const paperTexture = getSavedPaperTexture();
  const handwritingFont = getSavedHandwriting();
  const customHandwriting = getSavedCustomHandwriting();
  const volume = getCurrentVolume();

  const paperObj = PAPER_TEXTURES.find((p) => p.id === paperTexture) || PAPER_TEXTURES[0];
  const fontObj = HANDWRITING_STYLES.find((f) => f.id === handwritingFont) || HANDWRITING_STYLES[0];

  const filteredEntries = filterEntriesByRange(entries, range);

  const handlePrintPdf = () => {
    playSuccessSound();
    setIsExporting(true);
    printJournalAsPdf({
      entries: filteredEntries,
      paperTexture,
      handwritingFont,
      customHandwriting,
      volume,
      locale: langToLocale(lang),
      filterRange: range,
      tocGrouping,
      labels: exportLabels,
    });
    setTimeout(() => {
      setIsExporting(false);
      onClose();
    }, 600);
  };

  /** Yazdırılan belgenin çevrilebilir başlıkları (arayüz diline göre). */
  const exportLabels = {
    title: t("export.pdf_title"),
    subtitle: t("export.pdf_subtitle"),
    footer: t("export.pdf_footer"),
    seal: t("export.pdf_seal"),
    txtHeader: t("export.txt_header"),
    dateLabel: t("export.date_label"),
    moodLabel: t("export.mood_label"),
    promptLabel: t("export.prompt_label"),
    notebookNo: t("export.notebook_no"),
    originalPrint: t("export.original_print"),
    totalEntries: t("export.total_entries"),
    totalWords: t("export.total_words"),
    handwritingLabel: t("export.handwriting"),
    exportedAt: t("export.exported_at"),
    toc: t("export.toc"),
    page: t("export.page"),
    weekLabel: t("export.week"),
    moodMap: {
      peaceful: t("journal.mood.peaceful"),
      productive: t("journal.mood.productive"),
      calm: t("journal.mood.calm"),
      tired: t("journal.mood.tired"),
      tense: t("journal.mood.tense"),
      hard: t("journal.mood.hard"),
    },
  };

  const handleDownloadTxt = () => {
    playSuccessSound();
    downloadJournalAsTxt(filteredEntries, exportLabels);
    onClose();
  };

  const handleDownloadJson = () => {
    playSuccessSound();
    downloadJournalAsJson(filteredEntries);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence
      data-lovable-target="journal-export-modal"
      data-lovable-name="Modal: Günlük Dışa Aktarma"
      data-lovable-file="src/components/JournalExportModal.tsx"
      data-lovable-desc="Günlüğü PDF / metin olarak dışa aktarma modalı"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        data-qa-modal="journal-export"
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 12 }}
          transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative w-full max-w-md rounded-[20px] border border-[var(--line-strong)] bg-[var(--paper)] p-5 sm:p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--border-ink)_18%,transparent)] pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-xs">
                <SketchDocument size={16} strokeWidth={1.9} />
              </span>
              <div>
                <h3 className="font-gelica text-base font-bold text-[var(--ink)]">
                  günlüğü dışa aktar &amp; baskı al
                </h3>
                <p className="font-geist text-[11px] text-[var(--ink-soft)]">
                  {t("export.sub")}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              title={t("common.close")}
              className="rounded-full p-1 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
            >
              <Close size={16} />
            </button>
          </div>

          {/* Kapsam / Filtre Seçimi */}
          <div className="mb-4">
            <span className="font-geist text-[11px] font-semibold text-[var(--ink)] block mb-1.5">
              {t("export.scope_label")}
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-[14px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)]">
              {[
                { id: "all", label: t("export.all").replace("{n}", String(entries.length)) },
                { id: "month", label: t("export.this_month") },
                { id: "year", label: t("time.this_year") },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    playPopSound();
                    setRange(tab.id as any);
                  }}
                  className={`py-1.5 text-center rounded-[10px] font-geist text-[11px] font-bold transition-all ${
                    range === tab.id
                      ? "bg-[var(--ink)] text-[var(--app-bg)] shadow-xs"
                      : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Icindekiler (TOC) gruplama secimi */}
          <div className="mb-4">
            <span className="font-geist text-[11px] font-semibold text-[var(--ink)] block mb-1.5">
              {t("export.toc_grouping")}
            </span>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-[14px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)]">
              {[
                { id: "month", label: t("export.toc_by_month") },
                { id: "week", label: t("export.toc_by_week") },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    playPopSound();
                    setTocGrouping(tab.id as "month" | "week");
                  }}
                  className={`py-1.5 text-center rounded-[10px] font-geist text-[11px] font-bold transition-all ${
                    tocGrouping === tab.id
                      ? "bg-[var(--ink)] text-[var(--app-bg)] shadow-xs"
                      : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* FORMAT 1: ZENGİN PDF (BASKI / A4 DEFTER) */}
          <div className="space-y-3 mb-4">
            <div className="relative rounded-[16px] border-2 border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] p-4 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-geist text-xs font-bold text-[var(--accent)] flex items-center gap-1.5">
                  {t("export.rich_pdf")}
                </span>
                <span className="rounded-full bg-[var(--accent)] text-white text-[9.5px] px-2 py-0.5 font-bold font-mono">
                  {t("export.print_ready")}
                </span>
              </div>
              <p className="font-geist text-[11px] text-[var(--ink)] leading-relaxed mb-3">
                {t("export.rich_pdf_desc")}
              </p>

              {/* Defter Özellikleri Rozetleri */}
              <div className="flex flex-wrap items-center gap-1.5 mb-3 font-mono text-[9.5px] text-[var(--ink-soft)]">
                <span className="px-2 py-0.5 rounded-md bg-[var(--paper)] border border-black/10">
                  {t("export.paper")}: {t(paperObj.nameKey)}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[var(--paper)] border border-black/10">
                  {t("export.font")}: {t(fontObj.nameKey)}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[var(--paper)] border border-black/10">
                  {t("export.notebook")}: 0{volume}
                </span>
              </div>

              <button
                onClick={handlePrintPdf}
                disabled={filteredEntries.length === 0 || isExporting}
                className="w-full py-2.5 rounded-[12px] bg-[var(--accent)] text-white font-geist text-xs font-bold shadow-sm hover:opacity-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                <span>
                  {isExporting ? t("export.preparing") : `${t("export.pdf_open")} (${filteredEntries.length} ${t("vol.pdf_pages")})`}
                </span>
              </button>
            </div>

            {/* FORMAT 2 & 3: .TXT VE .JSON YAN YANA */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={handleDownloadTxt}
                disabled={filteredEntries.length === 0}
                className="p-3 rounded-[14px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] text-start hover:border-[var(--line-strong)] transition-all flex flex-col justify-between disabled:opacity-50"
              >
                <div>
                  <span className="font-geist text-xs font-bold text-[var(--ink)] block">
                    {t("export.plain_txt")}
                  </span>
                  <span className="font-geist text-[10px] text-[var(--ink-soft)] block mt-0.5">
                    {t("export.plain_txt_desc")}
                  </span>
                </div>
                <span className="font-mono text-[10.5px] font-bold text-[var(--accent)] mt-2">
                  {t("act.download")}
                </span>
              </button>

              <button
                onClick={handleDownloadJson}
                disabled={filteredEntries.length === 0}
                className="p-3 rounded-[14px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] text-start hover:border-[var(--line-strong)] transition-all flex flex-col justify-between disabled:opacity-50"
              >
                <div>
                  <span className="font-geist text-xs font-bold text-[var(--ink)] block">
                    {t("export.json_backup")}
                  </span>
                  <span className="font-geist text-[10px] text-[var(--ink-soft)] block mt-0.5">
                    {t("export.json_backup_desc")}
                  </span>
                </div>
                <span className="font-mono text-[10.5px] font-bold text-[var(--accent)] mt-2">
                  {t("export.backup_btn")}
                </span>
              </button>
            </div>
          </div>

          {/* Alt Kapat */}
          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="font-geist text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
            >
              Kapat
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}