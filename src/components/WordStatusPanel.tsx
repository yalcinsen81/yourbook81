import { SketchTag, SketchBox, SketchTarget, SketchClock, SketchCap, SketchBow, SketchHourglass, SketchStarOutline } from "./icons/sketchIcons";
import { useT } from "../i18n/I18nProvider";
import { playPopSound, playPaperRustle } from "../lib/sound";
import { useMemo, useState } from "react";
import { SRS_INTERVALS_DAYS } from "../lib/deck";
import { WordHuntGame } from "./WordHuntGame";
import { motion, AnimatePresence } from "framer-motion";
import {
  DChevronDown as ChevronDown,
  DChevronRight as ChevronRight,
  DChevronLeft as ChevronLeft,
  DSparkles as Sparkle,
  DClock as Clock,
  DCheck as Check,
  DRefresh as Rotate,
  DX as Close,
} from "./icons/doodle";

/** Veri modeli: deck.ts ile aynı şekil. */
export interface PanelCard {
  id: string;
  lang: "DE" | "EN" | "Memo";
  article?: string;
  word: string;
  translation: string;
  note?: string;
  tags?: string[];
  createdAt: number;
  learnedAt: number | null;
  reviewAt: number | null;
  reviewCount?: number;
}

interface WordStatusPanelProps {
  /** Seçili masaya ait TÜM kartlar (öğrenilmiş ve ertelenmiş dahil). */
  allCards: PanelCard[];
  /** Kart yığınında şu an görünen (tekrar sırası gelmiş) kartların id'leri. */
  queueIds: string[];
  /** Kartı tekrar yığınına geri döndürür ("unutmuşum"). */
  onReturnToQueue: (cardId: string) => void;
  /** Kelime Avı oyunundan kazanılan XP'yi sisteme ödüllendirir */
  onAwardXp?: (amount: number) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Çeviri işlevi tipi (i18n ile uyumlu). */
type TFn = (key: string, vars?: Record<string, string | number>) => string;

/** "3 gün sonra" / "bugün" / "yarın" gibi okunabilir metin (çevrilebilir). */
function humanizeFuture(ts: number, now: number, tFn: TFn): string {
  const diffDays = Math.ceil((ts - now) / DAY_MS);
  if (diffDays <= 0) return tFn("cards.in_0_days");
  if (diffDays === 1) return tFn("cards.in_1_day");
  return tFn("cards.in_n_days").replaceAll("{n}", String(diffDays));
}

/** "3 gün önce öğrenildi" gibi okunabilir metin (çevrilebilir). */
function humanizePast(ts: number, now: number, tFn: TFn): string {
  const diffDays = Math.floor((now - ts) / DAY_MS);
  if (diffDays <= 0) return tFn("cards.learned_today");
  if (diffDays === 1) return tFn("cards.learned_yesterday");
  if (diffDays < 30) return tFn("cards.learned_n_days_ago").replaceAll("{n}", String(diffDays));
  const months = Math.floor(diffDays / 30);
  return tFn("cards.learned_n_months_ago").replaceAll("{n}", String(months));
}

type TabKey = "new" | "waiting" | "learned";

export function WordStatusPanel({ allCards, queueIds, onReturnToQueue, onAwardXp }: WordStatusPanelProps) {
  const { t, lang } = useT();
  // Yardımcı fonksiyonlara geçirilen çeviri işlevi.
  const tFn = t;
  const [collapsed, setCollapsed] = useState(false);
  const [openTab, setOpenTab] = useState<TabKey | null>("new");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isGameOpen, setIsGameOpen] = useState(false);

  const now = Date.now();

