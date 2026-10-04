import { SketchTarget, SketchBow, SketchFlame, SketchTrophy, SketchSparkles } from "./icons/sketchIcons";
import { useT } from "../i18n/I18nProvider";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DSparkles as Sparkle,
  DClock as Clock,
  DCheck as Check,
  DX as Close,
} from "./icons/doodle";
import { playPopSound, playSuccessSound, playPaperRustle } from "../lib/sound";

export interface GameWordCard {
  id: string;
  lang: "DE" | "EN" | "Memo";
  article?: string;
  word: string;
  translation: string;
  note?: string;
}

interface WordHuntGameProps {
  /** Sadece "tekrarı bekleyen" ve "öğrenilen" kelimeler havuzu */
  pool: GameWordCard[];
  /** Tüm masanın kelimeleri (gerekirse çeldirici / distractor tamamlamak için) */
  fallbackPool?: GameWordCard[];
  isOpen: boolean;
  onClose: () => void;
  onAwardXp: (amount: number) => void;
}

interface Question {
  target: GameWordCard;
  /** "wordToTrans": Yabancı kelime gösterilir -> Türkçe anlamlar seçilir
   *  "transToWord": Türkçe anlam gösterilir -> Yabancı kelimeler seçilir */
  type: "wordToTrans" | "transToWord";
  prompt: string;
  promptSub?: string;
  correctAnswer: string;
  options: string[];
}

