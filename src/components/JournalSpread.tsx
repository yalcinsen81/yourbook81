import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SketchOpenBook } from "./icons/sketchIcons";
import { DChevronLeft as ChevronLeft, DChevronRight as ChevronRight, DX as Close } from "./icons/doodle";
import { useT } from "../i18n/I18nProvider";
import { playPaperRustle } from "../lib/sound";
import { JournalEntry } from "./JournalView";

/** Düzenleme için ruh hali kimlikleri. */
const MOOD_IDS = ["peaceful", "productive", "calm", "tired", "tense", "hard"];

interface JournalSpreadProps {
  entries: JournalEntry[];
  onClose: () => void;
  onEdit?: (entry: JournalEntry) => void;
  /** Boş bir sayfada yeni günlük girdisi oluştur. */
  onCreateEntry?: (dateKey: string, content: string, mood: string | null) => void;
  /** Sayfa içi düzenlemeyi kaydet. */
  onSaveEntry?: (entryId: string, changes: { content: string; mood: string | null }) => void;
  /** İlk açılışta gösterilecek girdi (opsiyonel). */
  initialEntryId?: string | null;
  /** Duygu etiketi çevirici (JournalView'deki moodLabel ile aynı). */
  moodLabel: (moodId: string) => string;
  /** Duygu ikonu çizici. */
  renderMoodIcon: (moodId: string, size?: number) => React.ReactNode;
}

/**
 * Defter Çift Sayfa (Book Spread) Okuma Modu
 * Girdileri sol/sağ sayfa olarak, açık bir defter gibi gösterir.
 * Klavye: ← / → ile sayfa çevir, Esc ile kapat.
 */
