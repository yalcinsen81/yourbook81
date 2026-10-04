import { GRAMMAR_FIELD_KEY } from "../lib/grammarFields";
import { useState, useRef, useEffect } from "react";
import { useT } from "../i18n/I18nProvider";
import { AnimatePresence, motion, useMotionValue, useSpring, type PanInfo } from "framer-motion";
import { DBook as BookOpen, DCheck as Check, DChevronDown as ChevronDown, DEye as Eye, DEyeOff as EyeOff, DImage as ImageIcon, DEdit as Pencil, DRefresh as RotateCcw, DTrash as Trash2, DVolume as Volume2 } from "./icons/doodle";
import type { WordCard } from "../lib/types";
import { SRS_INTERVALS_DAYS } from "../lib/deck";
import { speak, canSpeak, stopSpeaking } from "../lib/articles";
import { playPopSound, playRevealSound, playSuccessSound, playStampThud } from "../lib/sound";
import { processAndCompressImage } from "../lib/imageHelper";
import { Tooltip } from "./Tooltip";
import { Confetti } from "./Confetti";
import { XP_FOR_LEARN } from "./EngagementSystem";
import { LANGUAGES } from "../lib/languages";
import { articleStyle } from "../lib/articleStyle";

const SPRING = {
  type: "spring",
  stiffness: 450,
  damping: 32,
} as const;

interface StickyCardProps {
  card: WordCard;
  onLearn: (id: string) => void;
  onForgot?: (id: string) => void;
  onUpdateImage?: (cardId: string, imageUrl: string | undefined) => void;
  /** MADDE 7: kelimeyi duzenle (kelime + anlam + not). */
  onEdit?: (cardId: string, patch: { word: string; translation: string; note?: string; article?: string }) => void;
  /** MADDE 7: karti sil. */
  onDelete?: (cardId: string) => void;
  className?: string;
}

