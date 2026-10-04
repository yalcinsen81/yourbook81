import { SketchGift, SketchTag, SketchClose } from "./icons/sketchIcons";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { STORAGE_KEY_GIFTED } from "../lib/notebookConfig";
import { playSuccessSound, playPaperRustle, playPopSound } from "../lib/sound";
import { useT } from "../i18n/I18nProvider";

interface GiftNotebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGiftSent?: () => void;
  /** Gönderenin adı; yoksa bağlantı adsız oluşturulur. */
  senderName?: string;
}

export function GiftNotebookModal({ isOpen, onClose, onGiftSent, senderName: senderNameProp }: GiftNotebookModalProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const { t } = useT();
  const senderName = senderNameProp?.trim() || "yourbook";

  if (!isOpen) return null;

  const currentUrl = typeof window !== "undefined" ? window.location.origin : "https://yourbook-app.vercel.app";
  const giftUrl = `${currentUrl}/?ref=gift_${encodeURIComponent(senderName.toLowerCase())}`;
  const shareText = t("gift.share_text").replace("{url}", giftUrl);

  const handleCopyLink = async () => {
    const markCopied = () => {
      setCopied(true);
      playSuccessSound();
      markGiftSent();
      window.setTimeout(() => setCopied(false), 2400);
    };

    // 1) Modern Clipboard API
    try {
      await navigator.clipboard.writeText(giftUrl);
      markCopied();
      return;
    } catch {
      // sessizce yutma -> fallback'e gec
    }

    // 2) Fallback: gizli textarea + execCommand (izin/HTTP baglami sorunlarinda)
    try {
      const ta = document.createElement("textarea");
      ta.value = giftUrl;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) {
        markCopied();
        return;
      }
    } catch {
      // yine basarisiz -> asagida kullaniciya goster
    }

    // 3) Kopyalanamadi: SESSIZ KALMA, linki goster + durumu bildir.
    setCopyFailed(true);
    markGiftSent();
    window.setTimeout(() => setCopyFailed(false), 6000);
  };

  const handleShareWhatsApp = () => {
    markGiftSent();
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  const markGiftSent = () => {
    localStorage.setItem(STORAGE_KEY_GIFTED, "true");
    onGiftSent?.();
    window.dispatchEvent(new Event("notebook-config-changed"));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        data-qa-modal="gift-notebook"
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
                <SketchGift size={16} strokeWidth={1.8} />
              </span>
              <div>
                <h3 className="font-gelica text-base font-bold text-[var(--ink)]">
                  {t("gift.title")}
                </h3>
                <p className="font-geist text-[11px] text-[var(--ink-soft)]">
                  {t("gift.sub")}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              title={t("act.close")}
              className="rounded-full p-1 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Kart Görseli */}
          <div className="mb-4 rounded-[14px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] p-4 text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[var(--accent)] bg-[var(--paper)] text-[var(--accent)] shadow-sm">
              <SketchGift size={28} strokeWidth={1.8} />
            </div>
            <span className="font-handwritten text-sm font-bold text-[var(--ink)]">
              {t("gift.card_title")}
            </span>
            <p className="font-geist text-[11px] text-[var(--ink-soft)] mt-0.5">
              {t("gift.card_desc")}
            </p>
          </div>

          {/* Rozet Bilgilendirme Notu */}
          <div className="mb-4 p-2.5 rounded-[10px] bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2">
            <SketchTag size={16} className="text-amber-800 shrink-0" strokeWidth={1.8} />
            <span className="font-geist text-[11px]">
              {t("gift.badge_note_a")} <strong>"{t("gift.badge_name")}"</strong> {t("gift.badge_note_b")}
            </span>
          </div>


          {/* Kopyalama onayi: buton rengi degisse de goze carpmasi icin ust serit */}
          {copied && (
           <div
              role="status"
              aria-live="polite"
              className="mb-3 flex items-center gap-2 rounded-[12px] border-emerald-400 bg-emerald-50 px-3 py-2 font-geist text-[11px] font-bold text-emerald-800 transition-all duration-200 ease-out"
            >
              <span className="text-base leading-none">✓</span>
              <span>{t("gift.copied")}</span>
           </div>
          )}
          {/* Paylaşım Butonları */}
          <div className="space-y-2 mb-4">
            <button
              onClick={handleCopyLink}
              className={`w-full flex items-center justify-center gap-2 rounded-[12px] border py-2.5 px-3 font-geist text-xs font-bold active:scale-[0.98] transition-all ${copied ? "border-emerald-500 bg-emerald-50 text-emerald-800" : copyFailed ? "border-amber-500 bg-amber-50 text-amber-900" : "border-[var(--line-strong)] bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--app-bg)]"}`}
            >
              <span>{copied ? t("gift.copied") : copyFailed ? t("gift.copy_failed") : t("gift.copy")}</span>
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="w-full flex items-center justify-center gap-2 rounded-[12px] bg-[#25D366] text-white py-2.5 px-3 font-geist text-xs font-bold hover:opacity-95 active:scale-[0.98] shadow-xs transition-all"
            >
              <span>{t("gift.share_whatsapp")}</span>
            </button>
          </div>

          {copyFailed && (
           <div className="mb-3 rounded-[10px] border-amber-300 bg-amber-50 p-2.5 font-geist text-[10px] text-amber-900">
              <div className="mb-1 font-bold">{t("gift.copy_failed_hint")}</div>
              <input readOnly value={giftUrl} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-md border-amber-300 bg-white px-2 py-1 font-mono text-[10px] text-[var(--ink)]" />
           </div>
          )}

          {/* Alt Kapat */}
          <div className="flex justify-end pt-1">
            <button
              onClick={onClose}
              className="font-geist text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
            >
              {t("act.cancel")}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