  // Üç kategori: veri modelinden türetilir, ek veri kaynağı gerekmez.
  const groups = useMemo(() => {
    const newCards: PanelCard[] = [];
    const waiting: PanelCard[] = [];
    const learned: PanelCard[] = [];

    for (const c of allCards) {
      const inQueue = queueIds.includes(c.id);
      const isDeferred = !!c.learnedAt && !!c.reviewAt && c.reviewAt > now;
      const stage = c.reviewCount ?? 0;
      // SRS son basamağına ulaşan kart "tamamen öğrenilmiş" kabul edilir.
      const isFullyLearned = stage >= SRS_INTERVALS_DAYS.length;

      if (isDeferred && !isFullyLearned) {
        // Sıradaki tekrarı ileri bir tarihte bekleyenler
        waiting.push(c);
      } else if (c.learnedAt && isFullyLearned) {
        // Son tekrar aralığını tamamlamış, kalıcı öğrenilmiş kelimeler
        learned.push(c);
      } else if (!c.learnedAt && inQueue) {
        // Henüz hiç işaretlenmemiş, tekrar sırası gelmiş kelimeler
        newCards.push(c);
      }
    }

    waiting.sort((a, b) => (a.reviewAt ?? 0) - (b.reviewAt ?? 0));
    learned.sort((a, b) => (b.learnedAt ?? 0) - (a.learnedAt ?? 0));
    newCards.sort((a, b) => a.word.localeCompare(b.word, "tr"));

    return { new: newCards, waiting, learned };
  }, [allCards, queueIds, now]);

  const detailCard = detailId ? allCards.find((c) => c.id === detailId) ?? null : null;

  const totalCardCount = allCards.length;

  const tabs: {
    key: TabKey;
    label: string;
    icon: typeof Sparkle;
    items: PanelCard[];
    color: string;
    bgColor: string;
    pillBg: string;
    pillText: string;
    emptyIcon: React.ReactNode;
    emptyText: string;
  }[] = [
    {
      key: "new",
      label: t("panel.new"),
      icon: Sparkle,
      items: groups.new,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      pillBg: "bg-amber-500",
      pillText: "text-white",
      emptyIcon: <SketchBox size={16} strokeWidth={1.8} className="shrink-0 text-amber-500" />,
      emptyText: t("cards.new_empty"),
    },
    {
      key: "waiting",
      label: t("panel.review"),
      icon: Clock,
      items: groups.waiting,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      pillBg: "bg-orange-500",
      pillText: "text-white",
      emptyIcon: <SketchHourglass size={16} strokeWidth={1.8} className="shrink-0 text-orange-500" />,
      emptyText: t("cards.review_empty"),
    },
    {
      key: "learned",
      label: t("cards.learned_title"),
      icon: Check,
      items: groups.learned,
      color: "text-emerald-600",
      bgColor: "bg-emerald-600/10",
      pillBg: "bg-emerald-600",
      pillText: "text-white",
      emptyIcon: <SketchStarOutline size={16} strokeWidth={1.8} className="shrink-0 text-emerald-600" />,
      emptyText: t("cards.learned_empty"),
    },
  ];

  const openDetail = (card: PanelCard) => {
    setDetailId(card.id);
    setFlipped(false);
  };

  const badgeFor = (key: TabKey, card: PanelCard) => {
    if (key === "waiting" && card.reviewAt) return humanizeFuture(card.reviewAt, now, tFn);
    if (key === "learned" && card.learnedAt) return humanizePast(card.learnedAt, now, tFn);
    return null;
  };

