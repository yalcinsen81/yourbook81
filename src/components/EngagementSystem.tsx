import { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "../i18n/I18nProvider";

const STORAGE_KEY = "lexi_engagement_v1";

const GOAL = 2000;

interface EngagementState {
  today: string; // YYYY-MM-DD
  xp: number;
  streak: number;
  answeredToday: number;
  masteredToday: number;
  bonusXpToday?: number; // Mini oyunlar ve ek etkinliklerden gelen günlük XP
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadState(): EngagementState {
  const fallback: EngagementState = {
    today: todayKey(),
    xp: 0,
    streak: 0,
    answeredToday: 0,
    masteredToday: 0,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

function saveState(state: EngagementState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function ensureFreshDay(state: EngagementState): EngagementState {
  const today = todayKey();
  if (state.today === today) {
    return state;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  // Dün aktifse seri +1; arada boşluk varsa seri yeniden 1'den başlar.
  const streak = state.today === yesterdayKey ? state.streak + 1 : 1;

  return {
    ...state,
    today,
    xp: state.xp, // toplam XP kalıcıdır
    streak,
    answeredToday: 0,
    masteredToday: 0,
  };
}

export interface EngagementApi {
  xp: number;
  todayXp: number;
  streak: number;
  goal: number;
  progress: number;
  answeredToday: number;
  masteredToday: number;
  addXp: (amount: number) => void;
  recordAnswer: () => void;
  recordMastered: () => void;
  level: number;
  levelProgress: number;
}

const XP_PER_LEVEL = 500;

// Öğrenme akışında verilen XP değerleri: UI ve state aynı sabitleri kullanır,
// böylece kart üzerindeki "+X XP" etiketi gerçekten kazanılanla birebir eşleşir.
export const XP_FOR_ANSWER = 10;
export const XP_FOR_MASTERED = 50;
/** "öğrendim!" tek bir kart için toplam kazanç */
export const XP_FOR_LEARN = XP_FOR_ANSWER + XP_FOR_MASTERED;

const EngagementContext = createContext<EngagementApi | null>(null);

function useEngagementInternal(): EngagementApi {
  const [state, setState] = useState<EngagementState>(() => ensureFreshDay(loadState()));

  useEffect(() => {
    saveState(state);
  }, [state]);

  const addXp = (amount: number) => {
    if (amount <= 0) return;
    setState((prev) => ({
      ...prev,
      xp: prev.xp + amount,
      bonusXpToday: (prev.bonusXpToday || 0) + amount,
      streak: Math.max(1, prev.streak),
    }));
  };

  const recordAnswer = () => {
    setState((prev) => ({
      ...prev,
      answeredToday: prev.answeredToday + 1,
      xp: prev.xp + XP_FOR_ANSWER,
      // Gunluk XP defterini TUT: ayni para biriminde (XP) yazilir, sabitle CARPILMAZ.
      bonusXpToday: (prev.bonusXpToday || 0) + XP_FOR_ANSWER,
      streak: Math.max(1, prev.streak),
    }));
  };

  const recordMastered = () => {
    setState((prev) => ({
      ...prev,
      masteredToday: prev.masteredToday + 1,
      xp: prev.xp + XP_FOR_MASTERED,
      bonusXpToday: (prev.bonusXpToday || 0) + XP_FOR_MASTERED,
      streak: Math.max(1, prev.streak),
    }));
  };

  const level = Math.floor(state.xp / XP_PER_LEVEL) + 1;
  const levelProgress = (state.xp % XP_PER_LEVEL) / XP_PER_LEVEL;
  // MADDE 4: GUNLUK XP — cift sayim YOK.
  // ONCE: answered*10 + mastered*50 + bonusXpToday. Ama recordAnswer/recordMastered
  //        XP'yi ZATEN state.xp'e ekliyor ve ayni deger bonusXpToday'e de yaziliyordu
  //        (addXp uzerinden) -> gunluk XP sismis, hero "1716 / 2016 XP" gosteriyordu.
  // SONRA: gunluk XP yalnizca bonusXpToday + o gunun cevap/ustalik XP'si.
  //        Referans deger olarak state.xp'e GUVENILMEZ (o toplam XP'dir).
  const todayXp = state.bonusXpToday || 0;

  return {
    xp: state.xp,
    todayXp,
    streak: state.streak,
    goal: GOAL,
    progress: Math.min(1, state.xp / GOAL),
    answeredToday: state.answeredToday,
    masteredToday: state.masteredToday,
    addXp,
    recordAnswer,
    recordMastered,
    level,
    levelProgress,
  };
}

export function EngagementProvider({ children }: { children: React.ReactNode }) {
  const value = useEngagementInternal();
  return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>;
}

export function useEngagement(): EngagementApi {
  const ctx = useContext(EngagementContext);
  if (ctx) return ctx;
  return useEngagementInternal();
}

interface StreakFlameProps {
  streak: number;
}

/* Organik el çizimi uyku (Zzz) piktogramı */
function SketchyZzz({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block flex-shrink-0"
    >
      {/* Büyük Z */}
      <path d="M4 6.5h7.5l-7 8h7.5" />
      {/* Orta z */}
      <path d="M13 14.5h5.5l-5 5.5h5.5" strokeWidth={1.8} />
      {/* Küçük z */}
      <path d="M17 5h4l-3.5 4h4" strokeWidth={1.5} />
    </svg>
  );
}

/* Organik el çizimi alev piktogramı */
function SketchyFlame({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      fillOpacity={0.25}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block flex-shrink-0"
    >
      <path d="M12 2.5 C 13.8 5.5, 17.5 8, 17.5 13 A 5.5 5.5 0 0 1 6.5 13 C 6.5 10.2, 7.8 8.8, 9 7.2 C 9.5 8.8, 10.5 9.5, 11.5 9 C 11.8 7.5, 12 5, 12 2.5 Z" />
    </svg>
  );
}

export function StreakFlame({ streak }: StreakFlameProps) {
  const { t } = useT();
  const tFn = t;
  const active = streak >= 1;
  const grade = useMemo(() => {
    if (streak >= 30) return { label: "efsane", color: "#f97316" };
    if (streak >= 14) return { label: tFn("streak.steel"), color: "#64748b" };
    if (streak >= 7) return { label: tFn("streak.fiery"), color: "#ef4444" };
    if (streak >= 3) return { label: tFn("streak.steady"), color: "#f59e0b" };
    return { label: tFn("streak.starting"), color: "#9ca3af" };
  }, [streak, tFn]);

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <motion.span
        animate={active ? { scale: [1, 1.12, 1] } : {}}
        transition={{ duration: 1.4, repeat: active ? Infinity : 0 }}
        style={{ color: grade.color, display: "inline-flex", alignItems: "center" }}
        aria-label="streak"
      >
        {active ? <SketchyFlame size={18} /> : <SketchyZzz size={18} />}
      </motion.span>
      <span className="font-gelica text-sm font-semibold text-[var(--ink)]">{streak}</span>
    
      
</div>
  );
}