export function WordHuntGame({
  pool,
  fallbackPool = [],
  isOpen,
  onClose,
  onAwardXp,
}: WordHuntGameProps) {
  const { t } = useT();
  const [isPlaying, setIsPlaying] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState<GameWordCard[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [totalXpEarned, setTotalXpEarned] = useState(0);

  // Havuz uygunluğu (en az 4 kelime)
  const isPoolEligible = pool.length >= 4;

  // Soruları oluştur
  const startNewGame = useCallback(() => {
    if (!isPoolEligible) return;

    // Havuzdan soru sayısı: en fazla 10 veya havuzdaki toplam kelime
    const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
    const questionCount = Math.min(10, shuffledPool.length);
    const selectedTargets = shuffledPool.slice(0, questionCount);

    // Birleşik distractor havuzu (önce pool, gerekirse fallbackPool)
    const combinedPool = [...pool, ...fallbackPool];
    // Benzersiz kelimeler
    const uniquePool = Array.from(new Map(combinedPool.map((c) => [c.id, c])).values());

    const generatedQuestions: Question[] = selectedTargets.map((target) => {
      // Yön rastgele (%50 yabancı -> Türkçe, %50 Türkçe -> yabancı)
      const isWordToTrans = Math.random() > 0.5;
      const type = isWordToTrans ? "wordToTrans" : "transToWord";

      const prompt = isWordToTrans
        ? (target.article ? `${target.article} ${target.word}` : target.word)
        : target.translation;
      const promptSub = isWordToTrans
        ? t("cards.q_meaning")
        : t("hunt.question");

      const correctAnswer = isWordToTrans
        ? target.translation
        : (target.article ? `${target.article} ${target.word}` : target.word);

      // 2 adet çeldirici (distractor) bul
      const otherCards = uniquePool.filter(
        (c) => c.id !== target.id && c.translation !== target.translation && c.word !== target.word
      );
      const shuffledOthers = [...otherCards].sort(() => Math.random() - 0.5);

      const distractorAnswers: string[] = [];
      for (const card of shuffledOthers) {
        if (distractorAnswers.length >= 2) break;
        const distAns = isWordToTrans
          ? card.translation
          : (card.article ? `${card.article} ${card.word}` : card.word);
        if (distAns !== correctAnswer && !distractorAnswers.includes(distAns)) {
          distractorAnswers.push(distAns);
        }
      }

      // 3 seçeneği karıştır
      const options = [correctAnswer, ...distractorAnswers].sort(() => Math.random() - 0.5);

      return {
        target,
        type,
        prompt,
        promptSub,
        correctAnswer,
        options,
      };
    });

    setQuestions(generatedQuestions);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswerChecked(false);
    setScore(0);
    scoreRef.current = 0;
    setStreak(0);
    setMaxStreak(0);
    setWrongAnswers([]);
    setIsFinished(false);
    setTotalXpEarned(0);
    setIsPlaying(true);
    try { playPaperRustle(); } catch {}
  }, [pool, fallbackPool, isPoolEligible]);

  // Cevap seçildiğinde
  const handleSelectOption = (option: string) => {
    if (isAnswerChecked || !questions[currentIndex]) return;

    setSelectedOption(option);
    setIsAnswerChecked(true);

    const q = questions[currentIndex];
    const isCorrect = option === q.correctAnswer;

    if (isCorrect) {
      try { playSuccessSound(); } catch {}
      scoreRef.current += 1;
      const newStreak = streak + 1;
      setScore((s) => s + 1);
      setStreak(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);
      // Her doğru cevap için 3 XP (SRS 10 XP'nin ~1/3'ü)
      setTotalXpEarned((x) => x + 3);
    } else {
      try { playPopSound(); } catch {}
      setStreak(0);
      setWrongAnswers((prev) =>
        prev.some((c) => c.id === q.target.id) ? prev : [...prev, q.target]
      );
    }

    // 800ms sonra bir sonraki soruya geç veya bitir
    setTimeout(() => {
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex((i) => i + 1);
        setSelectedOption(null);
        setIsAnswerChecked(false);
      } else {
        // Oyun bitti
        setIsFinished(true);
        // Toplam XP'yi sisteme ödüllendir
        const finalXp = scoreRef.current * 3;
        if (finalXp > 0) {
          try {
            onAwardXp(finalXp);
          } catch (e) {
            console.error("onAwardXp error:", e);
          }
        }
      }
    }, 850);
  };

  // Klavye 1, 2, 3 kısayolları
  useEffect(() => {
    if (!isOpen || !isPlaying || isFinished || isAnswerChecked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const q = questions[currentIndex];
      if (!q) return;

      if (e.key === "1" && q.options[0]) handleSelectOption(q.options[0]);
      if (e.key === "2" && q.options[1]) handleSelectOption(q.options[1]);
      if (e.key === "3" && q.options[2]) handleSelectOption(q.options[2]);
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPlaying, isFinished, isAnswerChecked, questions, currentIndex]);

  if (!isOpen) return null;

  const currentQ = questions[currentIndex];
  const totalQuestions = questions.length;
  const progressPercent = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;
  const successRate = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

  return (
    <AnimatePresence
      data-lovable-target="word-hunt-game"
      data-lovable-name="Sayfa/Modal: Kelime Avı Oyunu"
      data-lovable-file="src/components/WordHuntGame.tsx"
      data-lovable-desc="Kelime avı oyunu ekranı"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative w-full max-w-md rounded-[16px] border border-[var(--line-strong)] bg-[var(--paper)] p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Üst Bar: Başlık & Kapat */}
          <div className="mb-4 flex items-center justify-between border-b border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-white font-gelica text-xs font-bold shadow-sm">
                              </span>
              <div>
                <h3 className="font-gelica text-base font-bold text-[var(--ink)]">
                  {t("hunt.title")}
                </h3>
                <p className="font-geist text-[10px] text-[var(--ink-soft)]">
                  {t("hunt.tagline")}
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

          {/* GİRİŞ EKRANI (Henüz başlanmadı) */}
          {!isPlaying && (
            <div className="flex flex-col items-center py-4 text-center">
              <div className="mb-2 flex items-center justify-center text-[var(--accent)]"><SketchBow size={40} strokeWidth={1.8} /></div>
              <h4 className="font-gelica text-lg font-bold text-[var(--ink)] mb-1">
                {t("hunt.tagline")}
              </h4>
              <p className="font-geist text-xs text-[var(--ink-soft)] max-w-xs mb-4 leading-relaxed">
                {t("hunt.desc")}
                {t("hunt.earn_xp")}
              </p>

              {isPoolEligible ? (
                <div className="w-full space-y-3">
                  <div className="rounded-[10px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] p-3 text-start">
                    <div className="flex justify-between items-center text-xs font-geist text-[var(--ink)]">
                      <span>{t("hunt.pool")}</span>
                      <span className="font-bold font-mono px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]">
                        {pool.length} {t("vol.words_unit")}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={startNewGame}
                    className="w-full flex items-center justify-center gap-2 rounded-[20px] bg-[var(--accent)] py-3 font-gelica text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.02] active:scale-95"
                  >
                    <span>{t("hunt.start").replace("{n}", String(Math.min(10, pool.length)))}</span>
                  </button>
                </div>
              ) : (
                <div className="w-full rounded-[12px] border border-amber-300 bg-amber-50 p-4 text-center">
                  <span className="text-xl mb-1 block">⏳</span>
                  <p className="font-gelica text-xs font-bold text-amber-900 mb-1">
                    {t("hunt.need4")}
                  </p>
                  <p className="font-geist text-[11px] text-amber-700 leading-normal">
                    {t("hunt.pool_active").replace("{n}", String(pool.length))}
                    {t("hunt.pool_hint")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* OYUN SIRASI EKRANI */}
          {isPlaying && !isFinished && currentQ && (
            <div className="space-y-4">
              {/* İlerleme & Skor & Seri Çubuğu */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-geist text-[11px] text-[var(--ink-soft)]">
                  <span>
                    Soru <strong className="text-[var(--ink)]">{currentIndex + 1}</strong> / {totalQuestions}
                  </span>
                  <div className="flex items-center gap-3">
                    {streak >= 3 && (
                      <motion.span
                        initial={{ scale: 0.8 }}
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ repeat: Infinity, duration: 1.2 }}
                        className="flex items-center gap-1 font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full text-[10px]"
                      >
                        <span className="inline-flex items-center gap-1"><SketchFlame size={13} className="text-orange-600" strokeWidth={1.8} /> {t("hunt.streak_x").replace("{n}", String(streak))}</span>
                      </motion.span>
                    )}
                    <span className="font-semibold text-[var(--accent)]">
                      {t("hunt.score_correct").replace("{n}", String(score))}
                    </span>
                  </div>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--app-bg)] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)]">
                  <motion.div
                    className="h-full bg-[var(--accent)] rounded-full"
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Soru Kartı */}
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
                className="rounded-[14px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-5 text-center shadow-sm"
              >
                <p className="font-geist text-[11px] uppercase tracking-wide text-[var(--ink-soft)] mb-1">
                  {currentQ.promptSub}
                </p>
                <h2 className="font-gelica text-2xl font-bold text-[var(--ink)] py-2">
                  {currentQ.prompt}
                </h2>
              </motion.div>

              {/* 3 Seçenek (1, 2, 3 kısayollu) */}
              <div className="space-y-2 pt-1">
                {currentQ.options.map((opt, idx) => {
                  const isSelected = selectedOption === opt;
                  const isCorrect = opt === currentQ.correctAnswer;

                  let btnStyle = "border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)] hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]";
                  if (isAnswerChecked) {
                    if (isCorrect) {
                      btnStyle = "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm";
                    } else if (isSelected && !isCorrect) {
                      btnStyle = "border-rose-500 bg-rose-50 text-rose-700 animate-shake";
                    } else {
                      btnStyle = "opacity-40 border-gray-300 bg-gray-50 text-gray-500";
                    }
                  }

                  return (
                    <motion.button
                      key={idx}
                      whileHover={!isAnswerChecked ? { scale: 1.015, y: -1 } : {}}
                      whileTap={!isAnswerChecked ? { scale: 0.98 } : {}}
                      onClick={() => handleSelectOption(opt)}
                      disabled={isAnswerChecked}
                      className={`relative flex w-full items-center justify-between rounded-[12px] border-2 px-4 py-3 text-start transition-all font-gelica text-sm font-semibold ${btnStyle}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current font-mono text-[10px] opacity-75">
                          {idx + 1}
                        </span>
                        <span className="truncate">{opt}</span>
                      </div>

                      {isAnswerChecked && isCorrect && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1.2 }}
                          className="text-emerald-600 font-bold text-base shrink-0"
                        >
                          ✓
                        </motion.span>
                      )}
                      {isAnswerChecked && isSelected && !isCorrect && (
                        <span className="text-rose-500 font-bold text-base shrink-0">
                          ✕
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              <p className="text-center font-geist text-[10px] text-[var(--ink-soft)] pt-1">
                {t("hunt.key_hint1")} <strong>1</strong>, <strong>2</strong>, <strong>3</strong> {t("hunt.key_hint2")}
              </p>
            </div>
          )}

          {/* SONUÇ EKRANI */}
          {isPlaying && isFinished && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
              className="space-y-4 py-2 text-center"
            >
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-3xl">
                {successRate >= 80 ? t("hunt.perfect") : successRate >= 50 ? t("hunt.good_short") : t("hunt.good")}
              </div>

              <div>
                <h4 className="font-gelica text-xl font-bold text-[var(--ink)]">
                  {successRate >= 90
                    ? t("hunt.rating_top")
                    : successRate >= 70
                    ? t("hunt.great_hunt")
                    : successRate >= 50
                    ? t("hunt.nice")
                    : t("hunt.rating_low")}
                </h4>
                <p className="font-geist text-xs text-[var(--ink-soft)] mt-0.5">
                  {t("hunt.result_line").replace("{n}", String(totalQuestions)).replace("{s}", String(score)).replace("{p}", String(successRate))}
                </p>
              </div>

              {/* XP Kazanç Kartı */}
              {totalXpEarned > 0 && (
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-1.5 shadow-sm">
                  <SketchSparkles size={16} className="text-amber-600 shrink-0" strokeWidth={1.8} />
                  <span className="font-gelica text-xs font-bold text-amber-900">
                    {t("hunt.xp_earned").replace("{n}", String(totalXpEarned))}
                  </span>
                </div>
              )}

              {/* Yanlış bilinenler listesi ("bunlara tekrar bak") */}
              {wrongAnswers.length > 0 && (
                <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] p-3 text-start">
                  <span className="font-handwritten text-xs font-bold text-[var(--accent)] block mb-2">
                    {t("hunt.retry_wrong").replace("{n}", String(wrongAnswers.length))}
                  </span>
                  <div className="max-h-28 overflow-y-auto space-y-1.5 pe-1 scrollbar-thin">
                    {wrongAnswers.map((w) => (
                      <div
                        key={w.id}
                        className="flex items-baseline justify-between gap-2 text-xs font-geist border-b border-black/5 pb-1"
                      >
                        <span className="font-gelica font-semibold text-[var(--ink)]">
                          {w.article ? `${w.article} ` : ""}{w.word}
                        </span>
                        <span className="text-[var(--ink-soft)] truncate">
                          {w.translation}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Aksiyon butonları */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-[20px] border border-[var(--line)] py-2.5 font-gelica text-xs font-semibold text-[var(--ink)] hover:bg-[var(--app-bg)] transition-colors"
                >
                  {t("hunt.back")}
                </button>
                <button
                  onClick={startNewGame}
                  className="flex-1 rounded-[20px] bg-[var(--accent)] py-2.5 font-gelica text-xs font-bold text-white shadow-sm hover:opacity-95 transition-opacity"
                >
                  <span className="inline-flex items-center justify-center gap-1.5"><span>{t("hunt.play_again")}</span><SketchBow size={13} strokeWidth={1.8} /></span>
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
