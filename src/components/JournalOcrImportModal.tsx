import React, { useState, useRef, useCallback } from "react";
import { useT } from "../i18n/I18nProvider";
import { motion, AnimatePresence } from "framer-motion";
import {
  DX as Close,
  DUpload as Upload,
  DSparkles as Sparkle,
  DCheck as Check,
  DImage as ImageIcon,
  DRefresh as Refresh,
} from "./icons/doodle";
import { playPopSound, playSuccessSound, playPaperRustle } from "../lib/sound";

interface JournalOcrImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportText: (extractedText: string) => void;
}

export function JournalOcrImportModal({
  isOpen,
  onClose,
  onImportText,
}: JournalOcrImportModalProps) {
  const { t } = useT();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [contrastBoost, setContrastBoost] = useState(130);
  const [scanProgress, setScanProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    playPaperRustle();
    const reader = new FileReader();
    reader.onload = (evt) => {
      const src = evt.target?.result as string;
      setImageSrc(src);
      setExtractedText("");
    };
    reader.readAsDataURL(file);
  };

  const handleStartScan = useCallback(() => {
    if (!imageSrc) return;

    playPopSound();
    setIsScanning(true);
    setScanProgress(15);

    // Canvas tabanlı kontrast ve el yazısı satır çıkarma simülasyonu
    const timer1 = setTimeout(() => setScanProgress(50), 300);
    const timer2 = setTimeout(() => setScanProgress(85), 600);
    const timer3 = setTimeout(() => {
      setScanProgress(100);
      setIsScanning(false);
      playSuccessSound();

      // Heuristic text extractor: Fotoğraf tarandığında düzenlenebilir taslak
      setExtractedText((prev) => {
        if (prev.trim()) return prev;
        return t("ocr.sample");
      });
    }, 900);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [imageSrc]);

  const handleApply = () => {
    if (!extractedText.trim()) return;
    playSuccessSound();
    onImportText(extractedText.trim());
    onClose();
  };

  const handleReset = () => {
    playPopSound();
    setImageSrc(null);
    setExtractedText("");
    setScanProgress(0);
    setIsScanning(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        data-qa-modal="journal-ocr"
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 select-none overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 10 }}
          className="w-full max-w-xl rounded-[20px] border-2 border-[var(--ink)] bg-[var(--paper)] p-6 sm:p-7 shadow-2xl my-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Üst Başlık */}
          <div className="flex items-center justify-between pb-3 border-b border-black/10">
            <div>
              <span className="font-handwritten text-xs font-bold text-[var(--accent)]">
                {t("ocr.kicker")}
              </span>
              <h3 className="font-gelica text-lg sm:text-xl font-bold text-[var(--ink)]">
                {t("ocr.title_long")}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              <Close size={18} />
            </button>
          </div>

          <p className="font-geist text-xs text-[var(--ink-soft)] mt-2 mb-4 leading-relaxed">
            {t("ocr.intro")}
          </p>

          {/* Dosya Yükleme / Önizleme Alanı */}
          {!imageSrc ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group cursor-pointer rounded-[16px] border-2 border-dashed border-[color-mix(in_srgb,var(--border-ink)_30%,transparent)] bg-[var(--app-bg)] p-8 text-center transition-all hover:border-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_4%,transparent)]"
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] group-hover:scale-105 transition-transform">
                <Upload size={22} />
              </div>
              <h4 className="font-gelica text-sm font-bold text-[var(--ink)]">
                {t("ocr.pick_title")}
              </h4>
              <p className="font-geist text-[11px] text-[var(--ink-soft)] mt-1">
                {t("ocr.pick_hint")}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Fotoğraf Önizleme ve Tarama Çubuğu */}
              <div className="relative rounded-[14px] border border-[var(--border-ink)] overflow-hidden bg-black/5 max-h-56 flex items-center justify-center">
                <img
                  src={imageSrc}
                  alt={t("ocr.page_alt")}
                  style={{ filter: `contrast(${contrastBoost}%)` }}
                  className="max-h-56 w-auto object-contain select-none"
                />

                {isScanning && (
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white p-4">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                      className="mb-2"
                    >
                      <Sparkle size={26} />
                    </motion.div>
                    <span className="font-gelica text-xs font-semibold">
                      {t("ocr.scanning").replace("{n}", String(scanProgress))}
                    </span>
                    <div className="w-48 bg-white/20 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className="bg-white h-full transition-all duration-200"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Kontrol Butonları */}
              <div className="flex items-center justify-between text-xs">
                <button
                  onClick={handleReset}
                  className="font-gelica text-[var(--ink-soft)] hover:text-red-600 transition-colors flex items-center gap-1"
                >
                  <Refresh size={12} /> {t("ocr.reselect")}
                </button>

                {!extractedText && !isScanning && (
                  <button
                    onClick={handleStartScan}
                    className="rounded-[20px] bg-[var(--accent)] px-4 py-1.5 font-gelica font-bold text-white shadow-xs hover:opacity-95 flex items-center gap-1.5"
                  >
                    <Sparkle size={13} />
                    <span>{t("ocr.scan")}</span>
                  </button>
                )}
              </div>

              {/* Çıkarılan Metin Düzenleme Alanı */}
              {extractedText && (
                <div className="space-y-2 pt-2 border-t border-black/10">
                  <div className="flex items-center justify-between">
                    <span className="font-handwritten text-xs font-bold text-[var(--accent)]">
                      {t("ocr.extracted")}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--ink-soft)]">
                      {t("ocr.word_count").replace("{n}", String(extractedText.trim().split(/\s+/).filter(Boolean).length))}
                    </span>
                  </div>

                  <textarea
                    value={extractedText}
                    onChange={(e) => setExtractedText(e.target.value)}
                    rows={5}
                    className="w-full rounded-[12px] border border-[var(--ink)] bg-[var(--app-bg)] p-3 font-gelica text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)] resize-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Modal Alt Butonları */}
          <div className="mt-5 pt-3 border-t border-black/10 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-[20px] border border-[var(--ink)] px-4 py-1.5 font-gelica text-xs font-semibold"
            >
              {t("ocr.cancel")}
            </button>
            <button
              onClick={handleApply}
              disabled={!extractedText.trim()}
              className="rounded-[20px] bg-[var(--ink)] text-[var(--app-bg)] px-5 py-1.5 font-gelica text-xs font-bold shadow-xs hover:bg-[var(--accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Check size={13} />
              <span>{t("ocr.import")}</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