export default function JournalSpread({
  entries,
  onClose,
  onEdit,
  onSaveEntry,
  onCreateEntry,
  initialEntryId,
  moodLabel,
  renderMoodIcon,
}: JournalSpreadProps) {
  const { t } = useT();

  // Kronolojik sıralama (en eski solda)
  const ordered = useMemo(
    () => [...entries].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)),
    [entries]
  );

  // Spread indeksi: her spread 2 sayfa gösterir.
  const startIndex = useMemo(() => {
    if (!initialEntryId) return 0;
    const i = ordered.findIndex((e) => e.id === initialEntryId);
    if (i < 0) return 0;
    return Math.floor(i / 2) * 2;
  }, [initialEntryId, ordered]);

  const [spreadIndex, setSpreadIndex] = useState(startIndex);
  useEffect(() => setSpreadIndex(startIndex), [startIndex]);

  // --- Sayfa içi düzenleme ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [draftMood, setDraftMood] = useState<string | null>(null);

  // Boş sayfa için: o güne yeni girdi yazılıyor mu?
  const [newPageDateKey, setNewPageDateKey] = useState<string | null>(null);

  // Girdi sayısı tek ise son spread'in sağ sayfası, çift ise fazladan bir spread
  // boş kalır ve "bu güne yaz" davetini gösterir (yalnızca yazma açıkken).
  const hasTrailingBlank = !!onCreateEntry && ordered.length % 2 === 0;
  const totalSpreads = Math.max(1, Math.ceil(ordered.length / 2) + (hasTrailingBlank ? 1 : 0));
  const currentSpread = Math.floor(spreadIndex / 2);
  const left = ordered[spreadIndex] || null;
  const right = ordered[spreadIndex + 1] || null;

  // --- Düzenleme yardımcıları ---
  const startEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setDraft(entry.content || "");
    setDraftMood(entry.mood || null);
    playPaperRustle();
  };

  const startNewPage = (dateKey: string) => {
    setNewPageDateKey(dateKey);
    setDraft("");
    setDraftMood("peaceful");
    playPaperRustle();
  };

  const cancelNewPage = () => {
    setNewPageDateKey(null);
    setDraft("");
    setDraftMood(null);
  };

  const saveNewPage = () => {
    if (!newPageDateKey || !draft.trim()) return;
    onCreateEntry?.(newPageDateKey, draft.trim(), draftMood);
    cancelNewPage();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft("");
    setDraftMood(null);
  };

  const saveEdit = () => {
    if (!editingId) return;
    onSaveEntry?.(editingId, { content: draft.trim(), mood: draftMood });
    cancelEdit();
  };

  /** Kaydedilmemiş değişiklik var mı? */
  const isDirty = (entry: JournalEntry | null) =>
    !!entry && editingId === entry.id && (draft !== (entry.content || "") || draftMood !== (entry.mood ?? null));

  const hasUnsaved = isDirty(left) || isDirty(right) || !!newPageDateKey;

  const go = (dir: -1 | 1) => {
    // Düzenleme veya yeni sayfa yazımı sırasında sayfa çevirme (veri kaybını önle)
    if (editingId || newPageDateKey) return;
    const next = currentSpread + dir;
    if (next < 0 || next >= totalSpreads) return;
    playPaperRustle();
    setSpreadIndex(next * 2);
  };

  // Klavye kısayolları
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingId) { cancelEdit(); return; }
        if (newPageDateKey) { cancelNewPage(); return; }
        if (hasUnsaved && !window.confirm(t("spread.discard_confirm"))) return;
        onClose();
        return;
      }
      else if (e.key === "ArrowRight") { if (!editingId) go(1); }
      else if (e.key === "ArrowLeft") { if (!editingId) go(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSpread, totalSpreads, onClose, editingId, hasUnsaved]);

  const page = (entry: JournalEntry | null, side: "left" | "right", slotIndex: number) => {
    // Boş sayfa: hangi güne yazılacağını belirle
    const p2 = (n: number) => String(n).padStart(2, "0");
    const dayAfter = (key: string) => {
      const d = new Date(key + "T00:00:00");
      d.setDate(d.getDate() + 1);
      return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
    };
    const todayKey = (() => {
      const d = new Date();
      return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
    })();
    const _lastEntry = ordered[ordered.length - 1];
    const _afterLast = _lastEntry ? dayAfter(_lastEntry.dateKey) : todayKey;
    const blankDateKey = _afterLast > todayKey ? todayKey : _afterLast;
    const editingBlank = newPageDateKey === blankDateKey;
    void slotIndex;

    const isLeft = side === "left";
    const editing = !!entry && editingId === entry.id;
    return (
      <div
        data-lovable-target="journal-spread"
        data-lovable-name="Bölüm: Defter Çift Sayfa"
        data-lovable-file="src/components/JournalSpread.tsx"
        data-lovable-desc="Defter çift sayfa okuma/düzenleme görünümü"
        className={`relative flex-1 min-h-[340px] sm:min-h-[400px] p-6 sm:p-8 paper-texture-surface ${
          isLeft
            ? "rounded-l-[6px] border-r border-dashed border-[color-mix(in_srgb,var(--ink)_18%,transparent)]"
            : "rounded-r-[6px]"
        }`}
        style={{
          // Defter kıvrımı: iç kenara doğru hafif gölge
          backgroundImage: isLeft
            ? "linear-gradient(to left, rgba(28,25,23,0.06), transparent 14%)"
            : "linear-gradient(to right, rgba(28,25,23,0.06), transparent 14%)",
        }}
      >
        {entry ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-black/5 gap-2">
              <span className="font-mono text-[11px] font-bold text-[var(--ink)]">
                {entry.dateKey} · {entry.timeStr}
              </span>
              {!editing && entry.mood && (
                <span className="inline-flex items-center gap-1 text-[10px] font-gelica text-[var(--ink-soft)]">
                  <span className="shrink-0">{renderMoodIcon(entry.mood, 13)}</span>
                  <span>{moodLabel(entry.mood)}</span>
                </span>
              )}
            </div>

            {editing ? (
              <>
                {/* Ruh hali seçici */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {["peaceful","productive","calm","tired","tense","hard"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      data-spread-mood={m}
                      onClick={() => setDraftMood(draftMood === m ? null : m)}
                      title={moodLabel(m)}
                      aria-pressed={draftMood === m}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-gelica text-[10px] transition ${
                        draftMood === m
                          ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                          : "border-[var(--ink)] text-[var(--ink-soft)] hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
                      }`}
                    >
                      <span className="shrink-0">{renderMoodIcon(m, 12)}</span>
                    </button>
                  ))}
                </div>

                {/* Metin düzenleme */}
                <textarea
                  data-spread-editor="1"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoFocus
                  className="notebook-ruled-lines mt-3 w-full flex-1 resize-none bg-transparent font-handwritten text-lg sm:text-xl leading-relaxed text-[var(--ink)] outline-none select-text"
                />

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-[var(--ink-soft)]">
                    {draft.trim().split(/\s+/).filter(Boolean).length} {t("spread.words")}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-spread-cancel="1"
                      onClick={cancelEdit}
                      className="rounded-full border border-[var(--line)] px-3 py-1 font-gelica text-[11px] font-semibold text-[var(--ink)] transition hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
                    >
                      {t("act.cancel")}
                    </button>
                    <button
                      type="button"
                      data-spread-save="1"
                      onClick={saveEdit}
                      className="rounded-full border border-[var(--line)] bg-[var(--accent)] px-3 py-1 font-gelica text-[11px] font-bold text-white transition hover:brightness-95"
                    >
                      {t("act.save")}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="mt-4 flex-1 font-handwritten text-lg sm:text-xl leading-relaxed text-[var(--ink)] whitespace-pre-wrap overflow-y-auto">
                  {entry.content}
                </p>

                {entry.promptUsed && (
                  <span className="mt-3 block font-handwritten text-[11px] text-[var(--ink-soft)]">
                    {t("spread.inspiration")}: "{entry.promptUsed}"
                  </span>
                )}

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-[var(--ink-soft)]">
                    {entry.content.trim().split(/\s+/).filter(Boolean).length} {t("spread.words")}
                  </span>
                  <div className="flex items-center gap-3">
                    {onSaveEntry && (
                      <button
                        type="button"
                        data-spread-edit="1"
                        onClick={() => startEdit(entry)}
                        className="font-gelica text-[11px] font-semibold text-[var(--accent)] hover:underline"
                      >
                        {t("spread.edit_inline")}
                      </button>
                    )}
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(entry)}
                        className="font-gelica text-[11px] font-semibold text-[var(--ink-soft)] hover:underline"
                      >
                        {t("act.open")}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Sayfa numarası */}
            <span className="mt-2 text-center font-mono text-[10px] text-[var(--ink-soft)] opacity-70">
              {ordered.indexOf(entry) + 1}
            </span>
          </div>
        ) : editingBlank ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-black/5 gap-2">
              <span className="font-mono text-[11px] font-bold text-[var(--ink)]">
                {newPageDateKey} · {t("spread.new_page_label")}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {MOOD_IDS.map((m) => (
                <button
                  key={m}
                  type="button"
                  data-spread-mood={m}
                  onClick={() => setDraftMood(draftMood === m ? null : m)}
                  title={moodLabel(m)}
                  aria-pressed={draftMood === m}
                  className={
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-gelica text-[10px] transition " +
                    (draftMood === m
                      ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                      : "border-[var(--ink)] text-[var(--ink-soft)] hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]")
                  }
                >
                  <span className="shrink-0">{renderMoodIcon(m, 12)}</span>
                </button>
              ))}
            </div>

            <textarea
              data-spread-new-editor="1"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              placeholder={t("spread.new_page_ph")}
              className="notebook-ruled-lines mt-3 w-full flex-1 resize-none bg-transparent font-handwritten text-lg sm:text-xl leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-soft)] outline-none select-text"
            />

            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-[var(--ink-soft)]">
                {draft.trim().split(/\s+/).filter(Boolean).length} {t("spread.words")}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-spread-new-cancel="1"
                  onClick={cancelNewPage}
                  className="rounded-full border border-[var(--line)] px-3 py-1 font-gelica text-[11px] font-semibold text-[var(--ink)] transition hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
                >
                  {t("act.cancel")}
                </button>
                <button
                  type="button"
                  data-spread-new-save="1"
                  onClick={saveNewPage}
                  disabled={!draft.trim()}
                  className="rounded-full border border-[var(--line)] bg-[var(--accent)] px-3 py-1 font-gelica text-[11px] font-bold text-white transition hover:brightness-95 disabled:opacity-40"
                >
                  {t("act.save")}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            data-spread-new-page="1"
            disabled={!onCreateEntry}
            onClick={() => onCreateEntry && startNewPage(blankDateKey)}
            className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-[6px] transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] disabled:cursor-default disabled:hover:bg-transparent"
          >
            <span className="font-handwritten text-sm text-[var(--ink-soft)] opacity-60">
              {t("spread.blank_page")}
            </span>
            {onCreateEntry && (
              <span className="font-gelica text-[11px] font-semibold text-[var(--accent)]">
                + {t("spread.write_this_day")} · {blankDateKey}
              </span>
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6 select-none"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={t("spread.title")}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, rotateX: -6 }}
          animate={{ scale: 1, opacity: 1, rotateX: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl"
          style={{ perspective: 1200 }}
        >
          {/* Üst şerit */}
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white/90">
              <SketchOpenBook size={18} strokeWidth={1.8} />
              <span className="font-gelica text-sm font-bold lowercase">{t("spread.title")}</span>
              <span className="font-mono text-[11px] text-white/60">
                {currentSpread + 1} / {totalSpreads}
              </span>
              {hasUnsaved && (
                <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 font-gelica text-[10px] font-bold text-white">
                  {t("spread.unsaved")}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-full border-white/40 p-1.5 text-white/90 hover:bg-white/15"
              aria-label={t("act.close")}
            >
              <Close size={16} />
            </button>
          </div>

          {/* Açık defter */}
          <div
            className="relative flex w-full overflow-hidden rounded-[8px] border border-[var(--line-strong)] bg-[var(--paper)] shadow-2xl"
            style={{ minHeight: 380 }}
          >
            {page(left, "left", spreadIndex)}

            {/* Orta kat (spine) */}
            <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[color-mix(in_srgb,var(--ink)_22%,transparent)]" />

            {page(right, "right", spreadIndex + 1)}
          </div>

          {/* Alt şerit: gezinme */}
          <div className="mt-3 flex items-center justify-center gap-4">
            <button
              onClick={() => go(-1)}
              disabled={editingId !== null || currentSpread === 0}
              className="inline-flex items-center gap-1 rounded-full border-white/40 px-3 py-1.5 font-gelica text-xs text-white/90 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={t("spread.prev")}
            >
              <ChevronLeft size={14} /> {t("spread.prev")}
            </button>
            <span className="font-mono text-[11px] text-white/60">
              {editingId ? t("spread.editing_hint") : t("spread.hint")}
            </span>
            <button
              onClick={() => go(1)}
              disabled={editingId !== null || currentSpread >= totalSpreads - 1}
              className="inline-flex items-center gap-1 rounded-full border-white/40 px-3 py-1.5 font-gelica text-xs text-white/90 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={t("spread.next")}
            >
              {t("spread.next")} <ChevronRight size={14} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
