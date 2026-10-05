import { useT } from "../i18n/I18nProvider";
import { HandwritingStudioModal } from "./HandwritingStudioModal";
import { VolumeArchiveModal } from "./VolumeArchiveModal";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DX as Close,
  DSparkles as Sparkle,
  DCheck as Check,
} from "./icons/doodle";
import {
  PaperTextureType,
  HandwritingStyleType,
  InkStampType,
  TimeLightingPeriod,
  isTimeLightingEnabled,
  setTimeLightingEnabled,
  getCurrentTimePeriod,
  TIME_PERIOD_META,
  getRitualPreference,
  setRitualPreference,
  PAPER_TEXTURES,
  HANDWRITING_STYLES,
  INK_STAMPS,
  STORAGE_KEY_PAPER,
  STORAGE_KEY_FONT,
  STORAGE_KEY_STAMP,
  STORAGE_KEY_VOLUME,
  STORAGE_KEY_ARCHIVES,
  getCurrentVolume,
  getArchivedVolumes,
  isVolumeAutoswitchEnabled,
  setVolumeAutoswitchEnabled,
  getSavedPaperTexture,
  getSavedHandwriting,
  getSavedInkStamp,
  getSavedCustomHandwriting,
  ArchivedVolume,
  evaluateMilestones,
} from "../lib/notebookConfig";
import {
  playPopSound,
  playSuccessSound,
  playPaperRustle,
  getSavedSoundProfile,
  setSavedSoundProfile,
  playPenProfileSample,
  SOUND_PROFILES,
  type SoundProfileType,
} from "../lib/sound";
import {
  SketchPalette,
  SketchPaper,
  SketchQuill,
  SketchSound,
  SketchStamp,
  SketchBooks,
  SketchSunBright,
  SketchFountainPen,
  SketchPencil,
  SketchBallpoint,
  SketchTypewriter,
} from "./icons/sketchIcons";

/** Kalem ses profili kimliğine göre sketch ikonu döndür */
function SoundProfileIcon({ id, size = 16 }: { id: string; size?: number }) {
  switch (id) {
    case "fountain":
      return <SketchFountainPen size={size} strokeWidth={1.75} />;
    case "pencil":
      return <SketchPencil size={size} strokeWidth={1.75} />;
    case "ballpoint":
      return <SketchBallpoint size={size} strokeWidth={1.75} />;
    case "typewriter":
      return <SketchTypewriter size={size} strokeWidth={1.75} />;
    default:
      return <SketchFountainPen size={size} strokeWidth={1.75} />;
  }
}


interface NotebookCustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChange: () => void;
  initialTab?: "paper" | "handwriting" | "sound" | "stamp" | "volumes" | "ritual";
  onOpenGift?: () => void;
}

