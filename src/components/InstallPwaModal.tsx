import { motion, AnimatePresence } from "framer-motion";
import { useT } from "../i18n/I18nProvider";
import { DCheck as Check, DDownload as Download, DX as X } from "./icons/doodle";
import { playPopSound, playSuccessSound } from "../lib/sound";

interface InstallPwaModalProps {
  isOpen: boolean;
  onClose: () => void;
  canInstall: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  onTriggerInstall: () => Promise<boolean>;
}

export function InstallPwaModal({
  isOpen,
  onClose,
  canInstall,
  isInstalled,
  isIOS,
  onTriggerInstall,
}: InstallPwaModalProps) {
  const { t } = useT();
  const handleInstallClick = async () => {
    playPopSound();
    const success = await onTriggerInstall();
    if (success) {
      playSuccessSound();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          data-qa-modal="pwa-install"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[960] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs select-none"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[var(--paper)] border-2 border-[var(--ink)] rounded-[16px] shadow-superrCard overflow-hidden"
          >
            {/* Üst Başlık Bandı */}
            <div className="bg-[var(--ink)] text-[var(--app-bg)] px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download size={16} />
                <span className="font-gelica text-sm font-semibold lowercase">
                  {t("pwa.install_title")}
                </span>
              </div>
              <button
                onClick={onClose}
                className="text-[var(--app-bg)] opacity-80 hover:opacity-100 p-0.5"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Logo ve Tanıtım */}
              <div className="flex items-center gap-3.5 pb-4 border-b-2 border-dashed border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)]">
                <img
                  src="/icon-192.png"
                  alt="yourbook"
                  className="w-14 h-14 rounded-[12px] border-2 border-[var(--ink)] shadow-sm bg-[var(--accent)]"
                />
                <div>
                  <h3 className="font-gelica text-xl font-bold text-[var(--ink)] leading-tight">
                    <span dir="ltr" className="inline-block">yourbook</span>
                  </h3>
                  <span className="font-handwritten text-sm text-[var(--accent)] font-bold block">
                    {t("agenda.title")}
                  </span>
                  <span className="font-geist text-[11px] text-[var(--ink-soft)]">
                    {t("cust.pwa.sub")}
                  </span>
                </div>
              </div>

              {isInstalled ? (
                /* 1. Zaten Yüklü Durum */
                <div className="bg-[color-mix(in_srgb,var(--accent)_12%,var(--paper))] p-4 rounded-[12px] border border-[var(--ink)] flex items-center gap-3 text-xs font-gelica">
                  <span className="p-1.5 rounded-full bg-[#22c55e] text-white">
                    <Check size={14} strokeWidth={2.6} />
                  </span>
                  <div>
                    <span className="font-bold text-[var(--ink)] block">
                      {t("pwa.already")}
                    </span>
                    <span className="text-[var(--ink-soft)] text-[11px]">
                      {t("pwa.already_hint")}
                    </span>
                  </div>
                </div>
              ) : isIOS ? (
                /* 2. iOS Safari Özel Yönergesi */
                <div className="space-y-3 bg-[var(--app-bg)] p-4 rounded-[12px] border border-[var(--ink)] text-xs font-geist">
                  <span className="font-gelica text-xs font-bold text-[var(--ink)] block">
                    {t("pwa.ios_steps_title")}
                  </span>
                  <div className="space-y-2 text-[var(--ink-soft)]">
                    <div className="flex items-start gap-2.5">
                      <span className="font-mono font-bold text-[var(--accent)] text-xs w-4">1.</span>
                      <span>
                        {t("pwa.ios_step1_a")} <strong className="text-[var(--ink)]">{t("pwa.ios_step1_share")}</strong> {t("pwa.ios_step1_b")}
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="font-mono font-bold text-[var(--accent)] text-xs w-4">2.</span>
                      <span>
                        {t("pwa.ios_step2_a")} <strong className="text-[var(--ink)]">{t("pwa.ios_step2_add")}</strong> {t("pwa.ios_step2_b")}
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="font-mono font-bold text-[var(--accent)] text-xs w-4">3.</span>
                      <span>
                        {t("pwa.ios_step3_a")} <strong className="text-[var(--accent)]">{t("pwa.ios_step3_add")}</strong>{t("pwa.ios_step3_b")}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* 3. Chrome / Edge / Windows / Mac / Android Tek Tıkla Yükleme */
                <div className="space-y-3">
                  <div className="bg-[var(--app-bg)] p-3.5 rounded-[12px] border border-[var(--ink)] text-xs font-geist text-[var(--ink-soft)] leading-relaxed">
                    {t("pwa.install_local")}
                  </div>

                  {canInstall && (
                    <button
                      onClick={handleInstallClick}
                      className="w-full btn-pill-orange text-xs !py-2.5 !px-5 justify-center shadow-md font-gelica text-sm"
                    >
                      <Download size={16} />
                      <span className="font-bold">{t("cust.pwa.install")}</span>
                    </button>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={onClose}
                  className="font-gelica text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] px-3 py-1"
                >
                  kapat
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
