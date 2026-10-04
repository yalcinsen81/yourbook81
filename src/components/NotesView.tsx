import {
  useState,
  useRef } from "react"; import { useT } from "../i18n/I18nProvider"; import { AnimatePresence,
  motion } from "framer-motion"; import { DBell as Bell,
  DBellOff as BellOff,
  DBook as BookOpen,
  DBriefcase as Briefcase,
  DCalendar as Calendar,
  DCheck as Check,
  DClock as Clock,
  DCoffee as Coffee,
  DImage as ImageIcon,
  DLighbulb as Lightbulb,
  DPin as Pin,
  DPlus as Plus,
  DSearch as Search,
  DTag as Tag,
  DTrash as Trash2,
  DX as X,
  DNote,
} from "./icons/doodle";
import type { NoteCategory, PersonalNote } from "../lib/types";
import { CATEGORY_MAP, useNotes } from "../lib/notes";
import { UndoToast, type UndoToastData } from "./UndoToast";
import { formatNoteDate, formatAlarmDate, getAlarmRemainingText } from "../lib/alarm";
import { processAndCompressImage } from "../lib/imageHelper";
import { playPopSound, playPinSound, playSuccessSound } from "../lib/sound";
import { getCardRotationStyle } from "../lib/paperStyles";
import { SketchEmptyNotes, SketchEmptySearch } from "./icons/EmptyStateIllustrations";

const SPRING = {
  type: "spring",
  stiffness: 400,
  damping: 30,
} as const;

const CATEGORY_ICONS = {
  work: Briefcase,
  ideas: Lightbulb,
  reminders: Bell,
  quotes: BookOpen,
  personal: Coffee,
};

/** Günlüğe taşıma: not metnini günlük istemi olarak açar. */
interface NotesViewProps {
  onSendToJournal?: (title: string, content: string) => void;
}

