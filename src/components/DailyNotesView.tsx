import { useState, useEffect } from "react";
import { UndoToast, type UndoToastData } from "./UndoToast";
import { useT } from "../i18n/I18nProvider";
import { langToLocale } from "../i18n";
import { motion } from "framer-motion";
import { DPlus as Plus, DTrash as Trash2 } from "./icons/doodle";
import { playPopSound, playSuccessSound, playPenScratch } from "../lib/sound";
import { SketchEmptyTasks } from "./icons/EmptyStateIllustrations";

interface DailyTask {
  id: string;
  text: string;
  isDone: boolean;
  createdAt: number;
}

const STORAGE_KEY_TASKS = "superr_daily_tasks_v3";
const STORAGE_KEY_NOTE = "superr_daily_thought_v3";

interface DailyNotesViewProps {
  onOpenJournal?: () => void;
}

export function DailyNotesView({ onOpenJournal }: DailyNotesViewProps = {}) {
  const { t, lang } = useT();
  const [tasks, setTasks] = useState<DailyTask[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TASKS);
      if (raw) return JSON.parse(raw).filter((item: DailyTask) => item.text !== "fhsfgjsfgjsjg" && item.text !== "hzfdzhzdgfhzdgh");
    } catch {}
    return [
      { id: "t1", text: t("daily.def.t1"), isDone: true, createdAt: Date.now() },
      { id: "t2", text: t("daily.def.t2"), isDone: false, createdAt: Date.now() },
      { id: "t3", text: t("daily.def.t3"), isDone: false, createdAt: Date.now() },
    ];
  });

  const [thought, setThought] = useState<string>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY_NOTE) || "").replace("Test notu eklendi.", "");
    } catch {}
    return "";
  });

  const [newTaskInput, setNewTaskInput] = useState("");
  // MADDE 2: silme sonrasi "Silindi · Geri al" (5 sn).
  const [undoToast, setUndoToast] = useState<UndoToastData | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
    } catch {}
  }, [tasks]);

  useEffect(() => {
    try {
      if (thought) localStorage.setItem(STORAGE_KEY_NOTE, thought); else localStorage.removeItem(STORAGE_KEY_NOTE);
    } catch {}
  }, [thought]);

  // Seed metinlerini dil degisiminde tazele (varsayilan seed id'leri + varsayilan dusunce).
  useEffect(() => {
    setTasks((prev) => prev.map((tk) => {
      if (tk.id === "t1") return { ...tk, text: t("daily.def.t1") };
      if (tk.id === "t2") return { ...tk, text: t("daily.def.t2") };
      if (tk.id === "t3") return { ...tk, text: t("daily.def.t3") };
      return tk;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const handleToggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextDone = !t.isDone;
          if (nextDone) {
            playPenScratch();
            playSuccessSound();
          } else {
            playPopSound();
          }
          return { ...t, isDone: nextDone };
        }
        return t;
      })
    );
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskInput.trim()) return;
    playPenScratch();
    const newTask: DailyTask = {
      id: "task-" + Date.now(),
      text: newTaskInput.trim(),
      isDone: false,
      createdAt: Date.now(),
    };
    setTasks((prev) => [newTask, ...prev]);
    setNewTaskInput("");
  };

  // MADDE 2: silme GERI ALINABILIR. Silinen kayit ve KONUMU saklanir;
  // toast'taki "geri al" basilirsa ayni yere geri konur.
  const handleDeleteTask = (id: string) => {
    playPopSound();
    const index = tasks.findIndex((t) => t.id === id);
    const deleted = tasks[index];
    if (!deleted) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setUndoToast({
      id: Date.now(),
      message: "Silindi · Geri al",
      onUndo: () => {
        setTasks((prev) => {
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, deleted);
          return next;
        });
      },
    });
  };

  const todayDateStr = new Date().toLocaleDateString(langToLocale(lang), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const completedCount = tasks.filter((t) => t.isDone).length;

  return (
    <div className="paper-grain flex h-full w-full flex-col overflow-y-auto px-4 sm:px-10 py-4 sm:py-10 bg-[var(--app-bg)] text-[var(--ink)] scrollbar-thin">
      {/* 1. Günün Tarih Başlığı (Gelica Lowercase) */}
      <div className="border-b-2 border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] pb-5">
        <div className="flex items-center justify-between pb-1.5">
          <span className="font-handwritten text-[var(--accent)] text-sm font-bold">
            {t("daily.sub")}
          </span>
          <span className="rounded-[20px] border border-[var(--ink)] bg-[var(--paper)] px-3 py-1 font-gelica text-xs text-[var(--ink)] font-semibold">
            {t("daily.done_of", { done: completedCount, total: tasks.length })}
          </span>
        </div>

        <h2 className="font-gelica text-[38px] sm:text-[46px] font-semibold lowercase text-[var(--ink)] leading-tight">
          {todayDateStr}.
        </h2>
      </div>

      {/* 2. Serbest Düşünce Alanı (Card-Superr + kağıt greni) */}
      <div className="paper-grain mt-6 card-superr p-6 relative">
        <div className="flex items-center justify-between pb-2">
          <span className="font-gelica text-xs font-semibold lowercase text-[var(--accent)]">
            {t("daily.focus")}
          </span>
          <span className="font-geist text-xs text-[var(--ink-soft)]">{t("daily.autosave")}</span>
        </div>
        <textarea
          value={thought || t("daily.def.thought")}
          onChange={(e) => setThought(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "a" || e.code === "KeyA")) {
              e.stopPropagation();
              e.currentTarget.select();
            }
          }}
          placeholder={t("daily.thought_ph")}
          rows={3}
          className="notebook-ruled-lines w-full resize-none font-gelica text-[18px] leading-[1.75rem] text-[var(--ink)] placeholder:text-[var(--ink-soft)] bg-transparent outline-none select-text"
        />
      </div>

      {/* 3. Görev Çentikleri */}
      <div className="mt-8 flex flex-col gap-4 max-w-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-gelica text-[26px] font-semibold lowercase text-[var(--ink)]">
            {t("daily.tasks")}
          </h3>
          <span className="font-mono text-xs text-[var(--ink-soft)]">[{tasks.length}]</span>
        </div>

        <form onSubmit={handleAddTask} className="relative flex items-center">
          <input
            type="text"
            value={newTaskInput}
            onChange={(e) => setNewTaskInput(e.target.value)}
            placeholder={t("daily.task_ph")}
            className="w-full rounded-[20px] border-[1.5px] border-[var(--ink)] bg-[var(--app-bg)] px-4 py-2.5 pe-12 font-geist text-xs text-[var(--ink)] placeholder:text-[var(--ink-soft)] outline-none focus:border-[var(--accent)] shadow-superrButton"
          />
          <button
            type="submit"
            className="absolute end-2 flex h-8 w-8 items-center justify-center rounded-[20px] bg-[var(--ink)] text-[var(--app-bg)] hover:bg-[var(--accent)]"
          >
            <Plus size={14} />
          </button>
        </form>

        <div className="space-y-2 mt-1">
          {tasks.length > 0 ? (
            // MADDE 7: TAMAMLANAN gorevler LISTENIN ALTINA tasinir (stable sort).
            [...tasks]
              .sort((a, b) => Number(a.isDone) - Number(b.isDone))
              .map((task) => (
              <div
                key={task.id}
                className={`group flex items-center justify-between rounded-[20px] border-[1.5px] border-[var(--ink)] p-3.5 transition-colors ${
                  task.isDone
                    ? "bg-[var(--paper)] opacity-70"
                    : "bg-[var(--app-bg)] hover:border-[var(--accent)]"
                }`}
              >
                <div
                  onClick={() => handleToggleTask(task.id)}
                  className="flex items-center gap-3 flex-1 cursor-pointer select-none"
                >
                  <button type="button" className="flex items-center justify-center">
                    <motion.span
                      key={task.isDone ? "done" : "undone"}
                      initial={false}
                      animate={
                        task.isDone
                          ? { scale: [0.8, 1.15, 1], opacity: 1 }
                          : { scale: [1.15, 0.9, 1], opacity: 1 }
                      }
                      transition={{ duration: task.isDone ? 0.22 : 0.15, ease: "easeOut" }}
                      className="flex items-center justify-center"
                    >
                      {task.isDone ? (
                        <span className="relative flex items-center justify-center w-[20px] h-[20px] rounded-full border-[1.5px] border-[#22c55e] bg-[#22c55e]/15">
                          <svg
                            width={13}
                            height={13}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#22c55e"
                            strokeWidth={2.8}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="animate-draw-check"
                          >
                            <path d="M4.5 12.5l5 5 10-11" />
                          </svg>
                        </span>
                      ) : (
                        <span className="flex items-center justify-center w-[20px] h-[20px] rounded-full border-[1.5px] border-[var(--ink-soft)] group-hover:border-[var(--accent)] transition-colors" />
                      )}
                    </motion.span>
                  </button>
                  <span
                    className={`task-strike font-geist text-sm transition-opacity duration-200 ${
                      task.isDone
                        ? "task-done text-[var(--ink-soft)] opacity-70"
                        : "text-[var(--ink)] font-medium"
                    }`}
                  >
                    {task.text}
                  </span>
                </div>

                <button
                  onClick={() => handleDeleteTask(task.id)}
                  /* MADDE 3: mobilde (hover yok) HER ZAMAN gorunur; masaustunde hover davranisi kalir. */
                  className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-1 text-[var(--ink-soft)] hover:text-red-600 transition-opacity"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          ) : (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <SketchEmptyTasks size={105} />
              <p className="font-gelica text-base font-semibold text-[var(--ink)] mt-3">
                {t("daily.empty")}
              </p>
              <p className="font-handwritten text-sm text-[var(--accent)] mt-0.5 font-bold">
                {t("daily.empty_hint")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
