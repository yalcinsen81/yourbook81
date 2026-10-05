import { useState, useEffect } from "react";
import { useT } from "../i18n/I18nProvider";
import { AnimatePresence, motion } from "framer-motion";
import { playStampThud } from "../lib/sound";

export interface XpToastData {
  id: number;
  xp: number; // kazanılan XP
  levelUp: boolean;
  streak: number;
  xpAfter?: number; // kazanımdan sonraki toplam XP (rozet seviyesi için)
}

interface XpToastProps {
  toast: XpToastData | null;
  onDone: () => void;
}

const PRAISE_KEYS = ["praise.1", "praise.2", "praise.3", "praise.4", "praise.5"];

const XP_PER_LEVEL = 500;
function engagementLevelForBadge(toast: XpToastData): number {
  return Math.floor((toast.xpAfter ?? 0) / XP_PER_LEVEL) + 1;
}

export function XpToast({ toast, onDone }: XpToastProps) {
  const { t } = useT();
  const tFn = t;
  useEffect(() => {
    if (!toast) return;
    playStampThud();
    const timer = setTimeout(onDone, 2400);
    return () => clearTimeout(timer);
  }, [toast?.id, onDone]);

  const praise = toast ? tFn(PRAISE_KEYS[toast.id % PRAISE_KEYS.length]) : "";

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 16, scale: 1.15, rotate: -3 }}
          animate={{ opacity: 1, y: 0, scale: [1.15, 0.96, 1], rotate: [-3, 0.5, 0] }}
          exit={{ opacity: 0, y: -16, scale: 0.95 }}
          transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
          className="fixed end-6 top-20 z-[999] pointer-events-none"
        >
          <div className="flex items-center gap-3 px-5 py-3.5 bg-[var(--paper)] border border-[var(--line-strong)] rounded-[16px] shadow-superrCard">
            {toast.levelUp ? (
              <motion.div
                initial={{ scale: 0, rotate: -12 }}
                animate={{ scale: [0, 1.2, 1], rotate: 0 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="relative flex h-12 w-12 items-center justify-center rounded-full border border-[var(--line-strong)] shadow-superrCard overflow-hidden"
                style={{ background: "var(--accent)" }}
              >
                {/* Parıltı süpürmesi */}
                <motion.span
                  initial={{ x: "-120%" }}
                  animate={{ x: "120%" }}
                  transition={{ duration: 0.5, delay: 0.25, ease: "easeInOut" }}
                  className="absolute inset-y-0 w-1/2 bg-white/50 blur-[2px] skew-x-[-15deg]"
                />
                <span className="font-gelica text-lg font-bold text-white">{Math.floor(engagementLevelForBadge(toast))}</span>
              </motion.div>
            ) : (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-2xl"
              >
                
              </motion.span>
            )}
            <div className="flex flex-col">
              <span className="font-gelica text-sm font-semibold text-[var(--ink)]">
                +{toast.xp} XP · {praise}
              </span>
              {toast.levelUp ? (
                <span className="font-handwritten text-[15px] text-[var(--accent)]">
                  {t("xp.level_up")}
                </span>
              ) : toast.streak >= 2 ? (
                <span className="font-geist text-xs text-[var(--ink-soft)]">
                  {t("streak.days").replace("{n}", String(toast.streak))}
                </span>
              ) : null}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Eylemin gerçekleştiği yerde kısa süreliğine beliren, yukarı süzülüp
 * kaybolan "+X XP" etiketi (fade + translateY, ~900ms).
 */

export interface FloatingXpProps {
  amount?: number;
  startX?: number;
  startY?: number;
  onComplete?: () => void;
  spawn?: { id: number; xp: number; levelUp: boolean } | null;
}

export function FloatingXp({ amount, startX, startY, onComplete }: FloatingXpProps & { startX?: number; startY?: number }) {
  const [targetPos, setTargetPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const anchor = document.getElementById("xp-bar-anchor");
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      setTargetPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    } else {
      setTargetPos({ x: 120, y: window.innerHeight - 80 });
    }
  }, []);

  const fromX = startX ?? (typeof window !== "undefined" ? window.innerWidth * 0.55 : 400);
  const fromY = startY ?? (typeof window !== "undefined" ? window.innerHeight * 0.45 : 300);
  const toX = targetPos?.x ?? 120;
  const toY = targetPos?.y ?? (typeof window !== "undefined" ? window.innerHeight - 80 : 600);
  const midX = (fromX + toX) / 2 + 40;
  const midY = Math.min(fromY, toY) - 60;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, x: fromX, y: fromY }}
      animate={{
        opacity: [0, 1, 1, 0.9, 0],
        scale: [0.5, 1.25, 1.1, 0.7, 0.3],
        x: [fromX, midX, toX],
        y: [fromY, midY, toY],
      }}
      transition={{
        duration: 0.65,
        times: [0, 0.15, 0.55, 0.85, 1],
        ease: [0.34, 1.56, 0.64, 1],
      }}
      onAnimationComplete={onComplete}
      className="pointer-events-none fixed top-0 start-0 z-50 flex items-center gap-1.5 -translate-x-1/2 -translate-y-1/2"
    >
      <span className="flex items-center gap-1 rounded-full border border-[var(--line-strong)] bg-[var(--accent)] px-3 py-1 font-gelica text-sm font-bold text-white shadow-lg">
        <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor" className="text-white"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        +{amount} XP
      </span>
    </motion.div>
  );
}

function _unusedOldFloating() {
}