  const list = (tabMeta: typeof tabs[number]) => {
    const { key, items, emptyIcon, emptyText } = tabMeta;
    return (
      <AnimatePresence initial={false}
        data-lovable-target="word-status-panel"
        data-lovable-name="Panel: Kelime Durumu"
        data-lovable-file="src/components/WordStatusPanel.tsx"
        data-lovable-desc="Kelime öğrenme durumu paneli"
      >
        <motion.div
          key={key}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
          className="overflow-hidden border-t border-[color-mix(in_srgb,var(--border-ink)_12%,transparent)]"
        >
          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-3 py-3 font-geist text-[11px] text-[var(--ink-soft)]"
            >
              <span className="flex items-center justify-center">{emptyIcon}</span>
              <span>{emptyText}</span>
            </motion.div>
          ) : (
            <ul className="p-1 space-y-0.5 max-h-56 overflow-y-auto scrollbar-thin">
              {items.map((cardItem, idx) => (
                <motion.li
                  key={cardItem.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.028, duration: 0.18, ease: "easeOut" }}
                >
                  <button
                    onClick={() => openDetail(cardItem)}
                    className="group flex w-full items-center justify-between gap-2 rounded-[8px] px-2.5 py-1.5 text-start transition-all hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] hover:translate-x-0.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-gelica text-[12.5px] font-semibold text-[var(--ink)]">
                        {cardItem.article ? `${cardItem.article} ` : ""}
                        {cardItem.word}
                      </span>
                      <span className="block truncate font-geist text-[10px] text-[var(--ink-soft)]">
                        {cardItem.translation}
                      </span>
                    </span>
                    {badgeFor(key, cardItem) && (
                      <span className="shrink-0 rounded-[20px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] px-2 py-0.5 font-geist text-[9px] text-[var(--ink-soft)]">
                        {badgeFor(key, cardItem)}
                      </span>
                    )}
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.div>
      </AnimatePresence>
    );
  };

  // Kelime Avı havuzu: sadece "tekrarı bekleyen" + "öğrenilenler"
  const gamePool = useMemo(() => {
    return [...groups.waiting, ...groups.learned];
  }, [groups.waiting, groups.learned]);

  const body = (
    <div className="flex h-full flex-col justify-between gap-3">
      {/* Kategori sekmeleri / akordeon (kağıt kartı gölgesi + dolgulu pill rozetler) */}
      <div className="flex-1 space-y-2 overflow-y-auto pe-1 scrollbar-thin">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isOpen = openTab === t.key;
          const count = t.items.length;
          const ratio = totalCardCount > 0 ? (count / totalCardCount) * 100 : 0;

          return (
            <div
              key={t.key}
              className="rounded-[12px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--paper)] shadow-[2px_3px_0_0_color-mix(in_srgb,var(--border-ink)_12%,transparent)] transition-all hover:-translate-y-0.5 hover:shadow-[3px_5px_0_0_color-mix(in_srgb,var(--border-ink)_18%,transparent)]"
            >
              <button
                onClick={() => {
                  playPopSound();
                  setOpenTab(isOpen ? null : t.key);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${t.bgColor} ${t.color}`}>
                    <Icon size={12} />
                  </span>
                  <span className="truncate font-gelica text-[12.5px] font-bold lowercase text-[var(--ink)]">
                    {t.label}
                  </span>
                </span>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Dolgulu renkli pill rozet */}
                  <motion.span
                    key={count}
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.18, 1] }}
                    transition={{ duration: 0.25 }}
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold shadow-xs ${t.pillBg} ${t.pillText}`}
                  >
                    {count}
                  </motion.span>

                  {/* 180 derece yumuşak dönen ok */}
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="text-[var(--ink-soft)]"
                  >
                    <ChevronDown size={13} />
                  </motion.div>
                </div>
              </button>

              {/* İnce ilerleme çizgisi */}
              {count > 0 && (
                <div className="h-0.5 w-full bg-[color-mix(in_srgb,var(--border-ink)_8%,transparent)]">
                  <motion.div
                    className={`h-full ${t.pillBg}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${ratio}%` }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  />
                </div>
              )}

              {isOpen && list(t)}
            </div>
          );
        })}
      </div>

      {/* ============ BÖLÜM 2: KELİME AVI OYUNU BUTONU ============ */}
      <div className="border-t border-[color-mix(in_srgb,var(--border-ink)_18%,transparent)] pt-2.5 mb-10">
        <button
          onClick={() => {
            playPaperRustle();
            setIsGameOpen(true);
          }}
          className="group relative flex w-full items-center justify-between overflow-hidden rounded-[12px] border-2 border-[var(--ink)] bg-[var(--paper)] p-2.5 shadow-[2px_3px_0_0_var(--ink)] transition-all hover:-translate-y-0.5 hover:shadow-[3px_5px_0_0_var(--ink)] active:translate-y-0"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-xs group-hover:scale-110 transition-transform">
              <SketchTarget size={16} strokeWidth={1.8} />
            </span>
            <div className="text-start">
              <span className="block font-gelica text-[12.5px] font-bold text-[var(--ink)] leading-tight">
                {t("hunt.title")}
              </span>
              <span className="block font-geist text-[9.5px] text-[var(--ink-soft)] leading-tight">
                {gamePool.length >= 4
                  ? t("ws.pool_ready").replace("{n}", String(gamePool.length))
                  : t("ws.pool_need").replace("{n}", String(gamePool.length))}
              </span>
            </div>
          </div>

          <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2 py-0.5 font-gelica text-[10px] font-bold text-[var(--accent)]">
            <span className="inline-flex items-center gap-1"><span>{t("hunt.play")}</span><SketchBow size={12} strokeWidth={1.8} /></span>
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ============ MASAÜSTÜ: sabit yan panel ============ */}
      <aside
        className={`hidden shrink-0 lg:flex lg:flex-col transition-[width] duration-200 ${
          collapsed ? "w-[52px]" : "w-[290px]"
        }`}
      >
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            title={t("cards.status_panel")}
            className="flex h-full w-full flex-col items-center gap-3 rounded-[12px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--paper)] py-4 transition-colors hover:border-[var(--accent)]"
          >
            <ChevronLeft size={14} className="text-[var(--accent)]" />
            <span className="font-gelica text-[11px] font-semibold text-[var(--ink)] [writing-mode:vertical-rl]">
              {t("ws.title")}
            </span>
            <span className="rounded-full border border-[var(--accent)] px-1.5 font-geist text-[9px] text-[var(--accent)]">
              {groups.new.length + groups.waiting.length + groups.learned.length}
            </span>
          </button>
        ) : (
          <div className="flex h-full flex-col rounded-[12px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] p-3">
            {/* Defter kenarına iliştirilmiş yer imi / sticker başlık */}
            <div className="relative mb-3 flex items-center justify-between border-b border-[color-mix(in_srgb,var(--border-ink)_18%,transparent)] pb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="inline-block rounded-t-[4px] rounded-b-[2px] bg-[var(--accent)] px-2.5 py-0.5 font-handwritten text-[14px] font-bold text-white shadow-xs tracking-wide">
                  <span className="inline-flex items-center gap-1.5"><SketchTag size={13} className="text-white shrink-0" strokeWidth={2} /> {t("ws.title")}</span>
                </span>
                <span className="font-geist text-[9.5px] text-[var(--ink-soft)]">
                  {totalCardCount} {t("vol.words_unit")}
                </span>
              </div>
              <button
                onClick={() => {
                  playPopSound();
                  setCollapsed(true);
                }}
                title={t("panel.collapse")}
                className="rounded-full p-1 text-[var(--ink-soft)] transition-colors hover:text-[var(--accent)] hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            {body}
          </div>
        )}
      </aside>

      {/* ============ MOBİL: altta açılır çekmece ============ */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-16 sm:bottom-5 end-5 z-30 flex items-center gap-2 rounded-[20px] border border-[var(--ink)] bg-[var(--ink)] px-4 py-2.5 shadow-lg lg:hidden"
      >
        <Sparkle size={13} className="text-[var(--app-bg)]" />
        <span className="font-gelica text-[12px] font-semibold text-[var(--app-bg)]">
          {t("ws.title")}
        </span>
      </button>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
              className="absolute inset-x-0 bottom-0 max-h-[75vh] rounded-t-[18px] border-t-2 border-[var(--ink)] bg-[var(--app-bg)] p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-handwritten text-[17px] font-bold text-[var(--accent)]">
                  {t("ws.title")}
                </span>
                <button
                  onClick={() => setMobileOpen(false)}
                  title={t("common.close")}
                  className="rounded-full p-1 text-[var(--ink-soft)]"
                >
                  <Close size={16} />
                </button>
              </div>
              <div className="max-h-[62vh] overflow-y-auto">{body}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ DETAY: isteğe bağlı tekrar ============ */}
      <AnimatePresence>
        {detailCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
            onClick={() => setDetailId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, rotateX: 10, y: 14 }}
              animate={{ opacity: 1, scale: 1, rotateX: 0, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, rotateX: -10, y: 14 }}
              transition={{ duration: 0.24, ease: [0.34, 1.56, 0.64, 1] }}
              className="w-full max-w-sm rounded-[16px] border-2 border-[var(--ink)] bg-[var(--paper)] p-5 shadow-2xl [perspective:1000px]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-geist text-[10px] uppercase tracking-wide text-[var(--ink-soft)]">
                  {t("ws.review_optional")}
                </span>
                <button
                  onClick={() => setDetailId(null)}
                  title={t("common.close")}
                  className="rounded-full p-1 text-[var(--ink-soft)] hover:text-[var(--ink)]"
                >
                  <Close size={16} />
                </button>
              </div>

              {/* Çevrilebilir kart */}
              <button
                onClick={() => setFlipped((f) => !f)}
                className="flex min-h-[130px] w-full flex-col items-center justify-center gap-2 rounded-[12px] border border-[color-mix(in_srgb,var(--border-ink)_25%,transparent)] bg-[var(--app-bg)] px-4 py-6 text-center"
              >
                {!flipped ? (
                  <>
                    <span className="font-gelica text-2xl font-bold text-[var(--ink)]">
                      {detailCard.article ? `${detailCard.article} ` : ""}
                      {detailCard.word}
                    </span>
                    <span className="font-geist text-[10px] text-[var(--ink-soft)]">
                      {t("ws.flip_hint")}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-gelica text-xl font-semibold text-[var(--accent)]">
                      {detailCard.translation}
                    </span>
                    {detailCard.note && (
                      <span className="font-geist text-[11px] text-[var(--ink-soft)]">
                        {detailCard.note}
                      </span>
                    )}
                  </>
                )}
              </button>

              {/* Durum bilgisi (durum değiştirmez) */}
              <p className="mt-3 text-center font-geist text-[10px] text-[var(--ink-soft)]">
                {detailCard.reviewAt && detailCard.reviewAt > now
                  ? t("cards.review_prefix") + ": " + humanizeFuture(detailCard.reviewAt, now, tFn)
                  : detailCard.learnedAt
                    ? humanizePast(detailCard.learnedAt, now, tFn)
                    : tFn("cards.not_learned_yet")}
              </p>

              {/* Aksiyonlar */}
              <div className="mt-4 flex flex-col gap-2">
                <button
                  onClick={() => setDetailId(null)}
                  className="w-full rounded-[20px] border border-[var(--ink)] px-4 py-2 font-gelica text-[12px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--ink)] hover:text-[var(--paper)]"
                >
                  {t("ws.relearn_keep")}
                </button>
                <button
                  onClick={() => {
                    onReturnToQueue(detailCard.id);
                    setDetailId(null);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-[var(--accent)] px-4 py-2 font-gelica text-[12px] font-semibold text-[var(--paper)] transition-opacity hover:opacity-90"
                >
                  <Rotate size={13} />
                  {t("ws.add_review")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ BÖLÜM 2: KELİME AVI MODAL OYUNU ============ */}
      <WordHuntGame
        isOpen={isGameOpen}
        onClose={() => setIsGameOpen(false)}
        pool={gamePool}
        fallbackPool={allCards}
        onAwardXp={(xpAmount) => {
          if (onAwardXp) onAwardXp(xpAmount);
        }}
      />
    </>
  );
}
