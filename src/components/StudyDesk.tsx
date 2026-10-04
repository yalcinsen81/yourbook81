import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "../i18n/I18nProvider";
import { StickyCard } from "./StickyCard";
import { WordStatusPanel } from "./WordStatusPanel";
import QuizMode from "./QuizMode";
import LearningStats from "./LearningStats";
import { useEngagement } from "./EngagementSystem";
import type { WordCard } from "../lib/types";
import type { SuperrTheme } from "../lib/themes";
import { SRS_INTERVALS_DAYS } from "../lib/deck";

export interface StudyDeskProps {
  theme?: SuperrTheme;
  space: { id: string; name: string; nameKey?: string };
  cards: WordCard[];
  onLearn: (id: string) => void;
  onForgot?: (id: string) => void;
  onUpdateImage?: (cardId: string, imageUrl: string | undefined) => void;
  onReset: () => void;
  onQuickAdd: () => void;
  /** Masa disi dahil tum kartlar (celdirici + istatistik icin) */
  allCards?: WordCard[];
  /** Tekrar havuzuna geri gonder (sinav yanlislari icin) */
  onReturnToQueue?: (id: string) => void;
  /** XP odulu */
  onAwardXp?: (xp: number) => void;
  /** MADDE 7: kart duzenle. */
  onEditCard?: (cardId: string, patch: { word: string; translation: string; note?: string; article?: string }) => void;
  /** MADDE 7: kart sil. */
  onDeleteCard?: (cardId: string) => void;
  /** MADDE 6: masanin TOPLAM kart sayisi (tekrari bekleyenler dahil DEGIL).
   *  Masada hic kelime yok ile "hepsi tamam" durumunu AYIRMAK icin. */
  deskTotal?: number;
}

