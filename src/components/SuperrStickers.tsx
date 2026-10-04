import { motion } from "framer-motion";
import { useT } from "../i18n/I18nProvider";
import { useEffect, useState } from "react";
import { getNotebookAgeTier } from "../lib/notebookConfig";

const SPRING = {
  type: "spring",
  stiffness: 500,
  damping: 25,
} as const;

// 1. Şimşek Stickerı (Emil Kowalski Wiggle & Bounce)
export function LightningSticker({ className = "" }: { className?: string }) {
  return (
    <motion.div aria-hidden="true"
      whileHover={{
        scale: 1.25,
        rotate: [8, -12, 14, -6, 8],
        transition: { duration: 0.4 },
      }}
      transition={SPRING}
      className={`inline-flex items-center justify-center p-2 rounded-xl bg-[#3b82f6] border-2 border-[var(--ink)] text-white shadow-sm rotate-[8deg] select-none ${className}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffffff" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    </motion.div>
  );
}

// 2. Gözlü Kalp Stickerı
export function HeartSticker({ className = "" }: { className?: string }) {
  return (
    <motion.div aria-hidden="true"
      whileHover={{
        scale: 1.25,
        rotate: [-10, 12, -14, 6, -10],
        transition: { duration: 0.4 },
      }}
      transition={SPRING}
      className={`inline-flex items-center justify-center p-2 rounded-xl bg-[#ff66cf] border-2 border-[var(--ink)] text-white shadow-sm -rotate-[10deg] select-none ${className}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffffff" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    </motion.div>
  );
}

// 3. Yıldız / Sparkle Stickerı
export function StarSticker({ className = "" }: { className?: string }) {
  return (
    <motion.div aria-hidden="true"
      whileHover={{
        scale: 1.25,
        rotate: [12, -14, 16, -6, 12],
        transition: { duration: 0.4 },
      }}
      transition={SPRING}
      className={`inline-flex items-center justify-center p-2 rounded-xl bg-[var(--accent)] border-2 border-[var(--ink)] text-white shadow-sm rotate-[12deg] select-none ${className}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffffff" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </motion.div>
  );
}

// 4. Filiz Stickerı
export function SproutSticker({ className = "" }: { className?: string }) {
  return (
    <motion.div aria-hidden="true"
      whileHover={{
        scale: 1.25,
        rotate: [-6, 14, -12, 8, -6],
        transition: { duration: 0.4 },
      }}
      transition={SPRING}
      className={`inline-flex items-center justify-center p-2 rounded-xl bg-[#22c55e] border-2 border-[var(--ink)] text-white shadow-sm -rotate-[6deg] select-none ${className}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffffff" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 20h10" />
        <path d="M10 20c5.5-2.5.8-6.4 3-10" />
        <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4.1 5.5.8Z" />
        <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2Z" />
      </svg>
    </motion.div>
  );
}

// 5. El Çizimi Kıvrık Ok — başlıktaki vurgulu kelimeyi işaret eder
export function HandDrawnArrow({
  style,
  className = "",
  width = 84,
  height = 62,
}: {
  className?: string;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 56 44"
      style={style}
      fill="none"
      className={`text-[var(--accent)] drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)] ${className}`}
    >
      {/* El titremesi olan, hafif asimetrik kavisli gövde — sağdan sola, aşağı kıvrılır */}
      <path
        d="M49 5 C 40 2.4, 24 4.6, 17 12.5 C 11.5 18.8, 13.6 27.6, 21 33.5"
        stroke="currentColor"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* İkinci ince üst üste çizgi (kalem baskısı) */}
      <path
        d="M48 7 C 40 4.8, 25.5 6.8, 19.2 14 C 14.4 19.4, 16.2 26.6, 22.4 31.9"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* Aşağı-sola bakan el çizimi ok ucu — "öğrenmek" kelimesinin k harfine iner */}
      <path
        d="M13.6 23.4 L 20.6 33.2 L 30 28.6"
        stroke="currentColor"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 6. Okul Defteri Etiketi (Hover'da Yaylanma)
export function NameLabelSticker({
  name = "",
  volume = 1,
  deskSub,
  deskNames,
  className = "",
  onClick,
}: {
  name?: string;
  volume?: number;
  deskSub?: string;
  /** Aktif dil masasi ADLARI (spaces'ten). Sabit metin yerine bu kullanilir. */
  deskNames?: string[];
  className?: string;
  onClick?: () => void;
}) {
  const { t } = useT();
  // Sessiz "yaşlanma" kademesi — tamamen görsel, kullanıcıya bildirilmez.
  const [ageTier, setAgeTier] = useState<0 | 1 | 2 | 3>(0);
  useEffect(() => {
    const read = () => setAgeTier(getNotebookAgeTier());
    read();
    window.addEventListener("notebook-config-changed", read);
    return () => window.removeEventListener("notebook-config-changed", read);
  }, []);

  return (
    <motion.div aria-hidden="true"
      onClick={onClick}
      whileHover={{ rotate: 0, scale: 1.02, y: -2 }}
      transition={SPRING}
      className={`notebook-aged age-tier-${ageTier} inline-block border-2 border-[var(--ink)] bg-[var(--app-bg)] rounded-[8px] p-3 shadow-sm rotate-[-3deg] select-none ${className}`}
    >
      {/* Fiziksel yıpranma katmanları (dekoratif, pointer-events yok) */}
      <span className="age-layer age-corners" aria-hidden="true" />
      <span className="age-layer age-edges" aria-hidden="true" />
      <span className="age-layer age-stain" aria-hidden="true" />

      <div className="relative z-10 flex items-center justify-between border-b border-[var(--ink)] pb-1.5 mb-1.5 font-gelica text-xs text-[var(--ink)] font-semibold">
        <span>{t("cover.notebook_no")} 0{volume}</span>
        <span className="text-[var(--accent)]">{t("cover.super")}</span>
      </div>
      <div className="relative z-10 space-y-1 font-gelica text-[13px] text-[var(--ink)]">
        <div className="flex gap-2">
          <span className="text-[var(--ink-soft)]">{t("cover.name_label")}</span>
          <span className="font-handwritten text-[16px] text-[var(--accent)] font-bold leading-none">{name}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-[var(--ink-soft)]">{t("cover.lesson")}</span>
          {deskSub ?? (deskNames ?? []).join(" & ")}
        </div>
      </div>
    </motion.div>
  );
}