export function NotebookCustomizeModal({
  isOpen,
  onClose,
  onConfigChange,
  initialTab = "paper", onOpenGift,
}: NotebookCustomizeModalProps) {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<"paper" | "handwriting" | "sound" | "stamp" | "volumes" | "ritual">(initialTab);
  const [soundProfile, setSoundProfile] = useState<SoundProfileType>(getSavedSoundProfile);
  const [timeLight, setTimeLight] = useState<boolean>(isTimeLightingEnabled);
  const [ritualPref, setRitualPref] = useState<string>(getRitualPreference);

  const [paper, setPaper] = useState<PaperTextureType>(getSavedPaperTexture);
  const [font, setFont] = useState<HandwritingStyleType>(getSavedHandwriting);
  const [stamp, setStamp] = useState<InkStampType>(getSavedInkStamp);
  const [volume, setVolume] = useState<number>(getCurrentVolume);
  const [archives, setArchives] = useState<ArchivedVolume[]>(getArchivedVolumes);
  const [autoSwitch, setAutoSwitch] = useState<boolean>(isVolumeAutoswitchEnabled);
  const [celebrationMsg, setCelebrationMsg] = useState<string | null>(null);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [hasCustomHw, setHasCustomHw] = useState(() => Boolean(getSavedCustomHandwriting()));
  const [selectedArchiveVolume, setSelectedArchiveVolume] = useState<ArchivedVolume | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setVolume(getCurrentVolume());
      setArchives(getArchivedVolumes());
      setPaper(getSavedPaperTexture());
      setFont(getSavedHandwriting());
      setStamp(getSavedInkStamp());
      setCelebrationMsg(null);
      setHasCustomHw(Boolean(getSavedCustomHandwriting()));
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  
  const handleSelectSound = (id: SoundProfileType) => {
    setSoundProfile(id);
    setSavedSoundProfile(id);
    playPenProfileSample(id);
  const pName = t(SOUND_PROFILES.find((s) => s.id === id)?.nameKey || "") || id;
          setCelebrationMsg(t("cust.sound_selected").replace("{name}", pName));
    onConfigChange();
    setTimeout(() => setCelebrationMsg(null), 2500);
  };

  const handleSelectPaper = (id: PaperTextureType) => {
    playPaperRustle();
    setPaper(id);
    localStorage.setItem(STORAGE_KEY_PAPER, id);
    onConfigChange();
  };

  const handleSelectFont = (id: HandwritingStyleType) => {
    playPopSound();
    setFont(id);
    localStorage.setItem(STORAGE_KEY_FONT, id);
    onConfigChange();
  };

  const handleSelectStamp = (id: InkStampType) => {
    playSuccessSound();
    setStamp(id);
    localStorage.setItem(STORAGE_KEY_STAMP, id);
    onConfigChange();
  };

  const handleStartNewVolume = () => {
    playSuccessSound();
    const nextVol = volume + 1;

    // Mevcut cildin istatistiklerini arşivle
    const milestones = evaluateMilestones();
    const unlocked = milestones.filter((m: any) => m.unlocked).length;

    let journalCount = 0;
    try {
      const rawJ = localStorage.getItem("yourbook_journal_entries_v1");
      if (rawJ) journalCount = JSON.parse(rawJ).length || 0;
    } catch {}

    let wordsLearned = 0;
    try {
      const rawD = localStorage.getItem("yourbook_deck_v7_clean");
      if (rawD) wordsLearned = JSON.parse(rawD).filter((c: any) => c.learnedAt).length || 0;
    } catch {}

    const newArchived: ArchivedVolume = {
      volume,
      completedAt: Date.now(),
      wordsLearned,
      daysActive: Math.max(1, unlocked * 3),
      stickersUnlocked: unlocked,
      journalCount,
      note: t("vol.archived_note").replace("{n}", String(volume)),
    };

    const nextArchives = [newArchived, ...archives];
    localStorage.setItem(STORAGE_KEY_ARCHIVES, JSON.stringify(nextArchives));
    localStorage.setItem(STORAGE_KEY_VOLUME, String(nextVol));

    setVolume(nextVol);
    setArchives(nextArchives);
    setCelebrationMsg(t("vol.celebrate").replace("{n}", String(volume)).replace("{next}", String(nextVol)));
    onConfigChange();

    setTimeout(() => {
      setCelebrationMsg(null);
      setHasCustomHw(Boolean(getSavedCustomHandwriting()));
    }, 4500);
  };

  return (
    <AnimatePresence
      data-lovable-target="notebook-customize-modal"
      data-lovable-name="Modal: Defter Kişiselleştirme"
      data-lovable-file="src/components/NotebookCustomizeModal.tsx"
      data-lovable-desc="Defter görünümü/sayfa kişiselleştirme modalı"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        data-qa-modal="notebook-customize"
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 12 }}
          transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative w-full max-w-lg rounded-[18px] border border-[var(--line-strong)] bg-[var(--paper)] p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Üst Bar: Başlık & Kapat */}
          <div className="mb-4 flex items-center justify-between border-b border-[color-mix(in_srgb,var(--border-ink)_18%,transparent)] pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-white text-xs font-bold shadow-xs">
                <SketchPalette size={15} strokeWidth={2} />
              </span>
              <div>
                <h3 className="font-gelica text-base font-bold text-[var(--ink)]">
                  {t("cust.title")}
                </h3>
                <p className="font-geist text-[10.5px] text-[var(--ink-soft)]">
                  {t("cust.sub")}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              title={t("cust.tip.close")}
              className="rounded-full p-1 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
            >
              <Close size={16} />
            </button>
          </div>

          {/* Cilt Kutlama Bildirimi */}
          {celebrationMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 rounded-[12px] border border-emerald-500 bg-emerald-50 p-2.5 text-center font-geist text-xs font-bold text-emerald-800"
            >
              {celebrationMsg}
            </motion.div>
          )}

          {/* Sekmeler (Kağıt | El Yazısı | Ses | Damga | Ciltler | Işık & Ritüel) */}
          <div className="flex flex-wrap sm:flex-nowrap gap-1 rounded-[20px] border border-[var(--line)] bg-[var(--app-bg)] p-1 mb-5">
            {[
              { id: "paper", label: t("cust.tab.paper"), icon: <SketchPaper size={13} strokeWidth={1.8} /> },
              { id: "handwriting", label: t("cust.tab.handwriting"), icon: <SketchQuill size={13} strokeWidth={1.8} /> },
              { id: "sound", label: t("cust.tab.sound"), icon: <SketchSound size={13} strokeWidth={1.8} /> },
              { id: "stamp", label: t("cust.tab.stamp"), icon: <SketchStamp size={13} strokeWidth={1.8} /> },
              { id: "volumes", label: t("vol.tab").replace("{n}", String(volume)), icon: <SketchBooks size={13} strokeWidth={1.8} /> },
              { id: "ritual", label: t("cust.tab.light"), icon: <SketchSunBright size={13} strokeWidth={1.8} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => {
                  playPopSound();
                  setActiveTab(tab.id as any);
                }}
                className={`flex-1 min-w-0 flex items-center justify-center gap-1 whitespace-nowrap rounded-[16px] px-1.5 py-1.5 font-geist text-[11.5px] font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-[var(--ink)] text-[var(--app-bg)] shadow-xs"
                    : "text-[var(--ink)] hover:text-[var(--accent)]"
                }`}
              >
                <span className="shrink-0">{tab.icon}</span>
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* TAB 1: KAĞIT DOKUSU */}
          {activeTab === "paper" && (
            <div className="space-y-3">
              <p className="font-geist text-xs text-[var(--ink-soft)] leading-relaxed">
                {t("cust.paper_desc")}
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {PAPER_TEXTURES.map((tex) => {
                  const isSelected = paper === tex.id;
                  return (
                    <button
                      key={tex.id}
                      onClick={() => handleSelectPaper(tex.id)}
                      className={`relative flex flex-col items-start rounded-[14px] border-2 p-3.5 text-start transition-all ${tex.previewClass} ${
                        isSelected
                          ? "border-[var(--accent)] shadow-md scale-[1.02] bg-[var(--paper)]"
                          : "border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--paper)] hover:border-[var(--line-strong)] opacity-85 hover:opacity-100"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between mb-1">
                        <span className="font-geist text-xs font-bold text-[var(--ink)]">
                          {t(tex.nameKey)}
                        </span>
                        {isSelected && (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-white text-[10px]">
                            ✓
                          </span>
                        )}
                      </div>
                      <span className="font-geist text-[10px] text-[var(--ink-soft)]">
                        {t(tex.descKey)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

                    {/* TAB 2: EL YAZISI STİLİ */}
          {activeTab === "handwriting" && (
            <div className="space-y-3">
              <p className="font-geist text-xs text-[var(--ink-soft)] leading-relaxed">
                {t("cust.hw_desc")}
              </p>
              {/* Kendi El Yazını Kalibre Et / Üret Butonu */}
              <div className="p-3 rounded-[14px] border-2 border-dashed border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] flex items-center justify-between">
                <div>
                  <span className="font-geist text-xs font-bold text-[var(--accent)] flex items-center gap-1.5">
                    <span>{t("cust.studio.title")}</span>
                  </span>
                  <span className="font-geist text-[10.5px] text-[var(--ink-soft)] block mt-0.5">
                    {hasCustomHw ? t("cust.studio.have") : t("cust.studio.none")}
                  </span>
                </div>
                <button
                  onClick={() => {
                    playPopSound();
                    setIsStudioOpen(true);
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-[12px] bg-[var(--accent)] text-white font-geist text-[11px] font-bold shadow-xs hover:opacity-90 transition-all"
                >
                  {hasCustomHw ? t("cust.studio.open") : t("cust.studio.create")}
                </button>
              </div>
              <div className="space-y-2.5 pt-1 max-h-56 overflow-y-auto pe-1 scrollbar-thin">
                {HANDWRITING_STYLES.map((f) => {
                  const isSelected = font === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => handleSelectFont(f.id)}
                      className={`flex w-full items-center justify-between rounded-[14px] border-2 p-3 text-start transition-all ${
                        isSelected
                          ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] shadow-xs scale-[1.01]"
                          : "border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] hover:border-[var(--line-strong)]"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-geist text-xs font-bold text-[var(--ink)]">
                            {t(f.nameKey)}
                          </span>
                          <span className="font-geist text-[9.5px] text-[var(--ink-soft)]">
                            · {t(f.descKey)}
                          </span>
                        </div>
                        <p
                          className="truncate text-[15px] text-[var(--accent)] font-bold py-0.5"
                          style={{ fontFamily: f.fontFamily }}
                        >
                          "{t(f.sampleKey)}"
                        </p>
                      </div>

                      {isSelected && (
                        <span className="ms-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white text-xs font-bold">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}


          {/* TAB: KALEM SESİ PROFİLİ */}
          {activeTab === "sound" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-geist text-xs text-[var(--ink-soft)] leading-relaxed">
                  {t("cust.sound_desc")}
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                {SOUND_PROFILES.map((p) => {
                  const isSelected = soundProfile === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectSound(p.id)}
                      className={`relative flex items-center justify-between rounded-[14px] border-2 p-3 transition-all cursor-pointer active:scale-[0.98] ${
                        isSelected
                          ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_6%,transparent)] shadow-xs"
                          : "border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] hover:border-[var(--line-strong)]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
<span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--paper)] border-black/10 shadow-xs text-[var(--accent)]">
                          <SoundProfileIcon id={p.id} size={17} />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-geist text-xs font-bold text-[var(--ink)]">
                              {t(p.nameKey)}
                            </span>
                            {isSelected && (
                              <span className="rounded-full bg-[var(--accent)] text-white text-[9px] px-1.5 py-0.2 font-mono font-bold">
                                {t("cust.selected")}
                              </span>
                            )}
                          </div>
                          <span className="font-geist text-[10.5px] text-[var(--ink-soft)] block mt-0.5">
                            {t(p.descKey)}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          playPenProfileSample(p.id);
                        }}
                        title={t("cust.listen_title")}
                        className="px-2.5 py-1 rounded-[10px] bg-[var(--paper)] border border-[color-mix(in_srgb,var(--border-ink)_25%,transparent)] font-geist text-[10.5px] text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] active:scale-95 transition-all flex items-center gap-1 shadow-xs"
                      >
                        
                        <span>{t("cust.listen")}</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Gece modu sessizlik notu */}
              <div className="mt-3 p-2.5 rounded-[12px] bg-amber-500/10 border border-amber-500/20 text-amber-900 flex items-center gap-2">
                
                <span className="font-geist text-[10.5px] leading-tight text-[var(--ink)]">
                  <strong>{t("cust.night_whisper")}</strong> {t("cust.night_whisper_desc")}
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: MÜREKKEP DAMGASI */}
          {activeTab === "stamp" && (
            <div className="space-y-3">
              <p className="font-geist text-xs text-[var(--ink-soft)] leading-relaxed">
                {t("cust.stamp_desc")}
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {INK_STAMPS.map((s) => {
                  const isSelected = stamp === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSelectStamp(s.id)}
                      className={`flex flex-col items-center justify-center rounded-[14px] border-2 p-4 text-center transition-all ${
                        isSelected
                          ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] shadow-xs scale-[1.02]"
                          : "border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] hover:border-[var(--line-strong)]"
                      }`}
                    >
                      {s.id !== "none" ? (
                        <div className={`ink-stamp-box mb-2 ${s.color}`}>
                          <span className="font-mono text-[9px] font-extrabold">{t(s.titleKey)}</span>
                          <span className="font-handwritten text-[8.5px]">{t(s.subtitleKey)}</span>
                        </div>
                      ) : (
                        <span className="text-xs mb-1 font-mono uppercase font-bold text-[var(--ink-soft)]">{t("stamp.none.label")}</span>
                      )}
                      <span className="font-geist text-xs font-bold text-[var(--ink)]">
                        {t(s.titleKey)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: DEFTER CİLT SİSTEMİ & ARŞİV */}
          {activeTab === "volumes" && (
            <div className="space-y-4">
              {/* Aktif Cilt Durumu */}
              <div className="rounded-[14px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-4">
                <div className="flex items-center justify-between pb-2 border-b border-black/5">
                  <span className="font-handwritten text-xs font-bold text-[var(--accent)]">
                    {t("cust.tab.book")} · {t("common.open_state")}
                  </span>
                  <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                    {t("cover.notebook_no")} 0{volume}
                  </span>
                </div>

                <p className="font-geist text-xs text-[var(--ink)] mt-2 leading-relaxed">
                  {t("cust.volume.active")}
                </p>

                <button
                  onClick={handleStartNewVolume}
                  className="mt-3.5 w-full flex items-center justify-center gap-2 rounded-[20px] bg-[var(--ink)] py-2.5 font-geist text-xs font-bold text-[var(--app-bg)] shadow-sm hover:bg-[var(--accent)] transition-colors"
                >
                  {t("vol.complete_start").replace("{next}", String(volume + 1))}
                </button>
              </div>

              {/* Otomatik Cilt Geçişi */}
              <div className="rounded-[14px] border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] p-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-geist text-xs font-bold text-[var(--ink)] block">
                      {t("volume.autoswitch")}
                    </span>
                    <span className="font-geist text-[10.5px] text-[var(--ink-soft)] block mt-0.5 leading-relaxed">
                      {t("volume.autoswitch_desc")}
                    </span>
                  </div>
                  <button
                    data-autoswitch="1"
                    onClick={() => {
                      playPopSound();
                      const next = !autoSwitch;
                      setAutoSwitch(next);
                      setVolumeAutoswitchEnabled(next);
                      onConfigChange();
                    }}
                    className={"shrink-0 ms-2 rounded-full px-3 py-1 font-geist text-xs font-bold transition-colors " + (autoSwitch ? "bg-[var(--ink)] text-[var(--app-bg)]" : "border border-[var(--line)] text-[var(--ink)]")}
                  >
                    {autoSwitch ? t("common.on") : t("common.off")}
                  </button>
                </div>
              </div>

              {/* Geçmiş Tamamlanan Defterler */}
              <div>
                <span className="font-handwritten text-xs font-bold text-[var(--ink-soft)] block mb-2">
                  {t("vol.archive_suffix")} ({archives.length})
                </span>

                {archives.length === 0 ? (
                  <p className="rounded-[12px] border border-dashed border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] p-3.5 text-center font-geist text-xs text-[var(--ink-soft)]">
                    {t("cust.volume.empty")}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-36 overflow-y-auto scrollbar-thin pe-1">
                   {archives.map((arc) => (
                    <button
                       key={arc.volume}
                       type="button"
                       onClick={() => setSelectedArchiveVolume(arc)}
                       title={t("vol.open_detail")}
                       className="flex w-full items-center justify-between rounded-[10px] border-[color-mix(in_srgb,var(--border-ink)_18%,transparent)] bg-[var(--app-bg)] p-2.5 text-start transition-colors hover:border-[var(--line-strong)]"
                     >
                       <div>
                         <span className="font-mono text-xs font-bold text-[var(--ink)]">
                           {t("vol.done_label").replace("{n}", String(arc.volume))}
                         </span>
                         <span className="block font-geist text-[10px] text-[var(--ink-soft)]">
                           {t("vol.arc_summary").replace("{w}", String(arc.wordsLearned)).replace("{g}", String(arc.journalCount)).replace("{s}", String(arc.stickersUnlocked))}
                         </span>
                       </div>
                       <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[9px] font-bold">
                         {t("cust.volume.archived")}
                       </span>
                    </button>
                   ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: IŞIK VE AÇILIŞ RİTÜELİ */}
          {activeTab === "ritual" && (
            <div className="space-y-4">
              {/* Zamana Duyarlı Işık */}
              <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] p-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-geist text-xs font-bold text-[var(--ink)] block">
                      {t("cust.light_title")}
                    </span>
                    <span className="font-geist text-[10.5px] text-[var(--ink-soft)] block mt-0.5 leading-relaxed">
                      {t("cust.light_desc")}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      playPopSound();
                      const next = !timeLight;
                      setTimeLight(next);
                      setTimeLightingEnabled(next);
                      onConfigChange();
                    }}
                    className={`shrink-0 ms-2 rounded-full px-3 py-1 font-geist text-xs font-bold transition-colors ${
                      timeLight
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {timeLight ? t("common.on") : t("common.off")}
                  </button>
                </div>

                {timeLight && (
                  <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-[color-mix(in_srgb,var(--border-ink)_15%,transparent)] bg-[var(--paper)] p-2">
                    <span className="text-base">{TIME_PERIOD_META[getCurrentTimePeriod()].icon}</span>
                    <div className="min-w-0 flex-1">
                      <span className="font-geist text-xs font-semibold text-[var(--ink)] block">
                        {t("cust.light_current")} {t(TIME_PERIOD_META[getCurrentTimePeriod()].labelKey)}
                      </span>
                      <span className="font-geist text-[9.5px] text-[var(--ink-soft)] block">
                        {t(TIME_PERIOD_META[getCurrentTimePeriod()].descriptionKey)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Kişisel Açılış Ritüeli */}
              <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] p-3.5">
                <span className="font-geist text-xs font-bold text-[var(--ink)] block">
                  {t("cust.ritual_title")}
                </span>
                <span className="font-geist text-[10.5px] text-[var(--ink-soft)] block mt-0.5 mb-2.5 leading-relaxed">
                  {t("cust.ritual_desc")}
                </span>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "auto", label: t("cust.ritual.auto") },
                    { id: "morning", label: t("cust.ritual.morning") },
                    { id: "afternoon", label: t("cust.ritual.afternoon") },
                    { id: "night", label: t("cust.ritual.night") },
                  ].map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        playPopSound();
                        setRitualPref(r.id);
                        setRitualPreference(r.id);
                        onConfigChange();
                      }}
                      className={`rounded-[10px] border p-2 text-start font-geist text-xs transition-all ${
                        ritualPref === r.id
                          ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] font-bold text-[var(--ink)]"
                          : "border-black/10 bg-[var(--paper)] text-[var(--ink-soft)] hover:border-black/20"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

                    {/* Alt Kapat Butonu */}
          <div className="mt-5 pt-3 border-t border-[color-mix(in_srgb,var(--border-ink)_15%,transparent)] flex justify-end">
            <button
              onClick={onClose}
              className="rounded-[20px] bg-[var(--ink)] px-5 py-2 font-geist text-xs font-semibold text-[var(--app-bg)] hover:bg-[var(--accent)] transition-colors shadow-xs"
            >
              {t("cust.save_close")}
            </button>
          </div>

        {/* Özel El Yazısı Atölyesi — "Hemen Oluştur" bu modalı açar */}
            <VolumeArchiveModal
              isOpen={Boolean(selectedArchiveVolume)}
              volume={selectedArchiveVolume}
              onClose={() => setSelectedArchiveVolume(null)}
            />
        <HandwritingStudioModal
          isOpen={isStudioOpen}
          onClose={() => setIsStudioOpen(false)}
          onApplied={() => {
            setHasCustomHw(Boolean(getSavedCustomHandwriting()));
            onConfigChange();
          }}
        />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}