export function NotesView({ onSendToJournal }: NotesViewProps) {
  const { t, lang } = useT();
  const {
    filteredNotes,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    categoryCounts,
    addNote,
    updateNote,
    deleteNote,
    restoreNote,
    togglePin,
    setNoteAlarm,
  } = useNotes();

  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<NoteCategory>("work");
  const [newTags, setNewTags] = useState("");
  const [newImageUrl, setNewImageUrl] = useState<string | undefined>(undefined);

  const [undoToast, setUndoToast] = useState<UndoToastData | null>(null);

  const [hasAlarm, setHasAlarm] = useState(false);
  const [alarmDateTime, setAlarmDateTime] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardFileInputRef = useRef<HTMLInputElement>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  const handleComposerPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await processAndCompressImage(file, 800, 0.82);
      setNewImageUrl(base64);
      playSuccessSound();
    } catch (err) {
      console.error(err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCardPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingCardId) return;
    try {
      const base64 = await processAndCompressImage(file, 800, 0.82);
      updateNote(editingCardId, { imageUrl: base64 });
      playSuccessSound();
    } catch (err) {
      console.error(err);
    } finally {
      setEditingCardId(null);
      if (cardFileInputRef.current) cardFileInputRef.current.value = "";
    }
  };

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() && !newContent.trim()) return;

    const tags = newTags
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => "#" + t.replace(/^#+/, ""))       // basta birden fazla # varsa teke indir
      .filter((t) => t.length > 1)                     // sadece "#" kalmasin
      .filter((t, idx, arr) => arr.indexOf(t) === idx); // ayni etiket tekrarlanmasin

    let reminderAt: number | null = null;
    if (hasAlarm && alarmDateTime) {
      const parsed = new Date(alarmDateTime).getTime();
      if (!isNaN(parsed)) reminderAt = parsed;
    }

    playSuccessSound();
    addNote({
      title: newTitle.trim() || t("notes.untitled"),
      content: newContent.trim(),
      category: newCategory,
      imageUrl: newImageUrl,
      tags,
      isPinned: false,
      reminderAt,
      isAlarmTriggered: false,
    });

    setNewTitle("");
    setNewContent("");
    setNewTags("");
    setNewImageUrl(undefined);
    setHasAlarm(false);
    setAlarmDateTime("");
    setIsComposerOpen(false);
  };

  const categories: Array<{ id: NoteCategory | "all"; label: string }> = [
    { id: "all", label: t("notes.all_tag") },
    { id: "work", label: t("notes.tag_work") },
    { id: "ideas", label: t("ncat.ideas") },
    { id: "reminders", label: t("notes.reminder") },
    { id: "quotes", label: t("notes.quote") },
    { id: "personal", label: t("notes.tag_personal") },
  ];
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--app-bg)] text-[var(--ink)] select-none"
      data-lovable-target="notes-view"
      data-lovable-name="Sayfa: Notlar"
      data-lovable-file="src/components/NotesView.tsx"
      data-lovable-desc="Notlar listesi ve görsel yükleme alanı"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        onChange={handleComposerPhoto}
        className="hidden"
      />
      <input
        ref={cardFileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        onChange={handleCardPhoto}
        className="hidden"
      />

      {/* 1. Üst Kontrol & Arama Çubuğu */}
      <div className="flex flex-col gap-3 px-8 pt-5 pb-4 border-b-2 border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)]">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("notes.search_ph")}
              className="w-full rounded-[20px] border border-[var(--line-strong)] bg-[var(--app-bg)] py-2 ps-9 pe-7 text-xs text-[var(--ink)] placeholder:text-[var(--ink-soft)] outline-none focus:border-[var(--accent)] shadow-superrButton"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            onClick={() => {
              playPopSound();
              setIsComposerOpen((prev) => !prev);
            }}
            className="btn-pill-orange text-xs"
          >
            {isComposerOpen ? <X size={13} /> : <Plus size={13} />}
            <span>{isComposerOpen ? t("act.cancel") : t("notes.new_short")}</span>
          </button>
        </div>

        {/* 20px Pill Kategori Filtreleri */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            const count = categoryCounts[cat.id] || 0;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  playPopSound();
                  setActiveCategory(cat.id);
                }}
                className={`flex items-center gap-1.5 rounded-[20px] px-3 py-1 text-xs font-gelica font-semibold transition-all ${
                  isActive
                    ? "bg-[var(--ink)] text-[var(--app-bg)] shadow-sm border border-[var(--line)]"
                    : "border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] text-[var(--ink)] hover:border-[var(--ink)]"
                }`}
              >
                <span>{cat.label}</span>
                <span className="font-mono text-[10px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Açılır Not Oluşturucu (12px Card Radius) */}
      <AnimatePresence>
        {isComposerOpen && (
          <motion.form
            initial={{ opacity: 0, maxHeight: 0, overflow: "hidden" }}
            animate={{ opacity: 1, maxHeight: 600, overflow: "hidden" }}
            exit={{ opacity: 0, maxHeight: 0, overflow: "hidden" }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onSubmit={handleCreateNote}
            className="border-b-2 border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--paper)] px-8 py-5"
          >
            <div className="flex flex-col gap-3 max-w-2xl">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t("notes.title_ph")}
                autoFocus
                className="w-full font-gelica text-xl font-semibold text-[var(--ink)] placeholder:text-[var(--ink-soft)] bg-transparent outline-none lowercase"
              />

              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder={t("notes.body_ph")}
                rows={3}
                className="w-full resize-none font-geist text-xs leading-relaxed text-[var(--ink)] placeholder:text-[var(--ink-soft)] bg-transparent outline-none border-b border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] pb-2"
              />

              {/* Yüklenen Fotoğraf */}
              {newImageUrl && (
                <div className="relative mt-1 max-h-40 overflow-hidden rounded-[8px] border border-[var(--line-strong)]">
                  <img src={newImageUrl} alt={t("notes.uploaded")} className="w-full h-36 object-cover" />
                  <button
                    type="button"
                    onClick={() => setNewImageUrl(undefined)}
                    className="absolute top-2 end-2 rounded-[20px] bg-black/70 p-1.5 text-white hover:bg-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}

              {/* Kategori ve Fotoğraf Ekle Butonu */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(Object.keys(CATEGORY_MAP) as NoteCategory[]).map((cKey) => {
                    const cat = CATEGORY_MAP[cKey];
                    const isSelected = newCategory === cKey;
                    return (
                      <button
                        type="button"
                        key={cKey}
                        onClick={() => setNewCategory(cKey)}
                        className={`rounded-[20px] border px-2.5 py-1 text-[11px] font-gelica transition-all ${
                          isSelected
                            ? "bg-[var(--accent)] text-white border-[var(--ink)] font-semibold"
                            : "border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] text-[var(--ink)] hover:border-[var(--ink)]"
                        }`}
                      >
                        {t(cat.nameKey || cat.name)}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-pill-superr text-xs !py-1 !px-3"
                >
                  <ImageIcon size={13} />
                  <span>{newImageUrl ? t("notes.photo_change") : t("notes.photo_add")}</span>
                </button>
              </div>

              {/* Kaydet & Etiketler */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder={t("notes.tags_ph")}
                  className="flex-1 font-geist text-xs text-[var(--ink)] placeholder:text-[var(--ink-soft)] bg-transparent outline-none"
                />

                <button type="submit" className="btn-pill-orange text-xs">
                  <Check size={13} strokeWidth={2.5} />
                  <span>{t("act.save")}</span>
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* 3. Notlar Listesi */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4 scrollbar-thin">
        <AnimatePresence mode="popLayout">
          {filteredNotes.length > 0 ? (
            filteredNotes.map((note) => (
              <div
                key={note.id}
                style={getCardRotationStyle(note.id)}
                className="card-superr p-6"
              >
                <div className="flex items-center justify-between pb-3 border-b-2 border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)]">
                  <span className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] px-2.5 py-0.5 font-gelica text-[11px] font-semibold text-[var(--ink)]">
                    {CATEGORY_MAP[note.category] ? t(CATEGORY_MAP[note.category].nameKey) : note.category}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {onSendToJournal && (
                      <button
                        data-note-to-journal="1"
                        onClick={() => {
                          playPopSound();
                          onSendToJournal(note.title, note.content);
                        }}
                        title={t("notes.to_journal")}
                        className="rounded-[20] p-1.5 text-[var(--ink-soft)] hover:text-[var(--accent)] hover:bg-black/5"
                      >
                        <DNote size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingCardId(note.id);
                        cardFileInputRef.current?.click();
                      }}
                      title={t("notes.photo_toggle")}
                      className="rounded-[20px] p-1.5 text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-black/5"
                    >
                      <ImageIcon size={14} />
                    </button>
                    <button
                      onClick={() => {
                        playPinSound();
                        togglePin(note.id);
                      }}
                      className={`rounded-[20px] p-1.5 transition-colors ${
                        note.isPinned ? "text-[var(--accent)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                      }`}
                    >
                      <Pin size={14} className={note.isPinned ? "rotate-45 fill-current" : ""} />
                    </button>
                    <button
                      onClick={() => {
                        const deleted = deleteNote(note.id);
                        if (deleted) {
                          playPopSound();
                          setUndoToast({
                            id: Date.now(),
                            message: "Silindi · Geri al",
                            onUndo: () => restoreNote(deleted),
                          });
                        }
                      }}
                      title={t("notes.delete")}
                      className="rounded-[20px] p-1.5 text-[var(--ink-soft)] hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <h4 className="font-gelica text-[22px] font-semibold lowercase text-[var(--ink)] mt-3 leading-tight">
                  {note.title}
                </h4>

                {note.imageUrl && (
                  <div className="relative mt-3 overflow-hidden rounded-[8px] border border-[var(--line)] max-h-48 group/img">
                    <img src={note.imageUrl} alt={note.title} className="w-full h-44 object-cover" />
                    <button
                      onClick={() => updateNote(note.id, { imageUrl: undefined })}
                      className="absolute top-2 end-2 rounded-[20px] bg-black/70 p-1.5 text-white opacity-0 group-hover/img:opacity-100 hover:bg-red-600 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}

                <p className="mt-2 font-geist text-xs text-[var(--ink-soft)] leading-relaxed whitespace-pre-line">
                  {note.content}
                </p>

                <div className="mt-4 flex items-center justify-between pt-3 border-t-2 border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] text-xs text-[var(--ink-soft)]">
                  <div className="flex gap-1.5 font-geist">
                    {note.tags.map((t) => (
                      <span key={t}>#{t.replace('#','')}</span>
                    ))}
                  </div>
                  <span className="font-handwritten text-sm text-[var(--ink-soft)] font-bold">{formatNoteDate(note.createdAt, lang)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-12 text-[var(--ink-soft)]">
              {searchQuery.trim() ? (
                <SketchEmptySearch size={110} />
              ) : (
                <SketchEmptyNotes size={110} />
              )}
              <p className="font-gelica text-xl font-semibold text-[var(--ink)] mt-4">
                {searchQuery.trim() ? t("notes.empty_search") : t("notes.empty")}
              </p>
              <p className="font-handwritten text-sm text-[var(--accent)] mt-1 font-bold">
                {searchQuery.trim()
                  ? t("notes.empty_hint_search")
                  : t("notes.empty_hint")}
              </p>
            </div>
          )}
        </AnimatePresence>
      </div>

      <UndoToast toast={undoToast} onDone={() => setUndoToast(null)} />
    </div>
  );
}
