import { useState, useMemo, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "../i18n/I18nProvider";
import type { WordCard } from "../lib/types";
import { buildQuiz, evaluateQuiz } from "../lib/quiz";
import type { QuizQuestion, QuizAnswerRecord, QuizReport } from "../lib/quiz";

interface QuizModeProps {
  pool: WordCard[];
  allCards?: WordCard[];
  count?: number;
  onFinish?: (report: QuizReport) => void;
  onClose: () => void;
}

type Phase = "intro" | "running" | "result";

export default function QuizMode({ pool, allCards, count = 10, onFinish, onClose }: QuizModeProps) {
  const { t } = useT();
  const [phase, setPhase] = useState<Phase>("intro");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [answers, setAnswers] = useState<QuizAnswerRecord[]>([]);
  const [report, setReport] = useState<QuizReport | null>(null);
  const questionAt = useRef(0);

  const canStart = pool.length >= 3;

  const start = useCallback(() => {
    const qs = buildQuiz(pool, {
      count,
      fallbackPool: allCards ?? [],
      subKeys: {
        wordToTrans: t("quiz.ask_meaning"),
        transToWord: t("quiz.ask_word"),
        article: t("quiz.ask_article"),
      },
    });
    if (!qs.length) return;
    setQuestions(qs);
    setIdx(0);
    setPicked(null);
    setAnswers([]);
    setReport(null);
    setPhase("running");
    questionAt.current = Date.now();
  }, [pool, allCards, count, t]);

  const current = questions[idx];
  const isLast = idx === questions.length - 1;

  function commit(choice: string | null) {
    if (picked !== null || !current) return;
    const elapsedMs = Date.now() - questionAt.current;
    setPicked(choice);
    setAnswers((a) => [
      ...a,
      {
        question: current,
        picked: choice,
        isCorrect: choice === current.correctAnswer,
        elapsedMs,
      },
    ]);
  }

  function next() {
    if (isLast) {
      const rep = evaluateQuiz(answers);
      setReport(rep);
      setPhase("result");
      onFinish?.(rep);
      return;
    }
    setIdx((i) => i + 1);
    setPicked(null);
    questionAt.current = Date.now();
  }

  const wrongCount = answers.filter((a) => !a.isCorrect).length;
  const progress = questions.length ? Math.round((idx / questions.length) * 100) : 0;

  if (phase === "intro") {
    return (
      <ModalShell onClose={onClose} title={t("quiz.title")} kicker={t("quiz.kicker")}
        data-lovable-target="quiz-mode"
        data-lovable-name="Modal: Quiz Modu"
        data-lovable-file="src/components/QuizMode.tsx"
        data-lovable-desc="Kelime quiz modu"
      >
        {canStart ? (
          <div className="text-center py-4">
            <p className="font-gelica text-[15px] text-[var(--ink)] mb-1">
              {t("quiz.start_hint").replace("{n}", String(Math.min(count, pool.length)))}
            </p>
            <button
              onClick={start}
              className="mt-4 rounded-[14px] bg-[var(--ink)] px-6 py-2.5 font-gelica text-[13px] font-bold text-white transition hover:opacity-90"
            >
              {t("quiz.start")}
            </button>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="font-gelica text-[14px] text-[var(--ink)] mb-1">{t("quiz.empty")}</p>
            <p className="font-mono text-[11px] text-[var(--ink-soft)]">{t("quiz.min_required").replace("{n}", String(pool.length))}</p>
          </div>
        )}
      </ModalShell>
    );
  }

  if (phase === "result" && report) {
    return (
      <ModalShell onClose={onClose} title={t("quiz.result_title")} kicker={t("quiz.kicker")}>
        <div className="py-2">
          <div className="text-center mb-5">
            <div className="font-gelica text-[34px] font-bold text-[var(--ink)] leading-none">
              {report.percent}%
            </div>
            <p className="font-mono text-[12px] text-[var(--ink-soft)] mt-1.5">
              {t("quiz.score")
                .replace("{correct}", String(report.correct))
                .replace("{total}", String(report.total))}
            </p>
            <p className="font-mono text-[10px] text-[var(--ink-soft)] mt-1">
              {t("quiz.time")}: {Math.round(report.totalMs / 1000)}s
            </p>
          </div>

          <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_10%,transparent)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all"
              style={{ width: report.percent + "%" }}
            />
          </div>

          {report.wrongCards.length === 0 ? (
            <p className="text-center font-gelica text-[13px] text-[var(--accent)] py-2">
              {t("quiz.no_wrong")}
            </p>
          ) : (
            <div className="mb-4">
              <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--ink-soft)] mb-2">
                {t("quiz.review_wrong")}
              </p>
              <ul className="space-y-1.5 max-h-[180px] overflow-y-auto">
                {report.wrongCards.map((c, i) => (
                  <li
                    key={c.id + "-" + i}
                    data-quiz-wrong={c.id}
                    className="flex items-center justify-between rounded-[10px] border border-[color-mix(in_srgb,var(--ink)_16%,transparent)] px-2.5 py-1.5"
                  >
                    <span className="font-gelica text-[12px] text-[var(--ink)]">
                      {c.article ? c.article + " · " : ""}{c.word}
                    </span>
                   <span className="font-mono text-[11px] text-[var(--ink-soft)]">{c.translation}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 font-mono text-[10px] text-[var(--accent)]">
                {t("quiz.srs_note").replace("{n}", String(report.wrongCards.length))}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={start}
              className="flex-1 rounded-[12px] bg-[var(--ink)] px-4 py-2 font-gelica text-[12px] font-bold text-white transition hover:opacity-90"
            >
              {t("quiz.retry")}
            </button>
            <button
              onClick={onClose}
              className="flex-1 rounded-[12px] border border-[var(--line)] px-4 py-2 font-gelica text-[12px] font-bold text-[var(--ink)] transition hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]"
            >
              {t("act.close")}
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  if (!current) return null;

  return (
    <ModalShell
      onClose={onClose}
      title={t("quiz.title")}
      kicker={t("quiz.question_of")
        .replace("{i}", String(idx + 1))
        .replace("{n}", String(questions.length))}
    >
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_10%,transparent)]">
        <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: progress + "%" }} />
      </div>

      <div className="mb-4 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
          >
            <div
              data-quiz-prompt
              className="font-gelica text-[26px] font-bold leading-tight text-[var(--ink)] [overflow-wrap:break-word]"
            >
              {current.prompt}
            </div>
            <p className="mt-1.5 font-mono text-[10px] text-[var(--ink-soft)]">
              {t(current.promptSubKey)}
              {current.targetWord ? " · " + current.targetWord : ""}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="grid gap-2">
        {current.options.map((opt) => {
          const isCorrect = opt === current.correctAnswer;
          const isPicked = opt === picked;
          const revealed = picked !== null;
          let cls =
            "border-[color-mix(in_srgb,var(--ink)_22%,transparent)] text-[var(--ink)] hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]";
          if (revealed && isCorrect) {
            cls = "border-[var(--color-success)] bg-[color-mix(in_srgb,var(--color-success)_14%,transparent)] text-[var(--ink)]";
          } else if (revealed && isPicked) {
            cls = "border-red-400 bg-red-50 text-red-700";
          } else if (revealed) {
            cls = "border-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-[var(--ink-soft)] opacity-60";
          }
          return (
            <button
              key={opt}
              data-quiz-option={opt}
              onClick={() => commit(opt)}
              disabled={revealed}
              className={"rounded-[12px] border px-3.5 py-2.5 text-start font-gelica text-[13px] transition " + cls}
            >
              {opt}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="min-h-[20px]" data-quiz-feedback>
          {picked !== null ? (
            <span
              className={
                "font-gelica text-[12px] font-bold " +
                (picked === current.correctAnswer ? "text-[var(--accent)]" : "text-[var(--color-danger)]")
              }
            >
              {picked === current.correctAnswer
                ? t("quiz.correct")
                : `${t("quiz.wrong")} · ${t("quiz.correct_was")} ${current.correctAnswer}`}
            </span>
          ) : null}
        </div>
        <div className="flex gap-2">
          {picked === null ? (
            <button
              onClick={() => commit(null)}
              className="rounded-[10px] border border-[color-mix(in_srgb,var(--ink)_24%,transparent)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
            >
              {t("quiz.skip")}
            </button>
          ) : (
            <button
              data-quiz-next
              onClick={next}
              className="rounded-[11px] bg-[var(--ink)] px-4 py-1.5 font-gelica text-[12px] font-bold text-white transition hover:opacity-90"
            >
              {isLast ? t("quiz.finish") : t("quiz.next")}
            </button>
          )}
        </div>
      </div>

      {wrongCount > 0 ? (
        <p className="mt-3 text-center font-mono text-[10px] text-[var(--ink-soft)]">
          {t("quiz.wrong")}: {wrongCount}
        </p>
      ) : null}
    </ModalShell>
  );
}

function ModalShell({
  children,
  onClose,
  title,
  kicker,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
  kicker: string;
}) {
  const { t } = useT();
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      data-qa-modal="quiz"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-[20px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-5 shadow-xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--accent)]">{kicker}</p>
            <h3 className="font-gelica text-[17px] font-bold text-[var(--ink)]">{title}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label={t("quiz.quit")}
            title={t("quiz.quit")}
            className="rounded-full border border-[color-mix(in_srgb,var(--ink)_24%,transparent)] px-2 py-0.5 font-mono text-[11px] text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
          >
            ✕
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
