import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n/I18nProvider";
import { AnimatePresence, motion } from "framer-motion";
import { DNote, spaceTopicIcon, DX as X } from "./icons/doodle";
import { LANGUAGES } from "../lib/languages";

interface QuickAddProps {
  isOpen: boolean;
  onClose: () => void;
  /** Aynı kelimenin farklı/aynı dilde tekrar eklenmesini engellemek için mevcut kartlar. */
  existingCards?: { id: string; lang: string; word: string }[];
  /** Mevcut bir kopya bulunduğunda kullanıcıya bildirilir. */
  onDuplicate?: (info: { word: string; existingLang: string; newLang: string }) => void;
  /** Aktif çalışma masasının hedef dil etiketi ("DE" | "EN" | "ES" | "Memo"). */
  defaultLang?: string;
  onAdd: (card: {
    lang: string;
    article?: string;
    word: string;
    translation: string;
    note?: string;
    tags?: string[];
  }) => void;
}

/** Alt + N ile açılan hızlı kelime ekleme modalı. */
export function QuickAdd({ isOpen, onClose, onAdd, existingCards, onDuplicate, defaultLang = "DE" }: QuickAddProps) {
  const { t } = useT();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [lang, setLang] = useState<string>(defaultLang);
  const [article, setArticle] = useState<"" | "der" | "die" | "das">("");
  // v-fix: Kelime turu. Artikel YALNIZCA "isim" turunde gosterilir/kaydedilir.
  const [wordType, setWordType] = useState<"noun" | "verb" | "adjective" | "adverb" | "phrase" | "other">("noun");
  const [word, setWord] = useState("");
  const [translation, setTranslation] = useState("");
  const [note, setNote] = useState("");
  const [dupMsg, setDupMsg] = useState("");
  // Kelimeyi yazarken otomatik dil önerisi (Türkçe karakter/kelime sezgisi)
  const [suggestedLang, setSuggestedLang] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Modal her açıldığında formu ve dil seçimini sıfırla: önceki oturumdan kalan
  // "DE" seçimi yüzünden İngilizce kelimelerin Almanca kaydedilmesini engeller.
  useEffect(() => {
    if (!isOpen) return;
    dialogRef.current?.focus();
    setLang(defaultLang);
    setArticle("");
    setWord("");
    setTranslation("");
    setNote("");
    setDupMsg("");
    setSuggestedLang(null);
    setWordType("noun");
  }, [isOpen, defaultLang]);

  // v-fix (madde 2): kelime turu -> kart etiketi
  const POS_TAG_FOR_TYPE: Record<string, string> = {
    noun: "#Noun",
    verb: "#Verb",
    adjective: "#Adjective",
    adverb: "#Adverb",
    phrase: "#Phrase",
    other: "#Phrase",
  };

  const canSave = word.trim() && translation.trim();

  // Basit dil sezgisi: Almanca icin ipuclari (artikel, -ung/-keit) ve cumle kaliplari.
  // İngilizce'ye özgü ipuçları (-tion, -ing, th, wh). Kullanıcı seçimini ezmez, öneri sunar.
  // Dil sezgisi: AKTİF masanın dilini temel alır; yalnızca o dile özgü ipuçlarıyla öneri
  // üretir. Yeni diller (ES/FR/PT/AR) eklendiğinde de doğru çalışır çünkü öneri masanın
  // hedef dilini asla değiştirmez.
  const detectLang = (raw: string): string => {
    const w = raw.trim().toLowerCase();
    if (defaultLang === "DE") {
      if (/(ung|keit|heit|schaft|chen|lich)$/.test(w) || /[äöüß]/.test(w) || /^(der|die|das)\s/.test(w)) return "DE";
      if (/(tion|sion|ing|ness|ment|ity|ous|ive)$/.test(w) || /^(th|wh|kn|wr)/.test(w)) return "EN";
      return "DE";
    }
    if (defaultLang === "EN") {
      if (/[äöüß]/.test(w) || /^(der|die|das)\s/.test(w)) return "DE";
      return "EN";
    }
    return defaultLang;
  };

  const handleSave = () => {
    if (!canSave) return;
    const cleanWord = word.trim();
    const cleanTranslation = translation.trim();

    // Kopya koruması: aynı kelime (büyük/küçük harf duyarsız) zaten varsa engelle.
    const norm = (s: string) => s.trim().toLowerCase();
    const existing = (existingCards || []).find((c) => norm(c.word) === norm(cleanWord));
    if (existing) {
      setDupMsg(
        existing.lang === lang
          ? t("quick.dup_same").replace("{word}", cleanWord).replace("{lang}", lang)
          : t("quick.dup_other").replace("{word}", cleanWord).replace("{lang}", existing.lang),
      );
      onDuplicate?.({ word: cleanWord, existingLang: existing.lang, newLang: lang });
      return;
    }

    const detected = detectLang(cleanWord);
    const finalLang: string = detected;

    // v-fix (madde 2): Artikel YALNIZCA "isim" turunde kaydedilir.
    const isNoun = wordType === "noun";
    onAdd({
      lang: finalLang,
      article: isNoun && ["DE", "IT", "ES", "FR"].includes(finalLang) && article ? article : undefined,
      word: cleanWord,
      translation: cleanTranslation,
      note: note.trim() || undefined,
      // Tur etiketi: isim/ fiil / sifat ... (kart uzerinde gosterilir)
      tags: [`#${finalLang}`, POS_TAG_FOR_TYPE[wordType]],
    });
    setWord("");
    setTranslation("");
    setNote("");
    setArticle("");
    setWordType("noun");
    setDupMsg("");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[900] flex items-center justify-center bg-black/30 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className="w-full max-w-md bg-[var(--paper)] border border-[var(--line-strong)] rounded-[16px] shadow-superrCard p-6"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)]">
              <h3 className="font-gelica text-xl font-semibold lowercase text-[var(--ink)]">
                {t("quick.new_word")}
              </h3>
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-[var(--ink-soft)]"
                aria-label={t("common.close")}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {LANGUAGES.map((language) => {
                  const tag = language.langTag;
                  return (
                    <button
                      key={tag}
                      onClick={() => setLang(tag)}
                      title={t(language.deskNameKey || language.deskName)}
                      className={`rounded-[20px] border px-3 py-1 text-xs font-geist font-semibold transition-all flex items-center gap-1.5 ${
                        lang === tag
                          ? "border-[var(--accent)] text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                          : "border-[var(--line-strong)] text-[var(--ink-soft)]"
                      }`}
                    >
                      {(() => {
                        const LangIcon = spaceTopicIcon(tag);
                        return <LangIcon size={13} />;
                      })()}
                      <span>{t(language.nameKey || language.name)} ({tag})</span>
                    </button>
                  );
                })}
                <button
                  onClick={() => setLang("Memo")}
                  className={`rounded-[20px] border px-3 py-1 text-xs font-geist font-semibold transition-all flex items-center gap-1.5 ${
                    lang === "Memo"
                      ? "border-[var(--accent)] text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                      : "border-[var(--line-strong)] text-[var(--ink-soft)]"
                  }`}
                >
                  <DNote size={13} />
                  <span>Memo</span>
                </button>
                {/* v-fix (madde 2): Kelime turu secimi */}
                <select
                  value={wordType}
                  onChange={(e) => {
                    const next = e.target.value as typeof wordType;
                    setWordType(next);
                    // Isim degilse artikel secimini SIFIRLA (artikel alani bos kalir).
                    if (next !== "noun") setArticle("");
                  }}
                  className="ms-auto rounded-[20px] border border-[var(--line)] bg-[var(--app-bg)] px-2.5 py-1 text-xs font-geist text-[var(--ink)] outline-none"
                >
                  <option value="noun">{t("pos.noun")}</option>
                  <option value="verb">{t("pos.verb")}</option>
                  <option value="adjective">{t("pos.adj")}</option>
                  <option value="adverb">{t("pos.adv")}</option>
                  <option value="phrase">{t("pos.phrase")}</option>
                  <option value="other">{t("pos.other")}</option>
                </select>
                {/* Artikel yalnızca isim türünde; dilin kendi seçenekleri. */}
                {wordType === "noun" && ["DE", "IT", "ES", "FR"].includes(lang) && (
                  <select value={article} onChange={(e) => setArticle(e.target.value as any)} className="rounded-[20px] border-[var(--line-strong)] bg-[var(--app-bg)] px-2.5 py-1 text-xs font-geist text-[var(--ink)] outline-none">
                    <option value="">{t("field.artikel")}</option>
                    {(lang === "DE" ? ["der", "die", "das"] : lang === "IT" ? ["il", "lo", "la"] : lang === "ES" ? ["el", "la"] : ["le", "la"]).map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                )}
              </div>

              <input
                autoFocus
                value={word}
                onChange={(e) => {
                  setWord(e.target.value);
                  if (dupMsg) setDupMsg("");
                }}
                placeholder={t("cards.word")}
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--app-bg)] px-3 py-2 font-gelica text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              />
              <input
                value={translation}
                onChange={(e) => setTranslation(e.target.value)}
                placeholder={t("cards.meaning")}
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--app-bg)] px-3 py-2 font-gelica text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("notes.body_ph")}
                className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--app-bg)] px-3 py-2 font-geist text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            {dupMsg && (
              <p className="mt-3 rounded-[10px] border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-3 py-2 font-geist text-[11px] leading-relaxed text-[var(--ink)]">
                {dupMsg}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} className="btn-pill-superr text-xs">
                <span>{t("act.cancel")}</span>
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="btn-pill-orange text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>{t("quick.add_btn")}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
