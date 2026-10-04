import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DX as Close,
  DSearch as Search,
  DDownload as Download,
  DCheck as Check,
  DCalendar as CalendarIcon,
} from "./icons/doodle";
import { SketchJournalPen, SketchTranslate } from "./icons/sketchIcons";
import { useT } from "../i18n/I18nProvider";
import { langToLocale } from "../i18n";
import {
  ArchivedVolume,
  getSavedPaperTexture,
  getSavedHandwriting,
  getSavedCustomHandwriting,
  getArchivedVolumes,
  getCurrentVolume,
} from "../lib/notebookConfig";
import { JournalEntry } from "./JournalView";
import { printJournalAsPdf } from "../lib/journalPdfExport";
import { playPopSound, playPaperRustle, playSuccessSound } from "../lib/sound";

interface VolumeArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  volume: ArchivedVolume | null;
}

export function VolumeArchiveModal({
  isOpen,
  onClose,
  volume,
}: VolumeArchiveModalProps) {
  const [activeTab, setActiveTab] = useState<"journal" | "words">("journal");
  const { t, lang } = useT();
  const [searchQuery, setSearchQuery] = useState("");

  
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const allArchives = useMemo(() => getArchivedVolumes(), []);

  // Belirlenen cildin başlangıç ve bitiş zaman aralığını hesapla
  const timeRange = useMemo(() => {
    if (!volume) return { start: 0, end: Date.now() };
    const end = volume.completedAt || Date.now();
    // Önceki cilt varsa onun bitişi bu cildin başlangıcıdır
    const prevVol = allArchives.find((a) => a.volume === volume.volume - 1);
    const start = prevVol ? prevVol.completedAt : 0;
    return { start, end };
  }, [volume, allArchives]);

  // Bu cilde ait günlük girdilerini filtrele
  const volumeEntries = useMemo(() => {
    if (!volume) return [];
    try {
      const raw = localStorage.getItem("yourbook_journal_entries_v1");
      if (!raw) return [];
      const parsed: JournalEntry[] = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed.filter((e) => {
        const ts = e.timestamp || new Date(e.dateKey).getTime();
        return ts >= timeRange.start && ts <= timeRange.end;
      });
    } catch {
      return [];
    }
  }, [volume, timeRange]);

  // Bu cilde ait öğrenilen kelimeleri filtrele
  const volumeWords = useMemo(() => {
    if (!volume) return [];
    try {
      const raw = localStorage.getItem("yourbook_deck_v7_clean");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed.filter((c: any) => {
        if (!c.learnedAt) return false;
        return c.learnedAt >= timeRange.start && c.learnedAt <= timeRange.end;
      });
    } catch {
      return [];
    }
  }, [volume, timeRange]);

  // Arama filtresi
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return volumeEntries;
    const q = searchQuery.toLowerCase();
    return volumeEntries.filter(
      (e) =>
        e.content.toLowerCase().includes(q) ||
        e.dateKey.includes(q) ||
        (e.promptUsed && e.promptUsed.toLowerCase().includes(q))
    );
  }, [volumeEntries, searchQuery]);

  const filteredWords = useMemo(() => {
    if (!searchQuery.trim()) return volumeWords;
    const q = searchQuery.toLowerCase();
    return volumeWords.filter(
      (w: any) =>
        w.front?.toLowerCase().includes(q) ||
        w.back?.toLowerCase().includes(q) ||
        w.example?.toLowerCase().includes(q)
    );
  }, [volumeWords, searchQuery]);

  // Bu cildi doğrudan PDF olarak dışa aktar
  const handleExportThisVolume = () => {
    if (!volume) return;
    playSuccessSound();
    printJournalAsPdf({
      entries: volumeEntries,
      paperTexture: getSavedPaperTexture(),
      handwritingFont: getSavedHandwriting(),
      customHandwriting: getSavedCustomHandwriting(),
      volume: volume.volume,
    });
  };

  if (!isOpen || !volume) return null;

  const formattedDate = new Intl.DateTimeFormat(langToLocale(lang), {
    dateStyle: "long",
  }).format(new Date(volume.completedAt));

  return (
    <AnimatePresence
      data-lovable-target="volume-archive-modal"
      data-lovable-name="Modal: Cilt Arşivi"
      data-lovable-file="src/components/VolumeArchiveModal.tsx"
      data-lovable-desc="Geçmiş ciltler / arşiv modalı"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        data-qa-modal="volume-archive"
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3.5 select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 14 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 14 }}
          transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[22px] border border-[var(--line-strong)] bg-[var(--paper)] shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Üst Başlık & Cilt Damgası */}
          <div className="p-5 border-b border-[color-mix(in_srgb,var(--border-ink)_18%,transparent)] bg-[color-mix(in_srgb,var(--app-bg)_60%,var(--paper))] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-[12px] border-2 border-emerald-700 bg-emerald-50 text-emerald-800 flex flex-col items-center justify-center shadow-xs">
                <span className="font-mono text-[9px] font-extrabold leading-none">{t("cover.volume")}</span>
                <span className="font-mono text-base font-black leading-none mt-0.5">0{volume.volume}</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-gelica text-base font-bold text-[var(--ink)]">
                    {t("cover.notebook_no")} 0{volume.volume} {t("vol.archive_suffix")}
                  </h3>
                  <span className="font-mono text-[9px] font-bold rounded-full px-2 py-0.5 border border-amber-400 bg-amber-50 text-amber-800">
                    {t("vol.readonly")}
                  </span>
                </div>
                <p className="font-geist text-[11px] text-[var(--ink-soft)] mt-0.5">
                  {t("vol.summary", { date: formattedDate, words: volume.wordsLearned, days: volume.journalCount, badges: volume.stickersUnlocked })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportThisVolume}
                title={t("vol.pdf_tip")}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-[var(--accent)] text-white font-geist text-xs font-bold shadow-xs hover:opacity-90 transition-all"
              >
                <span>{t("vol.pdf")}</span>
              </button>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
              >
                <Close size={16} />
              </button>
            </div>
          </div>

          {/* Sekmeler ve Arama Çubuğu */}
          <div className="p-3.5 border-b border-[color-mix(in_srgb,var(--border-ink)_15%,transparent)] bg-[var(--paper)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex rounded-[14px] border border-[var(--line)] bg-[var(--app-bg)] p-1">
              <button
                onClick={() => {
                  playPopSound();
                  setActiveTab("journal");
                }}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-[10px] font-geist text-xs font-bold transition-all ${
                  activeTab === "journal"
                    ? "bg-[var(--ink)] text-[var(--app-bg)] shadow-xs"
                    : "text-[var(--ink)] hover:text-[var(--accent)]"
                }`}>
                {t("vol.tab.journals", { n: volumeEntries.length })}
              </button>
              <button
                onClick={() => {
                  playPopSound();
                  setActiveTab("words");
                }}
                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-[10px] font-geist text-xs font-bold transition-all ${
                  activeTab === "words"
                    ? "bg-[var(--ink)] text-[var(--app-bg)] shadow-xs"
                    : "text-[var(--ink)] hover:text-[var(--accent)]"
                }`}>
                  {t("vol.tab.words", { n: volumeWords.length })}
              </button>
            </div>

            {/* Arama */}
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute start-2.5 top-2.5 text-[var(--ink-soft)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={activeTab === "journal" ? t("vol.search_journal") : t("vol.search_word")}
                className="w-full ps-3 pe-3 py-1.5 rounded-[12px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* İçerik Listesi (Kaydırılabilir) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
            {/* 1. GÜNLÜKLER LİSTESİ */}
            {activeTab === "journal" && (
              <div>
                {filteredEntries.length === 0 ? (
                  <div className="text-center py-10">
                    <SketchJournalPen className="w-8 h-8 mx-auto mb-2 text-[var(--ink-soft)]" />
                    <span className="font-geist text-xs text-[var(--ink-soft)]">
                      {searchQuery ? t("vol.no_journal_search") : t("vol.no_journal")}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-[14px] border border-[color-mix(in_srgb,var(--border-ink)_18%,transparent)] bg-[var(--app-bg)] p-3.5 shadow-xs"
                      >
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold text-[var(--ink-soft)]">
                              {entry.dateKey} · {entry.timeStr}
                            </span>
                            <span className="text-[11px] font-geist text-[var(--accent)] font-semibold">
                              {entry.mood}
                            </span>
                          </div>
                          <span className="font-mono text-[9px] text-[var(--ink-soft)]">
                            {entry.wordCount || 0} {t("vol.words_unit")}
                          </span>
                        </div>
                        {entry.promptUsed && (
                          <p className="font-geist text-[10.5px] text-amber-800/80 italic mb-2 bg-amber-500/10 px-2 py-1 rounded">
                            {entry.promptUsed}
                          </p>
                        )}
                        <p className="font-handwritten text-[17px] leading-relaxed text-[var(--ink)] whitespace-pre-wrap select-text">
                          {entry.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>)}

            {/* 2. ÖĞRENİLEN KELİMELER LİSTESİ */}
            {activeTab === "words" && (
              <div>
                {filteredWords.length === 0 ? (
                  <div className="text-center py-10">
                    <SketchTranslate className="w-8 h-8 mx-auto mb-2 text-[var(--ink-soft)]" />
                    <span className="font-geist text-xs text-[var(--ink-soft)]">
                      {searchQuery ? t("vol.no_word_search") : t("vol.no_word")}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredWords.map((card: any) => (
                      <div
                        key={card.id}
                        className="rounded-[12px] border border-[color-mix(in_srgb,var(--border-ink)_18%,transparent)] bg-[var(--app-bg)] p-3 shadow-xs"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-gelica text-sm font-bold text-[var(--ink)]">
                            {card.front}
                          </span>
                          <span className="rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 font-mono">
                            {card.lang || "DE"}
                          </span>
                        </div>
                        <p className="font-handwritten text-sm text-[var(--accent)] font-bold mb-1">
                          {card.back}
                        </p>
                        {card.example && (
                          <p className="font-geist text-[10.5px] text-[var(--ink-soft)] italic line-clamp-2">
                            {card.example}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Alt Kapat Çubuğu */}
          <div className="p-3 border-t border-[color-mix(in_srgb,var(--border-ink)_15%,transparent)] bg-[var(--paper)] flex items-center justify-between">
            <span className="font-mono text-[10px] text-[var(--ink-soft)]">
              {t("vol.footer", { vol: volume.volume })}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-[14px] bg-[var(--ink)] text-[var(--app-bg)] font-geist text-xs font-semibold hover:bg-[var(--accent)] transition-colors shadow-xs"
            >
              {t("vol.close")}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
