import { GRAMMAR_FIELD_KEY } from "../lib/grammarFields";
import { useEffect, useState } from "react";
import { useT } from "../i18n/I18nProvider";
import { motion } from "framer-motion";
import { DLayers as Layers, DNote as StickyNote, DSearch as Search, DVolume as Volume2 } from "./icons/doodle";
import { useDeck } from "../lib/deck";
import { useNotes } from "../lib/notes";
import { formatNoteDate } from "../lib/alarm";
import { playPopSound } from "../lib/sound";
import { speak } from "../lib/articles";
import { getCardRotationStyle } from "../lib/paperStyles";
import {
  SketchEmptyCards,
  SketchEmptyNotes,
  SketchEmptySearch,
} from "./icons/EmptyStateIllustrations";

export function CollectionsView() {
  const { t, lang } = useT();
  const { cards, updateCard, deleteCard, restoreCard } = useDeck();
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editWord, setEditWord] = useState("");
  const [editTranslation, setEditTranslation] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletedCard, setDeletedCard] = useState<{ card: typeof cards[number]; index: number } | null>(null);
  const beginEdit = (card: typeof cards[number]) => { setEditingCardId(card.id); setEditWord(card.word); setEditTranslation(card.translation); };
  const removeCard = (card: typeof cards[number]) => { setConfirmDeleteId(null); const index = cards.findIndex((x) => x.id === card.id); deleteCard(card.id); setDeletedCard({ card, index }); window.setTimeout(() => setDeletedCard(null), 5000); };
  const undoDelete = () => { if (deletedCard) restoreCard(deletedCard.card, deletedCard.index); setDeletedCard(null); };
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setEditingCardId(null); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, []);
  const { notes } = useNotes();
  const [tab, setTab] = useState<"cards" | "notes">("cards");
  const [search, setSearch] = useState("");

  const filteredCards = cards.filter((c) =>
    c.word.toLowerCase().includes(search.toLowerCase()) ||
    c.translation.toLowerCase().includes(search.toLowerCase()) ||
    c.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredNotes = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase()) ||
    n.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto px-4 sm:px-10 py-4 sm:py-10 bg-[var(--app-bg)] text-[var(--ink)] select-none scrollbar-thin">
      {/* 1. Üst Başlık & Superr 20px Pill Sekmeler */}
      <div className="flex flex-col gap-5 border-b-2 border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="font-handwritten text-[var(--accent)] text-base block">
              {t("col.title")}
            </span>
            <h2 className="font-gelica text-[36px] sm:text-[42px] font-semibold lowercase text-[var(--ink)] leading-tight">
              {t("col.sub")}
            </h2>
          </div>

          {/* 20px Pill Buton Sekmeleri */}
          <div className="flex w-full items-center gap-2 lg:w-auto">
            <button
              onClick={() => {
                playPopSound();
                setTab("cards");
              }}
              className={`btn-pill-superr flex-1 justify-center whitespace-nowrap text-[11px] lg:flex-none lg:text-xs ${tab === "cards" ? "!bg-[var(--ink)] !text-[var(--app-bg)] !border-[var(--line-strong)]" : "opacity-70"}`}
            >
              <Layers size={13} />
              <span>{t("col.cards_tab", { n: cards.length })}</span>
            </button>

            <button
              onClick={() => {
                playPopSound();
                setTab("notes");
              }}
              className={`btn-pill-superr flex-1 justify-center whitespace-nowrap text-[11px] lg:flex-none lg:text-xs ${tab === "notes" ? "!bg-[var(--ink)] !text-[var(--app-bg)] !border-[var(--line-strong)]" : "opacity-70"}`}
            >
              <StickyNote size={13} />
              <span>{t("col.notes_tab")} ({notes.length})</span>
            </button>
          </div>
        </div>

        {/* 20px Pill Arama Kutusu */}
        <div className="relative flex items-center max-w-md">
          <Search size={14} className="absolute start-3.5 text-[var(--ink-soft)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("col.search_ph")}
            className="w-full rounded-[20px] border border-[var(--line-strong)] bg-[var(--app-bg)] py-2 ps-9 pe-12 font-geist text-xs text-[var(--ink)] placeholder:text-[var(--ink-soft)] outline-none focus:border-[var(--accent)] shadow-superrButton"
          />
        </div>
      </div>

      {/* 2. Kart Izgarası: 12px Card Radius, 1.5px Charcoal Border */}
      {/* v-mobile: aktif sekmenin bolum basligi (kelime kartlari / notlarim) */}
      <div className="mt-5 mb-1 flex items-center gap-2">
        <span className="font-handwritten text-[13px] text-[var(--accent)]">
          {"── "}{tab === "cards" ? t("col.cards_tab", { n: cards.length }) : t("col.notes_tab") + " (" + notes.length + ")"}{" ──"}
        </span>
        <span className="h-[1px] flex-1 bg-[color-mix(in_srgb,var(--border-ink)_25%,transparent)]" />
      </div>

      <motion.div
        key={tab}
        initial={{ opacity: 0, x: 10, skewY: -0.8 }}
        animate={{ opacity: 1, x: 0, skewY: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-5"
      >
        {tab === "cards" ? (
          filteredCards.length > 0 ? (
          filteredCards.map((card) => (
            <div
              key={card.id}
              style={getCardRotationStyle(card.id)}
              className="card-superr p-6"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)]">
                <span className="rounded-[20px] border border-[var(--line)] bg-[var(--paper)] px-2.5 py-0.5 font-geist text-[11px] font-semibold text-[var(--ink)]">
                  {card.article
                    ? `${card.article} · ${t("lang.de.short")}`
                    : card.lang === "DE"
                    ? t("lang.de.short")
                    : card.lang === "EN"
                    ? t("lang.en.short")
                    : card.lang}
                </span>

                <button
                  onClick={() => {
                    playPopSound();
                    speak(card.word, card.lang);
                  }}
                  className="rounded-[20px] border border-[var(--line)] p-1.5 text-[var(--ink)] hover:bg-[var(--paper)] transition-colors"
                >
                  <Volume2 size={13} />
                </button>
              </div>

              {card.imageUrl && (
                <div className="mt-3.5 overflow-hidden rounded-[8px] border border-[var(--line)] max-h-40">
                  <img src={card.imageUrl} alt={card.word} className="w-full h-36 object-cover" />
                </div>
              )}

              <div className="pt-3">
                <span className="font-handwritten text-[var(--accent)] text-xs block mb-0.5">{t("cards.word")}</span>
                <h4 className="font-gelica text-[26px] font-semibold text-[var(--ink)] leading-tight">
                  {card.article && <span className="text-[var(--accent)] me-2">{card.article}</span>}
                  <span>{card.lang === "DE" && card.article ? (() => { const word = card.word.replace(/^(der|die|das)\s+/i, ""); return word ? word.charAt(0).toUpperCase() + word.slice(1) : word; })() : card.word}</span>
                </h4>
                <p className="mt-1 font-gelica text-[17px] text-[var(--ink-soft)]">
                  {card.translation}
                </p>
              </div>

              {card.grammar && card.grammar.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5 pt-3 border-t border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] font-geist text-[11px] text-[var(--ink-soft)]">
                  {card.grammar.map((g, i) => (
                    <span key={i} className="rounded-[6px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--paper)] px-2 py-0.5">
                      {t(GRAMMAR_FIELD_KEY[g.label] || g.label)}: {g.value}
                    </span>
                  ))}
                </div>
              )}              <div className="mt-4 flex items-center justify-end gap-2 border-t border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] pt-3">
                {editingCardId === card.id ? <>
                  <input value={editWord} onChange={(e) => setEditWord(e.target.value)} className="min-w-0 flex-1 rounded border px-2 py-1 text-xs" />
                  <input value={editTranslation} onChange={(e) => setEditTranslation(e.target.value)} className="min-w-0 flex-1 rounded border px-2 py-1 text-xs" />
                  <button type="button" onClick={() => { updateCard(card.id, { word: editWord || card.word, translation: editTranslation || card.translation }); setEditingCardId(null); }}>{t("act.save")}</button>
                  <button type="button" onClick={() => setEditingCardId(null)}>{t("act.cancel")}</button>
                </> : <>
                  <button type="button" className="min-h-8 min-w-8" onClick={() => beginEdit(card)}>{t("act.edit")}</button>
                  <button type="button" className="min-h-8 min-w-8" onClick={() => setConfirmDeleteId(card.id)}>{t("act.delete")}</button>
                </>}
              </div>

            </div>
          ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center text-center py-12 text-[var(--ink-soft)]">
              {search.trim() ? (
                <SketchEmptySearch size={110} />
              ) : (
                <SketchEmptyCards size={110} />
              )}
              <p className="font-gelica text-xl font-semibold text-[var(--ink)] mt-4">
                {search.trim() ? t("col.no_cards_search") : t("col.no_cards")}
              </p>
              <p className="font-handwritten text-sm text-[var(--accent)] mt-1 font-bold">
                {search.trim()
                  ? t("col.cards_hint_search")
                  : t("col.cards_hint")}
              </p>
            </div>
          )
        ) : filteredNotes.length > 0 ? (
          filteredNotes.map((note) => (
            <div
              key={note.id}
              style={getCardRotationStyle(note.id)}
              className="card-superr p-6"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] text-xs">
                <span className="rounded-[20px] border border-[var(--line)] bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2.5 py-0.5 font-geist text-[11px] font-semibold text-[var(--accent)]">
                  {note.category}
                </span>
                <span className="font-handwritten text-sm text-[var(--ink-soft)] font-bold">
                  {formatNoteDate(note.createdAt, lang)}
                </span>
              </div>

              {note.imageUrl && (
                <div className="mt-3.5 overflow-hidden rounded-[8px] border border-[var(--line)] max-h-40">
                  <img src={note.imageUrl} alt={note.title} className="w-full h-36 object-cover" />
                </div>
              )}

              <h4 className="font-gelica text-[22px] font-semibold lowercase text-[var(--ink)] mt-3 leading-tight">
                {note.title}
              </h4>

              <p className="mt-1.5 font-geist text-xs text-[var(--ink-soft)] line-clamp-3 leading-relaxed">
                {note.content}
              </p>

              <div className="mt-4 flex items-center justify-between pt-3 border-t border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] text-xs text-[var(--ink-soft)]">
                <div className="flex gap-1.5 font-geist">
                  {note.tags.map((t) => (
                    <span key={t}>#{t.replace('#','')}</span>
                  ))}
                </div>
                {note.reminderAt && (
                  <span className="font-gelica text-[var(--accent)] font-semibold">⏰ alarm aktif</span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center text-center py-12 text-[var(--ink-soft)]">
            {search.trim() ? (
              <SketchEmptySearch size={110} />
            ) : (
              <SketchEmptyNotes size={110} />
            )}
            <p className="font-gelica text-xl font-semibold text-[var(--ink)] mt-4">
              {search.trim() ? t("col.no_notes_search") : t("col.no_notes")}
            </p>
            <p className="font-handwritten text-sm text-[var(--accent)] mt-1 font-bold">
              {search.trim()
                ? t("col.notes_hint_search")
                : t("col.notes_hint")}
            </p>
          </div>
        )}
      </motion.div>
      {confirmDeleteId && <div role="dialog" aria-modal="true" aria-labelledby="archive-delete-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="rounded-xl bg-[var(--paper)] p-5 shadow-superrCard"><h2 id="archive-delete-title" className="font-gelica text-lg">silinsin mi?</h2><div className="mt-4 flex gap-2"><button type="button" onClick={() => setConfirmDeleteId(null)}>{t("act.cancel")}</button><button type="button" onClick={() => { const card=cards.find((c) => c.id === confirmDeleteId); if(card) removeCard(card); }}>{t("act.delete")}</button></div></div></div>}
      {deletedCard && <div role="status" aria-live="polite" className="fixed bottom-5 end-5 z-50 rounded-xl border bg-[var(--paper)] px-4 py-2 shadow-superrCard">Silindi · <button type="button" onClick={undoDelete} className="underline">Geri al</button></div>}
    </div>
  );
}