export function StickyCard({ card, onLearn, onForgot, onUpdateImage, onEdit, onDelete, className = "" }: StickyCardProps) {
  const { t } = useT();
  const cardLanguage = LANGUAGES.find((item) => item.langTag === card.lang);
  const cardLanguageName = cardLanguage ? t(cardLanguage.nameKey || cardLanguage.name) : card.lang;

  // Kart etiketleri: sozcuk turu (#Noun) arayuz diline cevrilir;
  // #DE / #B1 gibi kodlar ve kullanici etiketleri OLDUGU GIBI kalir.
  const POS_TAG_KEY: Record<string, string> = {
    "#Noun": "pos.noun", "#Verb": "pos.verb", "#Adjective": "pos.adj", "#Adverb": "pos.adv",
    "#Phrase": "pos.phrase", "#Idiom": "pos.idiom", "#Preposition": "pos.prep",
    // Eski (v53 oncesi) Turkce etiketler -> migration icin:
    "#İsim": "pos.noun", "#Fiil": "pos.verb", "#Sıfat": "pos.adj", "#Zarf": "pos.adv",
    "#İfade": "pos.phrase", "#Deyim": "pos.idiom", "#Edat": "pos.prep",
  };
  // Gramer notu: standart terimler arayuz diline cevrilir; serbest metin dokunulmaz.
  const NOTE_KEY: Record<string, string> = {
    "Abstract noun": "gram.abstract_noun",
    "Abstract noun / feminine": "gram.abstract_noun_f",
    "Abstract noun / masculine": "gram.abstract_noun_m",
    "Abstract noun / neuter": "gram.abstract_noun_n",
    // Eski TURKCE girdiler (migration atlansa bile dogru cevrilir):
      "Soyut isim": "gram.abstract_noun",
      "Soyut isim / Feminin": "gram.abstract_noun_f",
      "Soyut isim / Eril": "gram.abstract_noun_m",
      "Soyut isim / Maskulin": "gram.abstract_noun_m",
      "Soyut isim / Nötr": "gram.abstract_noun_n",
  };
  const noteLabel = (note: string) => {
    const trimmed = note.trim();
    // 1) Tam eslesme (orn. 'Soyut isim / Feminin')
    const exact = NOTE_KEY[trimmed];
    if (exact) return t(exact);
    // 2) 'Etiket: deger' bicimi (orn. 'Çoğul: die Geheimnisse') -> SADECE etiketi cevir
    const ix = trimmed.indexOf(': ');
    if (ix > 0) {
      const head = trimmed.slice(0, ix);
      const value = trimmed.slice(ix + 2);
      const key = NOTE_KEY[head] || GRAMMAR_FIELD_KEY[head];
      if (key) return t(key) + ': ' + value;
    }
    return note;
  };

  const tagLabel = (tag: string) => {
    const key = POS_TAG_KEY[tag.trim()];
    return key ? t(key) : tag;
  };

  const [exitDirection, setExitDirection] = useState<"right" | "left">("right");
  // MADDE 5: "hatırlayamadım" basildiginda aralik metni "yarin masaya doner" olur.
  const [forgotPressed, setForgotPressed] = useState(false);
  // MADDE 7: duzenleme modali + silme onayi
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editWord, setEditWord] = useState(card.word);
  const [editTrans, setEditTrans] = useState(card.translation);
  const [editNote, setEditNote] = useState(card.note || "");
  const [editPos, setEditPos] = useState((card.tags || []).includes("#Noun") || card.article ? "noun" : "");
  const [editArticle, setEditArticle] = useState(card.article || "");
  const [speaking, setSpeaking] = useState(false);
  const [speakMenuOpen, setSpeakMenuOpen] = useState(false);

  // Kart ekrandan kalkinca devam eden okumayi durdur.
  useEffect(() => () => stopSpeaking(), []);
  // Bekleyen ogrenme timer'ini unmount'ta iptal et (race condition onlemi).
  useEffect(() => () => {
    if (learnTimerRef.current !== null) {
      window.clearTimeout(learnTimerRef.current);
      learnTimerRef.current = null;
    }
  }, []);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isRevealedManual, setIsRevealedManual] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isLearnedAnimating, setIsLearnedAnimating] = useState(false);
  const [showStampBadge, setShowStampBadge] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  // Cift tetiklenme ve sizinti (leak) korumasi
  const learnFiredRef = useRef(false);
  const learnCardIdRef = useRef<string | null>(null);
  // Kart degistiginde kilidi ac (yeni kart tekrar ogrenilebilsin).
  if (learnCardIdRef.current !== card.id) {
    learnCardIdRef.current = card.id;
    learnFiredRef.current = false;
    // v-fix: YENI kart geldiginde animasyon state'ini de SIFIRLA.
    // (key prop'u unutulsa bile akis kirilmaz - guvenlik agi.)
    setIsLearnedAnimating(false);
    setShowStampBadge(false);
    // MADDE 7: yeni kart geldiginde duzenleme alanlari o kartla esitlenir.
    setEditOpen(false);
    setConfirmDelete(false);
    setEditWord(card.word);
    setEditTrans(card.translation);
    setEditNote(card.note || "");
  }
  const learnTimerRef = useRef<number | null>(null);

  const isReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ⭐ EMIL KOWALSKI: Sürükleme İvmesi (Drag-to-Tilt)
  const rawDragTilt = useMotionValue(0);
  const dragTilt = useSpring(rawDragTilt, SPRING);

  // ⭐ EMIL KOWALSKI: 3D Fare Takip Eğimi (Interactive Spring Parallax Tilt)
  const rotateX = useSpring(0, { stiffness: 350, damping: 28 });
  const rotateY = useSpring(0, { stiffness: 350, damping: 28 });
  const [spotlight, setSpotlight] = useState({ x: 200, y: 150, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const normalizedX = (x / rect.width) - 0.5;
    const normalizedY = (y / rect.height) - 0.5;

    rotateX.set(-normalizedY * 6);
    rotateY.set(normalizedX * 6);
    setSpotlight({ x, y, opacity: 1 });
  };

  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
    setSpotlight((prev) => ({ ...prev, opacity: 0 }));
  };

  const handleDrag = (_: unknown, info: PanInfo) => {
    const clampedVelocity = Math.max(-320, Math.min(320, info.velocity.x));
    rawDragTilt.set((clampedVelocity / 320) * 4.5);
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => { rawDragTilt.set(0); if (isReducedMotion) return; if (info.offset.x > 100) handleLearnClick(); else if (info.offset.x < -100) { setForgotPressed(true); onForgot?.(card.id); } };

  const toggleRecall = () => {
    const next = !isRevealedManual;
    setIsRevealedManual(next);
    if (next) playRevealSound();
    else playPopSound();
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await processAndCompressImage(file, 800, 0.82);
      setImgFailed(false);
      onUpdateImage?.(card.id, base64);
      playSuccessSound();
    } catch (err) {
      console.error(err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    playPopSound();
    onUpdateImage?.(card.id, undefined);
  };

  const handleLearnClick = () => {
    // Ayni kart icin ikinci kez tetiklenmesin (cift XP / cift toast korumasi).
    if (learnFiredRef.current) return;
    learnFiredRef.current = true;
    setIsLearnedAnimating(true);
    // v-fix: cift kutlama olmasin diye damga badge KAPALI (XpToast tek kutlama kaynagi)
    playStampThud();
    playSuccessSound();
    setShowConfetti(true);
    // Timer'i ref'te tut: kart unmount olursa cleanup'ta iptal edilir.
    learnTimerRef.current = window.setTimeout(() => {
      learnTimerRef.current = null;
      onLearn(card.id);
    }, 850);
  };

  const hasGrammar = Boolean(card.grammar && card.grammar.length > 0);
  const isTranslationRevealed = isHovered || isRevealedManual;
  return (
    <motion.article
      data-lovable-target="sticky-card"
      data-lovable-name="Bileşen: Yapışkan Not Kartı"
      data-lovable-file="src/components/StickyCard.tsx"
      data-lovable-desc="Ana ekrandaki yapışkan not / sticker kartı"
      ref={cardRef}
      drag
      dragConstraints={{ left: -50, right: 50, top: -30, bottom: 30 }}
      dragElastic={0.12}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotate: dragTilt,
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        perspective: 1000,
        transformOrigin: "50% 85%",
      }}
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={isLearnedAnimating ? { scale: [1, 1.035, 1], y: 0 } : { opacity: 1, y: 0, scale: 1 }}
      exit={{
        opacity: 0,
        // Öğrendim: sağa savrulup dönerek çıkar (kart kenara atılır)
        // Hatırlayamadım: sola savrulup destenin altına geri döner
        transform:
          exitDirection === "right"
            ? "translateX(260px) translateY(-24px) rotate(14deg) scale(0.88)"
            : "translateX(-260px) translateY(32px) rotate(-14deg) scale(0.88)",
        filter: "blur(6px)",
        transition: { duration: 0.32, ease: [0.34, 1.56, 0.64, 1] },
      }}
      transition={SPRING}
      className={`group relative w-full max-w-[430px] cursor-grab active:cursor-grabbing select-none overflow-hidden rounded-[12px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-0 shadow-superrCard transition-all ${className}`}
    >
      {/* Konfeti Parçacık Patlaması */}
      {showConfetti && <Confetti trigger={1} />}

      {/* ⭐ KAĞIDA VURULAN MÜREKKEP DAMGASI BADGE BUMP EFEKTİ (+XP süper!) */}
      <AnimatePresence>
        {showStampBadge && (
          <motion.div
            initial={
              isReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 1.7, rotate: -8 }
            }
            animate={
              isReducedMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: [1.7, 0.95, 1], rotate: [-8, 2, 0] }
            }
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            transition={{ duration: 0.38, ease: [0.2, 0, 0, 1] }}
            className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="flex flex-col items-center justify-center px-7 py-3.5 rounded-[16px] border-[2.6px] border-[var(--accent)] bg-[var(--paper)]/95 shadow-superrCard backdrop-blur-xs text-center rotate-[-2deg]">
              <div className="flex items-center gap-1.5">
                <span className="font-handwritten text-2xl font-bold text-[var(--accent)] tracking-wide">
                  +{XP_FOR_LEARN} XP {t("praise.2")}
                </span>
              </div>
              <span className="font-geist text-[11px] font-semibold text-[var(--ink)] uppercase tracking-wider mt-0.5">
                {t("cards.sealed")}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ⭐ EMIL KOWALSKI DİNAMİK FARE IŞIK TAKİP KATMANI */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300 z-10"
        style={{
          opacity: spotlight.opacity,
          background: `radial-gradient(circle 260px at ${spotlight.x}px ${spotlight.y}px, rgba(255, 111, 30, 0.10), transparent 75%)`,
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        onChange={handlePhotoSelect}
        className="hidden"
      />

      {/* 1. Üst Bar: 20px Pill Rozet & Taktil Butonlar */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b-2 border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)]">
        <div className="flex items-center gap-2">
          <motion.span
            whileHover={{ scale: 1.05 }}
            className="inline-flex items-center gap-1.5 rounded-[20px] border border-[var(--line-strong)] bg-[var(--paper)] px-3 py-1 font-geist text-xs font-semibold text-[var(--ink)]"
          >
            <span>
              {card.article
                ? `${card.article} · ${cardLanguageName}`
                : card.lang === "DE"
                ? t("lang.de.short")
                : card.lang === "EN"
                ? t("lang.en.short")
                : card.lang}
            </span>
          </motion.span>

          {card.tags?.map((tag) => (
            <span key={tag} className="font-geist text-[11px] text-[var(--ink-soft)]">
              {tagLabel(tag)}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 z-20">
          {/* MADDE 7: KART DUZENLE */}
          {onEdit && (
            <Tooltip label={t("card.edit")} side="top">
              <motion.button
                whileHover={{ scale: 1.10 }}
                whileTap={{ scale: 0.90 }}
                transition={SPRING}
                onClick={(e) => {
                  e.stopPropagation();
                  playPopSound();
                  setEditWord(card.word);
                  setEditTrans(card.translation);
                  setEditNote(card.note || "");
                  setEditOpen(true);
                }}
                data-card-edit="1"
                aria-label={t("card.edit")}
                title={t("card.edit")}
                className="flex h-8 w-8 items-center justify-center rounded-[20px] border border-[var(--line-strong)] bg-[var(--app-bg)] text-[var(--ink)] hover:bg-[var(--paper)] transition-colors shadow-superrButton"
              >
                <Pencil size={14} />
              </motion.button>
            </Tooltip>
          )}

          {/* MADDE 7: KART SIL (onay ister) */}
          {onDelete && (
            <Tooltip label={t("card.delete")} side="top">
              <motion.button
                whileHover={{ scale: 1.10 }}
                whileTap={{ scale: 0.90 }}
                transition={SPRING}
                onClick={(e) => {
                  e.stopPropagation();
                  playPopSound();
                  setConfirmDelete(true);
                }}
                data-card-delete="1"
                aria-label={t("card.delete")}
                title={t("card.delete")}
                className="flex h-8 w-8 items-center justify-center rounded-[20px] border border-[var(--line-strong)] bg-[var(--app-bg)] text-[var(--ink)] hover:bg-red-50 hover:text-red-600 transition-colors shadow-superrButton"
              >
                <Trash2 size={14} />
              </motion.button>
            </Tooltip>
          )}

          <Tooltip label={card.imageUrl ? t("notes.photo_change") : t("notes.photo_upload")} side="top">
            <motion.button
              whileHover={{ scale: 1.10 }}
              whileTap={{ scale: 0.90 }}
              transition={SPRING}
              onClick={(e) => {
                e.stopPropagation();
                playPopSound();
                fileInputRef.current?.click();
              }}
            className="flex h-8 w-8 items-center justify-center rounded-[20px] border border-[var(--line-strong)] bg-[var(--app-bg)] text-[var(--ink)] hover:bg-[var(--paper)] transition-colors shadow-superrButton"
            >
              <ImageIcon size={14} />
            </motion.button>
          </Tooltip>

          <div className="relative">
            <Tooltip label={t("card.listen")} side="top">
              <motion.button
                whileHover={{ scale: 1.10, rotate: 6 }}
                animate={speaking ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                transition={speaking ? { duration: 1, repeat: Infinity } : SPRING}
                onClick={(e) => {
                  e.stopPropagation();
                  playPopSound();
                  const textToSpeak = card.article ? `${card.article} ${card.word}` : card.word;
                  speak(textToSpeak, card.lang, {
                    onStart: () => setSpeaking(true),
                    onEnd: () => setSpeaking(false),
                    onError: () => setSpeaking(false),
                  });
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSpeakMenuOpen((v) => !v);
                }}
                data-speak-btn="1"
                data-speaking={speaking ? "1" : "0"}
                className={`flex h-8 w-8 items-center justify-center rounded-[20px] border border-[var(--line-strong)] transition-colors shadow-superrButton ${
                  speaking ? "bg-[var(--accent)] text-white" : "bg-[var(--app-bg)] text-[var(--ink)] hover:bg-[var(--paper)]"
                }`}
              >
                <Volume2 size={14} />
              </motion.button>
            </Tooltip>
            {/* Kesfedilebilirlik: kucuk ok -> telaffuz menusu (normal / yavas) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                playPopSound();
                setSpeakMenuOpen((v) => !v);
              }}
              aria-label={t("card.speak_menu")}
              aria-expanded={speakMenuOpen}
              title={t("card.speak_menu")}
              data-speak-menu-toggle="1"
              className="absolute -end-1.5 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full border-[1.2px] border-[var(--line-strong)] bg-[var(--app-bg)] text-[var(--ink)] shadow-superrButton"
            >
              <ChevronDown size={9} />
            </button>

            <AnimatePresence>
              {speakMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSpeakMenuOpen(false);
                    }}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.96 }}
                    transition={{ duration: 0.14 }}
                    data-speak-menu="1"
                    className="absolute end-0 top-9 z-50 w-[168px] overflow-hidden rounded-[12px] border border-[var(--line-strong)] bg-[var(--app-bg)] shadow-lg"
                  >
                    {[
                      { key: "card.listen_normal", rate: 0.92 },
                      { key: "card.listen_slow_speed", rate: 0.55 },
                    ].map((item) => (
                      <button
                        key={item.key}
                        data-speak-rate={String(item.rate)}
                        onClick={(e) => {
                          e.stopPropagation();
                          playPopSound();
                          setSpeakMenuOpen(false);
                          const textToSpeak = card.article ? `${card.article} ${card.word}` : card.word;
                          speak(textToSpeak, card.lang, {
                            rate: item.rate,
                            onStart: () => setSpeaking(true),
                            onEnd: () => setSpeaking(false),
                            onError: () => setSpeaking(false),
                          });
                        }}
                        className="block w-full px-3 py-2 text-start font-gelica text-[12px] text-[var(--ink)] transition hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]"
                      >
                        {t(item.key)}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 2. Kart Gövdesi: Lowercase Gelica Başlık & Aktif Hatırlama */}
      <div className="px-6 pt-5 pb-6">
        {card.imageUrl && !imgFailed && (
          <div className="relative mb-5 overflow-hidden rounded-[8px] border border-[var(--line-strong)] group/photo max-h-48">
            <img
              src={card.imageUrl}
              alt={card.word}
              onError={() => setImgFailed(true)}
              className="w-full h-44 object-cover filter contrast-[1.02]"
            />
            <button
              onClick={handleRemovePhoto}
              title={t("notes.photo_remove")}
              className="absolute top-2 end-2 rounded-[20px] bg-[var(--ink)] p-1.5 text-white opacity-0 group-hover/photo:opacity-100 transition-opacity hover:bg-red-600"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}

        {/* Başlık */}
        <div className="pt-1">
          <span className="font-handwritten text-sm text-[var(--accent)] block mb-0.5">
            {t("card.word_label")}
          </span>
          <h2 className="font-gelica text-[40px] sm:text-[46px] font-semibold leading-[1.08] text-[var(--ink)] tracking-normal">
            {card.article && <span className={`${articleStyle(card.article)} me-2`}>{card.article}</span>}
            <span dir={card.lang === "AR" ? "rtl" : undefined}>{card.word}</span>
          </h2>
        </div>
        {/* Kağıt kart flip: blur yerine kısa 3D Y dönüşü. */}
        <motion.div onClick={toggleRecall} className="group/recall relative mt-5 cursor-pointer [perspective:1000px]" animate={{ rotateY: isReducedMotion || !isTranslationRevealed ? 0 : 180 }} transition={{ duration: isReducedMotion ? 0 : 0.24, ease: [0.23, 1, 0.32, 1] }} style={{ transformStyle: "preserve-3d" }} aria-label={t("cards.meaning")}>
          <div className="relative min-h-[118px] rounded-[14px] border border-[var(--line-strong)] bg-[var(--paper)] p-4 shadow-superrCard [backface-visibility:hidden] [transform:rotateY(0deg)]"><div className="flex items-center justify-between pb-2 text-xs font-geist text-[var(--ink-soft)]"><span className="font-semibold text-[var(--ink)]">{t("cards.meaning")}</span><EyeOff size={12} /></div><p className="font-mono text-xs text-[var(--ink-soft)]">{t("sticky.hidden")}</p></div>
          <div className="absolute inset-0 min-h-[118px] rounded-[14px] border border-[var(--line-strong)] bg-[var(--paper)] p-4 shadow-superrCard [backface-visibility:hidden] [transform:rotateY(180deg)]"><div className="flex items-center justify-between pb-2 text-xs font-geist text-[var(--ink-soft)]"><span className="font-semibold text-[var(--ink)]">{t("cards.meaning")}</span><Eye size={12} /></div><p className="font-gelica text-[19px] font-medium leading-[1.4] text-[var(--ink)]">{card.translation}</p>{card.note && <p className="mt-2 font-geist text-xs text-[var(--ink-soft)]">• {noteLabel(card.note)}</p>}</div>
        </motion.div>
      </div>

      {/* 3. Gramer Çekmecesi (FLIP Morphing) */}
      {hasGrammar && (
        <motion.div
          layout
          className="border-t-2 border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[color-mix(in_srgb,var(--border-ink)_20%,transparent)]"
        >
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              playPopSound();
              setDrawerOpen((prev) => !prev);
            }}
            className="flex w-full items-center justify-between px-6 py-2.5 text-xs font-geist font-semibold text-[var(--ink)] hover:text-[var(--accent)] transition-colors"
          >
            <span className="flex items-center gap-2">
              <BookOpen size={13} className="text-[var(--accent)]" />
              <span>{t("sticky.grammar").replace("{n}", String(card.grammar?.length || 0))}</span>
            </span>
            <motion.div animate={{ rotate: drawerOpen ? 180 : 0 }} transition={SPRING}>
              <ChevronDown size={14} />
            </motion.div>
          </motion.button>

          <AnimatePresence initial={false}>
            {drawerOpen && (
              <motion.div
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={SPRING}
                className="overflow-hidden px-6 pb-4 pt-1"
              >
                <div className="divide-y divide-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] rounded-[8px] border border-[var(--line)] bg-[var(--app-bg)]">
                  {card.grammar?.map((item, idx) => (
                    <div key={idx} className="flex items-baseline justify-between px-3.5 py-2 text-xs font-geist">
                      <span className="text-[11px] font-semibold text-[var(--ink-soft)]">
                        {t(GRAMMAR_FIELD_KEY[item.label?.replace(/:+$/, "")] || item.label?.replace(/:+$/, ""))}
                      </span>
                      <span className="font-gelica text-sm font-semibold text-[var(--ink)]">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* 4. Alt Eylem Barı: Taktil Çökme & Konfeti Butonu */}
      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 border-t-2 border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] px-4 sm:px-6 py-3.5 bg-[var(--app-bg)] z-20">
        <div className="flex flex-col min-w-0">
          <span className="font-geist text-[10px] sm:text-[11px] text-[var(--ink-soft)]">
            {t("card.srs")}
          </span>
          {/* MADDE 5: metin BASILAN BUTONA gore dogru araligi gosterir.
              "hatırlayamadım" -> aralik sifirlanir (1 gun) -> "yarın masaya döner"
              "öğrendim"       -> bir sonraki (daha uzun) kademe gosterilir. */}
          <span className="font-geist text-[11px] sm:text-xs font-semibold text-[var(--ink)]" data-srs-return="1">
            {forgotPressed
              ? t("card.srs_return_forgot")
              : (() => {
                  const idx = Math.min(card.intervalIndex ?? card.reviewCount ?? 0, SRS_INTERVALS_DAYS.length - 1);
                  const days = SRS_INTERVALS_DAYS[idx];
                  return (days === 1 ? t("card.srs_return_one") : t("card.srs_return")).replace("{n}", String(days));
                })()}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap ms-auto">
          <motion.button
            whileHover={{ scale: 1.05, y: -1 }}
            whileTap={{ scale: 0.94, y: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            onClick={handleLearnClick}
            className="btn-pill-superr text-xs !px-3 sm:!px-4 !py-1.5"
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#22c55e"
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={isLearnedAnimating ? "animate-draw-check" : ""}
            >
              <path d="M4.5 12.5l5 5 10-11" />
            </svg>
            <span>{t("cards.learned")}</span>
          </motion.button>
          {onForgot && (
            <motion.button
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.94, y: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              onClick={() => {
                setExitDirection("left");
                // MADDE 5: aralik sifirlanir -> metin ANINDA "yarin" gosterir.
                setForgotPressed(true);
                onForgot(card.id);
              }}
              className="btn-pill-superr text-xs !px-3 sm:!px-4 !py-1.5"
            >
              <RotateCcw size={13} strokeWidth={2.5} className="text-[#ef4444]" />
              <span>{t("cards.forgot")}</span>
            </motion.button>
          )}
        </div>
      </div>
    
      {/* MADDE 7: DUZENLE MODALI */}
      <AnimatePresence>
        {editOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[950] flex items-center justify-center bg-black/30 p-4"
            onClick={() => setEditOpen(false)}
            data-edit-modal="1"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-[16px] border border-[var(--line-strong)] bg-[var(--paper)] p-5 shadow-superrCard"
            >
              <h3 className="font-gelica text-lg font-semibold text-[var(--ink)]">
                {t("card.edit_title")}
              </h3>
              <div className="mt-4 space-y-2.5">
                <label className="block text-xs font-semibold text-[var(--ink-soft)]">{t("field.word")}</label>
                <input value={editWord} onChange={(e) => setEditWord(e.target.value)} data-edit-word="1" aria-label={t("field.word")} className="w-full rounded-[10px] border-[var(--line-strong)] bg-[var(--app-bg)] px-3 py-2 font-gelica text-sm text-[var(--ink)]" />
                <label className="block text-xs font-semibold text-[var(--ink-soft)]">{t("field.word_type")}</label>
                <select value={editPos} onChange={(e) => setEditPos(e.target.value)} data-edit-pos="1" className="w-full rounded-[10px] border-[var(--line-strong)] bg-[var(--app-bg)] px-3 py-2 font-gelica text-sm text-[var(--ink)]">
                  <option value="">—</option><option value="noun">{t("pos.noun")}</option><option value="verb">{t("pos.verb")}</option><option value="adjective">{t("pos.adj")}</option><option value="adverb">{t("pos.adv")}</option>
                </select>
                {editPos === "noun" && ["DE","IT","ES","FR"].includes(card.lang) && <>
                  <label className="block text-xs font-semibold text-[var(--ink-soft)]">{t("field.artikel")}</label>
                  <select value={editArticle} onChange={(e) => setEditArticle(e.target.value)} data-edit-article="1" className="w-full rounded-[10px] border-[var(--line-strong)] bg-[var(--app-bg)] px-3 py-2 font-gelica text-sm text-[var(--ink)]">
                    <option value="">—</option>{({DE:["der","die","das"],IT:["il","lo","la"],ES:["el","la"],FR:["le","la"]}[card.lang] || []).map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </>}
                <label className="block text-xs font-semibold text-[var(--ink-soft)]">{t("cards.meaning")}</label>
                <input value={editTrans} onChange={(e) => setEditTrans(e.target.value)} data-edit-trans="1" aria-label={t("cards.meaning")} className="w-full rounded-[10px] border-[var(--line-strong)] bg-[var(--app-bg)] px-3 py-2 font-gelica text-sm text-[var(--ink)]" />
                <label className="block text-xs font-semibold text-[var(--ink-soft)]">{t("field.note")}</label>
                <input value={editNote} onChange={(e) => setEditNote(e.target.value)} data-edit-note="1" aria-label={t("field.note")} className="w-full rounded-[10px] border-[var(--line-strong)] bg-[var(--app-bg)] px-3 py-2 font-geist text-xs text-[var(--ink)]" />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setEditOpen(false)} className="btn-pill-superr text-xs">
                  <span>{t("act.cancel")}</span>
                </button>
                <button
                  data-edit-save="1"
                  onClick={() => {
                    if (!editWord.trim() || !editTrans.trim()) return;
                    onEdit?.(card.id, {
                      word: editWord.trim(),
                      translation: editTrans.trim(),
                      note: editNote.trim() || undefined,
                      article: editPos === "noun" ? (editArticle || undefined) : undefined,
                    });
                    setEditOpen(false);
                  }}
                  className="btn-pill-orange text-xs"
                >
                  <span>{t("card.edit_save")}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MADDE 7: SILME ONAYI */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[960] flex items-center justify-center bg-black/30 p-4"
            onClick={() => setConfirmDelete(false)}
            data-delete-modal="1"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xs rounded-[16px] border border-[var(--line-strong)] bg-[var(--paper)] p-5 text-center shadow-superrCard"
            >
              <p className="font-gelica text-[15px] font-semibold text-[var(--ink)]" data-delete-question="1">
                {t("card.delete_confirm").replace("{word}", card.word)}
              </p>
              <div className="mt-5 flex justify-center gap-2">
                <button onClick={() => setConfirmDelete(false)} className="btn-pill-superr text-xs">
                  <span>{t("act.cancel")}</span>
                </button>
                <button
                  data-delete-confirm="1"
                  onClick={() => {
                    setConfirmDelete(false);
                    onDelete?.(card.id);
                  }}
                  className="btn-pill-orange text-xs"
                >
                  <span>{t("card.delete_yes")}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
</motion.article>
  );
}