export function StudyDesk({
  space,
  cards,
  onLearn,
  onForgot,
  onUpdateImage,
  onReset,
  onQuickAdd,
  allCards,
  onReturnToQueue,
  onAwardXp,
  deskTotal,
  onEditCard,
  onDeleteCard,
}: StudyDeskProps) {
  const { t } = useT();
  const engagement = useEngagement();
  const [showQuiz, setShowQuiz] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const hasStack = cards.length > 1;
  const currentCard = cards[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="relative flex min-h-full w-full flex-col px-6 py-6 pb-[calc(88px+env(safe-area-inset-bottom))] lg:px-10 lg:pb-6 lg:flex-row lg:gap-6"
    >
      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col lg:mx-auto lg:max-w-[1200px]">
        {/* Baslik */}
        <div className="mb-4">
          <h2 className="font-gelica text-[22px] font-bold text-[var(--ink)]">
            {t(space.nameKey || space.name)}
          </h2>
          <p className="font-mono text-[11px] text-[var(--ink-soft)]">
            {t("desk.count_short").replace("{n}", String(deskTotal ?? cards.length))}
          </p>
        </div>

        {/* Kart destesi */}
        <div className="relative flex items-start justify-center mt-[80px]">

          {currentCard ? (
            <StickyCard
              key={currentCard.id}
              card={currentCard}
              onLearn={onLearn}
              onForgot={onForgot}
              onUpdateImage={onUpdateImage}
              onEdit={onEditCard}
              onDelete={onDeleteCard}
              className="relative z-10"
            />
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-10 flex flex-col items-center text-center"
            >
              {/* MADDE 6: IKI DURUMU AYIR —
                  (a) masada hic kelime yok  -> "bu masa henuz boş"
                  (b) kelime var, tekrar yok -> "masa tertemiz" (mevcut mesaj) */}
              {(() => {
                // deskTotal verilmemisse cards.length'e dus (geriye uyumlu).
                const hasAnyCard = (deskTotal ?? cards.length) > 0;
                return hasAnyCard ? (
                  <>
                    <p className="font-gelica text-[17px] font-bold text-[var(--ink)]" data-empty-state="all-done">
                      {t("desk.empty_title")}
                    </p>
                    <p className="mt-1 max-w-[380px] font-mono text-[11px] leading-relaxed text-[var(--ink-soft)]">
                      {t("desk.empty_desc")
                        .replace("{name}", t(space.nameKey || space.name))
                        .replace("{d}", String(SRS_INTERVALS_DAYS[0]))}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-gelica text-[17px] font-bold text-[var(--ink)]" data-empty-state="no-words">
                      {t("desk.empty_no_words")}
                    </p>
                    <p className="mt-1 max-w-[380px] font-mono text-[11px] leading-relaxed text-[var(--ink-soft)]">
                      {t("desk.empty_no_words_desc")}
                    </p>
                  </>
                );
              })()}
              <div className="mt-5 flex items-center gap-2">
                <button
                  onClick={onQuickAdd}
                  className="rounded-[12px] bg-[var(--ink)] px-4 py-2 font-gelica text-[12px] font-bold text-white transition hover:opacity-90"
                >
                  {t("desk.new_word_add")}
                </button>
                <button
                  onClick={onReset}
                  className="rounded-[12px] border border-[var(--ink)] px-4 py-2 font-gelica text-[12px] font-bold text-[var(--ink)] transition hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]"
                >
                  {t("desk.reset")}
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Aksiyonlar: yeni kelime / sifirla / sinav / istatistik */}
        {currentCard && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={onQuickAdd}
              className="rounded-[12px] bg-[var(--ink)] px-4 py-2 font-gelica text-[12px] font-bold text-white transition hover:opacity-90"
            >
              {t("desk.new_word_add")}
            </button>
            <button
              onClick={onReset}
              className="rounded-[12px] border border-[var(--ink)] px-4 py-2 font-gelica text-[12px] font-bold text-[var(--ink)] transition hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]"
            >
              {t("desk.reset")}
            </button>

            {/* Sinav modu butonu: yalnizca kart varken gosterilir */}
            {currentCard && cards.length >= 2 && (
              <button
                onClick={() => setShowQuiz(true)}
                className="btn-pill-superr text-xs"
                data-quiz-open="1"
                title={t("quiz.start_hint").replace("{n}", String(Math.min(8, cards.length)))}
              >
                <span>{t("quiz.title")}</span>
              </button>
            )}

            {/* Istatistik paneli butonu */}
            {allCards && allCards.length > 0 && (
              <button
                onClick={() => setShowStats(true)}
                className="btn-pill-superr text-xs"
                data-stats-open="1"
                title={t("stats.open")}
              >
                <span>{t("stats.open")}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Kelime Durumu Paneli: masanin yaninda sabit panel (mobilde cekmece) */}
      <WordStatusPanel
        allCards={(allCards ?? cards) as never}
        queueIds={cards.map((c) => c.id)}
        onReturnToQueue={(id) => onReturnToQueue?.(id)}
        onAwardXp={(xp) => onAwardXp?.(xp)}
      />

      {/* Sinav modu: yanlis cevaplar SRS tekrar havuzuna geri beslenir */}
      <AnimatePresence>
        {showQuiz && (
          <QuizMode
            pool={cards}
            allCards={allCards ?? cards}
            count={8}
            onClose={() => setShowQuiz(false)}
            onFinish={(rep) => {
              rep.wrongCards.forEach((c) => onReturnToQueue?.(c.id));
              onAwardXp?.(rep.correct * 5);
            }}
          />
        )}
      </AnimatePresence>

      {/* Ogrenme istatistikleri (tum kartlar uzerinden turetilir) */}
      <AnimatePresence>
        {showStats && allCards && (
          <LearningStats
            cards={allCards}
            engagement={
              engagement
                ? {
                    xp: engagement.xp ?? 0,
                    streak: engagement.streak ?? 0,
                    answeredToday: engagement.answeredToday ?? 0,
                    masteredToday: engagement.masteredToday ?? 0,
                    bonusXpToday: engagement.todayXp ?? 0,
                  }
                : { xp: 0, streak: 0, answeredToday: 0, masteredToday: 0 }
            }
            onClose={() => setShowStats(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
