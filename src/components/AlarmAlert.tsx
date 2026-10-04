import { AnimatePresence, motion } from "framer-motion";
import { DBellRing as BellRing } from "./icons/doodle";
import type { PersonalNote } from "../lib/types";
import { formatAlarmDate, stopAlarmBackgroundAlert } from "../lib/alarm";
import { useT } from "../i18n/I18nProvider";

interface AlarmAlertProps {
  note: PersonalNote | null;
  onDismiss: (id: string) => void;
  onSnooze: (id: string, minutes: number) => void;
  /** Hatırlatıcıyı günlüğe not olarak yazmak için günlüğü açar. */
  onOpenJournal?: (title: string, dateKey: string) => void;
}

/** Hatırlatıcının zamanı gelince ekranın ortasında çıkan alarm kartı. */
export function AlarmAlert({ note, onDismiss, onSnooze, onOpenJournal }: AlarmAlertProps) {
  const { t, lang } = useT();
  return (
    <AnimatePresence>
      {note && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-qa-modal="alarm-alert"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[950] flex items-center justify-center bg-black/40 p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: [0.9, 1.04, 1], y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="w-full max-w-sm bg-[var(--paper)] border border-[var(--line-strong)] rounded-[16px] shadow-superrCard p-6"
          >
            <div className="flex items-center gap-2 pb-3 border-b border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)]">
              <motion.span
                animate={{ rotate: [0, -12, 12, -8, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 1.4 }}
                className="text-[var(--accent)]"
              >
                <BellRing size={20} />
              </motion.span>
              <span className="font-gelica text-sm font-semibold lowercase text-[var(--accent)]">
                {t("alarm.reminder")} · {formatAlarmDate(note.reminderAt ?? Date.now(), lang)}
              </span>
            </div>

            <h3 className="mt-3 font-gelica text-[22px] font-semibold text-[var(--ink)] leading-tight">
              {note.title}
            </h3>
            {note.content && (
              <p className="mt-2 font-geist text-xs text-[var(--ink-soft)] leading-relaxed line-clamp-4">
                {note.content}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2">
            {onOpenJournal && (
              <button
                data-alarm-to-journal="1"
                onClick={() => {
                  const d = new Date(note.reminderAt ?? Date.now());
                  const p2 = (x: number) => String(x).padStart(2, "0");
                  const dk = d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
                  stopAlarmBackgroundAlert();
                  onDismiss(note.id);
                  onOpenJournal(note.title + (note.content ? ": " + note.content : ""), dk);
                }}
                className="btn-pill-superr text-xs inline-flex items-center gap-1"
              >
                <span className="text-[var(--accent)]">→</span>
                <span>{t("alarm.to_journal")}</span>
              </button>
            )}
              <button
                onClick={() => {
                  stopAlarmBackgroundAlert();
                  onDismiss(note.id);
                }}
                className="btn-pill-orange text-xs"
              >
                <span>{t("alarm.ok")}</span>
              </button>
              <button
                onClick={() => {
                  stopAlarmBackgroundAlert();
                  onSnooze(note.id, 10);
                }}
                className="btn-pill-superr text-xs"
              >
                <span>{t("alarm.snooze_10")}</span>
              </button>
              <button
                onClick={() => {
                  stopAlarmBackgroundAlert();
                  onSnooze(note.id, 60);
                }}
                className="btn-pill-superr text-xs"
              >
                <span>{t("alarm.snooze_60")}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
