import {
  SketchMoodPeaceful,
  SketchMoodProductive,
  SketchMoodCalm,
  SketchMoodTired,
  SketchMoodTense,
  SketchMoodRain,
  SketchLightbulb,
  SketchFlame,
  SketchFeatherEdit,
  SketchOpenBook,
  SketchCompass,
  SketchCamera,
  SketchLock,
  SketchKey,
  SketchHistoryClock,
  SketchMic,
} from "./icons/sketchIcons";
import { useT } from "../i18n/I18nProvider";
import { supabase, isCloudConfigured } from "../lib/supabase";
import { JournalExportModal } from "./JournalExportModal";
import { JournalMoodRadar } from "./JournalMoodRadar";
import JournalSpread from "./JournalSpread";
import { useSpeechDictation } from "../lib/useSpeechDictation";
import { JournalOcrImportModal } from "./JournalOcrImportModal";
import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DSparkles as Sparkle,
  DClock as Clock,
  DCheck as Check,
  DX as Close,

  DSearch as Search,
  DCalendar as CalendarIcon,
    DDownload as Download,
  } from "./icons/doodle";
import { playPopSound, playSuccessSound, playPaperRustle } from "../lib/sound";
import { getSavedCustomHandwriting } from "../lib/notebookConfig";
import type { PenLayer } from "../lib/penTypes";
import PenCanvas from "./PenCanvas";

export interface JournalEntry {
  id: string;
  dateKey: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  timestamp: number;
  mood: string; // "peaceful" | "productive" | "calm" | "tired" | "tense" | "hard"
  content: string;
  promptUsed?: string;
  wordCount: number;
  /* v-pen: kalemle yazilan VEKTOR el yazisi (opsiyonel). */
  /* Eski kayitlarda yoktur; yeni kayitlarda dolu olabilir. */
  pen?: PenLayer | null;
}

interface JournalViewProps {
  onAwardXp?: (amount: number) => void;
  /** Başka bir görünümden (ör. ajanda) gelinen hedef gün. */
  initialDateKey?: string | null;
  /** Hedef gün tüketildikten sonra çağrılır (üst bileşen state'i temizler). */
  onConsumedDateKey?: () => void;
}

const STORAGE_KEY_JOURNAL = "yourbook_journal_entries_v1";
const STORAGE_KEY_PIN = "yourbook_journal_pin_v1";
const STORAGE_KEY_PROMPT_PREF = "yourbook_journal_prompt_closed_v1";


function renderMoodSketchIcon(moodId: string, size = 14) {
  switch (moodId) {
    case "peaceful":
      return <SketchMoodPeaceful size={size} strokeWidth={1.8} />;
    case "productive":
      return <SketchMoodProductive size={size} strokeWidth={1.8} />;
    case "calm":
      return <SketchMoodCalm size={size} strokeWidth={1.8} />;
    case "tired":
      return <SketchMoodTired size={size} strokeWidth={1.8} />;
    case "tense":
      return <SketchMoodTense size={size} strokeWidth={1.8} />;
    case "hard":
      return <SketchMoodRain size={size} strokeWidth={1.8} />;
    default:
      return <SketchMoodPeaceful size={size} strokeWidth={1.8} />;
  }
}

const MOODS = [
  { id: "peaceful", emoji: "", label: "huzurlu", color: "bg-emerald-500/15 text-emerald-700 border-emerald-400" },
  { id: "productive", emoji: "", label: "üretken", color: "bg-orange-500/15 text-orange-700 border-orange-400" },
  { id: "calm", emoji: "", label: "sakin", color: "bg-blue-500/15 text-blue-700 border-blue-400" },
  { id: "tired", emoji: "", label: "yorgun", color: "bg-amber-500/15 text-amber-700 border-amber-400" },
  { id: "tense", emoji: "", label: "gergin", color: "bg-purple-500/15 text-purple-700 border-purple-400" },
  { id: "hard", emoji: "", label: "zor bir gün", color: "bg-slate-500/15 text-slate-700 border-slate-400" },
];

const WRITING_PROMPTS = [
  "bugün seni gülümseten küçük bir an oldu mu?",
  "bugün en çok ne yordu seni, neden?",
  "yarına kendine fısıldamak istediğin tek bir not...",
  "şu an zihninden geçen filtresiz ilk cümle ne?",
  "bugün öğrendiğin ya da fark ettiğin bir şey var mı?",
  "kendine bugün için neyi affetmek veya teşekkür etmek istersin?",
  "etrafında şu an hissettiğin 3 somut ayrıntı nedir?",
];

export function JournalView({ onAwardXp, initialDateKey, onConsumedDateKey }: JournalViewProps) {
  const { t, lang } = useT();
  /**
   * Ajanda kayıtlarından bağlama duyarlı bir ilham istemi üretir.
   * Gün içinde planlanan işler, o gün sayfasına doğal bir giriş cümlesi olur.
   */
  const buildAgendaPrompt = (
    events: { timeStr: string; title: string; hasAlarm?: boolean }[],
    tFn: (k: string) => string
  ) => {
    if (!events.length) return "";
    const first = events[0];
    const total = events.length;
    const hasAlarm = events.some((e) => e.hasAlarm);
    if (total === 1) {
      return tFn(hasAlarm ? "aprompt.single_alarm" : "aprompt.single")
        .replace("{time}", first.timeStr)
        .replace("{title}", first.title);
    }
    return tFn("aprompt.multi")
      .replace("{count}", String(total))
      .replace("{time}", first.timeStr)
      .replace("{title}", first.title);
  };

  const moodLabel = (id: string) => t(`journal.mood.${id}`);


  // --- Çapraz bağlantı: ajandadan gelen hedef gün ---
  // Hedef günü bir kez uygula, sonra üst bileşene haber ver ki state temizlensin.
  useEffect(() => {
    if (!initialDateKey) return;
    setSelectedDateKey(initialDateKey);
    setActiveTab("write");
    onConsumedDateKey?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDateKey]);
  const promptTexts = [t("prompt.smile"), t("prompt.tired"), t("prompt.tomorrow"), t("prompt.unfiltered"), t("prompt.learned"), t("prompt.forgive"), t("prompt.details")];
  // --- VERİ STATE'İ ---
  const [entries, setEntries] = useState<JournalEntry[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_JOURNAL);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  // --- KİLİT / MAHREMİYET ---
  const [pin, setPin] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY_PIN);
  });
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => !localStorage.getItem(STORAGE_KEY_PIN));
  const [enteredPin, setEnteredPin] = useState("");
  // v-fix(a): yanlis PIN icin GORUNUR hata mesaji (alert yerine).
  const [pinError, setPinError] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  // MADDE 8: "PIN'imi unuttum" kurtarma akisi (hesap dogrulama + yeni PIN).
  const [recoverMode, setRecoverMode] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverPassword, setRecoverPassword] = useState("");
  const [recoverError, setRecoverError] = useState<string | null>(null);
  const [recoverBusy, setRecoverBusy] = useState(false);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [newPinInput, setNewPinInput] = useState("");

  // --- GÜNLÜK YAZMA STATE'İ ---
  const todayKey = new Date().toISOString().slice(0, 10);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);

  // --- Çapraz bağlantı: seçili gün ajanda kayıtları (ajanda ↔ günlük) ---
  const dayAgendaEvents = useMemo(() => {
    try {
      const raw = localStorage.getItem("superr_agenda_events_v4");
      if (!raw) return [] as { id: string; timeStr: string; title: string; hasAlarm?: boolean }[];
      const all = JSON.parse(raw) as { id?: string; dateKey?: string; timeStr?: string; title?: string; hasAlarm?: boolean }[];
      return all
        .filter((e) => e.dateKey === selectedDateKey && e.title)
        .map((e) => ({
          id: e.id || `${e.dateKey}-${e.timeStr}-${e.title}`,
          timeStr: e.timeStr || "",
          title: e.title || "",
          hasAlarm: !!e.hasAlarm,
        }))
        .sort((a, b) => a.timeStr.localeCompare(b.timeStr));
    } catch {
      return [] as { id: string; timeStr: string; title: string; hasAlarm?: boolean }[];
    }
  }, [selectedDateKey]);
  const [selectedMood, setSelectedMood] = useState<string>("peaceful");
  const [currentText, setCurrentText] = useState("");
  // v-pen: yazim modu (mevcut klavye akisi DEGISMEZ, yanina ek mod).
  const [penMode, setPenMode] = useState<"keyboard" | "pen">("keyboard");
  // v-pen: kalemle cizilen VEKTOR katman (kayitli gunlugun parcasi).
  const [penLayer, setPenLayer] = useState<PenLayer | null>(null);
  const [activePrompt, setActivePrompt] = useState<string>("");
  const [showPrompt, setShowPrompt] = useState(true);
  // İstem kaynağı: hangi dış kaynaktan geldi (rozet metni için).
  const [promptSource, setPromptSource] = useState<"agenda" | "alarm" | "note" | null>(null);
  // Radardan / ısı haritasından bir güne atlanınca kısa süreli vurgu
  const [jumpFlash, setJumpFlash] = useState(false);

  // Atlama vurgusunu kısa süre sonra kapat
  useEffect(() => {
    if (!jumpFlash) return;
    const id = window.setTimeout(() => setJumpFlash(false), 1200);
    return () => window.clearTimeout(id);
  }, [jumpFlash]);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);

  // Kullanıcının kendi elinden çıkan imza örneği (varsa günlük sayfasında gösterilir)
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  useEffect(() => {
    const readSig = () => {
      try {
        const ch = getSavedCustomHandwriting();
        setSignatureImage(ch?.previewImage || null);
      } catch {
        setSignatureImage(null);
      }
    };
    readSig();
    window.addEventListener("notebook-config-changed", readSig);
    return () => window.removeEventListener("notebook-config-changed", readSig);
  }, []);

  // --- GÖRÜNÜM SEÇİMİ (Yazma | Akış/Zaman Çizelgesi | Takvim) ---
  const [activeTab, setActiveTab] = useState<"write" | "timeline" | "calendar">("write");
  // Defter çift sayfa (book spread) okuma modu
  const [spreadOpen, setSpreadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Rastgele prompt seç (günün başında)
  // İstem seçimi: gün içinde ajanda kaydı varsa ona göre, yoksa rastgele.
  // Ajanda kayıtları / dil / gün değişince istem yenilenir.
  useEffect(() => {
    // Hatırlatıcıdan gelindiyse onu istem olarak kullan (alarm → günlük bağlantısı).
    try {
      const seedRaw = sessionStorage.getItem("yourbook_journal_seed_v1");
      if (seedRaw) {
        const seed = JSON.parse(seedRaw) as { title?: string; dateKey?: string };
        if (seed?.title && (!seed.dateKey || seed.dateKey === selectedDateKey)) {
          setActivePrompt(
            (seed as { fromNote?: boolean }).fromNote
              ? t("aprompt.from_note").replaceAll("{title}", seed.title)
              : t("aprompt.from_alarm").replaceAll("{title}", seed.title)
          );
          setPromptSource((seed as { fromNote?: boolean }).fromNote ? "note" : "alarm");
          sessionStorage.removeItem("yourbook_journal_seed_v1");
          return;
        }
      }
    } catch {
      /* yoksay */
    }

    const agendaPrompt = buildAgendaPrompt(
      dayAgendaEvents.map((e) => ({ timeStr: e.timeStr, title: e.title, hasAlarm: e.hasAlarm })),
      t
    );
    if (agendaPrompt) {
      setActivePrompt(agendaPrompt);
      setPromptSource("agenda");
    } else {
      const idx = Math.floor(Math.random() * promptTexts.length);
      setActivePrompt(promptTexts[idx]);
      setPromptSource(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateKey, dayAgendaEvents.length, lang]);

  // localStorage kalıcılığı
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_JOURNAL, JSON.stringify(entries));
    } catch {}
  }, [entries]);

  // Seçili tarihe ait son girişi yükle veya sıfırla
  useEffect(() => {
    const dayEntries = entries.filter((e) => e.dateKey === selectedDateKey);
    if (dayEntries.length > 0) {
      const last = dayEntries[dayEntries.length - 1];
      setCurrentText(last.content);
      setSelectedMood(last.mood);
      setCurrentEntryId(last.id);
      // v-pen: kayitli vektor cizim varsa yukle (yoksa temizle).
      setPenLayer(last.pen ?? null);
      setPenMode("keyboard");
    } else {
      setPenLayer(null); // v-pen
      setCurrentText("");
      setSelectedMood("peaceful");
      setCurrentEntryId(null);
    }
    setSaveStatus("idle");
  }, [selectedDateKey]);

  // --- AUTOSAVE MEKANİZMASI (Debounced 700ms) ---
  const saveTimeoutRef = useRef<number | null>(null);

  const saveCurrentEntry = (text: string, mood: string, pen?: PenLayer | null) => {
    // v-pen: metin bos olsa bile CIZIM varsa kaydet (kalem modu).
    const hasPen = !!pen && Array.isArray(pen.strokes) && pen.strokes.length > 0;
    if (!text.trim() && !hasPen) return;

    setSaveStatus("saving");
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 5);
    const words = text.trim().split(/\s+/).filter(Boolean).length;

    setEntries((prev) => {
      // Eğer mevcut bir gün girdisi düzenleniyorsa yerinde güncelle
      if (currentEntryId) {
        return prev.map((e) =>
          e.id === currentEntryId
            ? { ...e, content: text, mood, wordCount: words, timestamp: Date.now(), pen: pen ?? e.pen ?? null }
            : e
        );
      }
      // Yeni girdi oluştur
      const newEntry: JournalEntry = {
        id: "j-" + Date.now(),
        dateKey: selectedDateKey,
        timeStr,
        timestamp: Date.now(),
        mood,
        content: text,
        promptUsed: activePrompt || undefined,
        wordCount: words,
        pen: pen ?? null,
      };
      setCurrentEntryId(newEntry.id);

      // İlk defa kaydedildiğinde nazik bir XP hediyesi (+8 XP)
      if (onAwardXp && words >= 5) {
        onAwardXp(8);
      }

      return [newEntry, ...prev];
    });

    setSaveStatus("saved");
    window.setTimeout(() => setSaveStatus("idle"), 2400);
  };

  const handleTextChange = (newVal: string) => {
    setCurrentText(newVal);
    setSaveStatus("saving");

    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      saveCurrentEntry(newVal, selectedMood, penLayer);
    }, 750);
  };

  // Sesli dikte (Web Speech API).
  //
  // Akış: kullanıcı konuşurken ARA metin (interim) doğrudan yazı alanına yazılır —
  // yani konuşurken canlı görünür. Cümle kesinleşince ara metin kesin metne dönüşür.
  //
  // ÖNEMLİ: onFinal/onInterim hook'un ref'inde saklanır ve currentText'in ESKİ hâlini
  // görebilir (stale closure). Bu yüzden temel metni bir ref'te tutup oradan okuruz.
  const dictationBaseRef = useRef<string>("");
  const dictation = useSpeechDictation({
    lang,
    onInterim: (partial) => {
      const base = dictationBaseRef.current;
      const sep = base.length === 0 || /[\s\n]$/.test(base) ? "" : " ";
      setCurrentText(base + sep + partial);
      setSaveStatus("saving");
    },
    onFinal: (text) => {
      const base = dictationBaseRef.current;
      const sep = base.length === 0 || /[\s\n]$/.test(base) ? "" : " ";
      const committed = base + sep + text + " ";
      dictationBaseRef.current = committed;
      setCurrentText(committed);
      setSaveStatus("saving");
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
      // Dikte kesinleşince HIZLI kaydet — kullanıcı beklemesin.
      saveTimeoutRef.current = window.setTimeout(() => {
        saveCurrentEntry(committed, selectedMood, penLayer);
      }, 250);
    },
  });

  // Dikte başlarken mevcut yazıyı temel al (üzerine yazmak yerine sonuna ekler).
  const dictationToggle = () => {
    if (!dictation.listening) dictationBaseRef.current = currentText;
    dictation.toggle();
  };

  /** Çift sayfa görünümünde BOŞ bir sayfaya yeni günlük girdisi oluştur. */
  const handleSpreadCreate = (
    dateKey: string,
    content: string,
    mood: string | null
  ) => {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const now = Date.now();
    const pad = (x: number) => String(x).padStart(2, "0");
    const d = new Date();
    const timeStr = pad(d.getHours()) + ":" + pad(d.getMinutes());
    const newEntry: JournalEntry = {
      id: `${dateKey}-${now}-${Math.random().toString(36).slice(2, 8)}`,
      dateKey,
      timeStr,
      timestamp: now,
      mood: mood || "calm",
      content,
      wordCount: words,
    };
    setSaveStatus("saving");
    setEntries((prev) => [...prev, newEntry]);
    playPopSound();
  };

  /** Çift sayfa görünümünde satır içi düzenlemeyi kaydeder. */
  const handleSpreadSave = (
    entryId: string,
    changes: { content: string; mood: string | null }
  ) => {
    const words = changes.content.trim().split(/\s+/).filter(Boolean).length;
    setSaveStatus("saving");
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? {
              ...e,
              content: changes.content,
              // Ruh hali kaldırıldıysa önceki değeri koru (tip gereği zorunlu alan)
              mood: changes.mood ?? e.mood,
              wordCount: words,
              timestamp: Date.now(),
            }
          : e
      )
    );
    playPopSound();
  };

  const handleMoodSelect = (moodId: string) => {
    playPopSound();
    setSelectedMood(moodId);
    if (currentText.trim()) {
      saveCurrentEntry(currentText, moodId, penLayer);
    }
  };

  // Yeni oturum / ayrı bir giriş ekle (aynı gün sabah/akşam)
  const handleAddNewSession = () => {
    playPaperRustle();
    setCurrentText("");
    setCurrentEntryId(null);
    setSelectedMood("peaceful");
    setSaveStatus("idle");
  };

  // --- KİLİT FONKSİYONLARI ---
  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin === pin) {
      playSuccessSound();
      setIsUnlocked(true);
      setEnteredPin("");
      setPinError(null);
    } else {
      playPopSound();
      // v-fix(a): alert() yerine gorunur mesaj - kaybolunca/kilit acilinca temizlenir.
      setPinError(t("journal.wrong_pin"));
      // v-fix(b): HER denemede input'u tamamen temizle (uzerine eklenmesin).
      setEnteredPin("");
    }
  };

  // MADDE 8: PIN kurtarma. Hesap (Supabase auth) ile YENIDEN DOGRULAMA yapilir;
  // basarili olursa kullanici yeni PIN belirler ve kilit acilir.
  const handleRecoverPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoverError(null);

    // Hesap sistemi yoksa (yerel mod) kullaniciyi bilgilendir.
    if (!isCloudConfigured || !supabase) {
      setRecoverError(t("journal.need_account"));
      return;
    }
    if (!recoverEmail.trim() || !recoverPassword) {
      setRecoverError(t("journal.wrong_pin_hint"));
      return;
    }

    setRecoverBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: recoverEmail.trim(),
        password: recoverPassword,
      });
      if (error) {
        setRecoverError(error.message || t("journal.wrong_pin_hint"));
        return;
      }
      // Dogrulama BASARILI -> eski PIN'i temizle, yeni PIN belirleme moduna gec.
      localStorage.removeItem(STORAGE_KEY_PIN);
      setPin(null);
      setEnteredPin("");
      setPinError(null);
      setRecoverMode(false);
      setRecoverEmail("");
      setRecoverPassword("");
      setIsPinModalOpen(true); // yeni PIN belirleme modali
      setIsUnlocked(true);     // kilit acildi
    } catch (err) {
      setRecoverError(err instanceof Error ? err.message : t("journal.wrong_pin_hint"));
    } finally {
      setRecoverBusy(false);
    }
  };

  const handleSavePin = () => {
    if (newPinInput.length >= 4) {
      playSuccessSound();
      localStorage.setItem(STORAGE_KEY_PIN, newPinInput);
      setPin(newPinInput);
      setIsPinModalOpen(false);
      setNewPinInput("");
      // v-fix(c): KILIT HEMEN DEVREDE. Sayfa yenilemeye gerek kalmasin;
      // boylece bu sayfaya tekrar girildiginde kilit ekrani ANINDA acilir.
      setIsUnlocked(false);
      setEnteredPin("");
      setPinError(null);
    } else if (newPinInput === "") {
      // Kilidi kaldir
      localStorage.removeItem(STORAGE_KEY_PIN);
      setPin(null);
      setIsPinModalOpen(false);
      // Kilit kaldirildi -> sayfa acik kalsin
      setIsUnlocked(true);
    }
  };

  // --- GEÇMİŞTEN BİR SAYFA (1 Ay veya Eski Hatırlatma) ---
  const pastMemory = useMemo(() => {
    if (entries.length < 3) return null;
    const now = Date.now();
    // En az 7 gün eski rastgele bir anı
    const oldEntries = entries.filter((e) => now - e.timestamp > 7 * 864e5);
    if (oldEntries.length === 0) return null;
    return oldEntries[0];
  }, [entries]);

  // --- ALIŞKANLIK PEKİŞTİRME (Nazik seri hesabı) ---
  const journalStreak = useMemo(() => {
    const dates = Array.from(new Set(entries.map((e) => e.dateKey))).sort().reverse();
    if (dates.length === 0) return 0;

    let count = 0;
    const checkDate = new Date();

    for (let i = 0; i < 30; i++) {
      const key = checkDate.toISOString().slice(0, 10);
      if (dates.includes(key)) {
        count++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (i === 0) {
        // Bugün henüz yazılmadıysa dün kontrol edilsin
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  }, [entries]);

  // --- DIŞA AKTARMA (Text Dosyası Olarak İndir) ---
  const handleExportJournal = () => {
    playSuccessSound();
    const lines: string[] = [
      "========================================",
      "       " + t("txt.header") + "    ",
      "========================================\n",
    ];

    entries.forEach((e) => {
      const moodObj = MOODS.find((m) => m.id === e.mood);
      lines.push(`${t("txt.date")}: ${e.dateKey} · ${e.timeStr}`);
      lines.push(`${t("txt.mood")}: ${moodObj?.emoji || ""} ${moodObj ? moodLabel(moodObj.id) : ""}`);
      if (e.promptUsed) lines.push(`${t("txt.prompt")}: "${e.promptUsed}"`);
      lines.push("----------------------------------------");
      lines.push(e.content);
      lines.push("\n\n");
    });

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yourbook-gunluk-${todayKey}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- KİLİTLİ EKRAN GÖRÜNÜMÜ ---
  if (pin && !isUnlocked) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center select-none bg-[var(--app-bg)]"
        data-lovable-target="journal-view"
        data-lovable-name="Sayfa: Günlük"
        data-lovable-file="src/components/JournalView.tsx"
        data-lovable-desc="Günlük sayfası; sekmeler (yaz/akış/duygu), yazı alanı, ruh hali, sesle yaz"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-xs rounded-[20px] border-2 border-[var(--ink)] bg-[var(--paper)] p-8 shadow-2xl"
        >
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]">
            <SketchLock size={24} strokeWidth={1.8} />
          </div>
          <h3 className="font-gelica text-xl font-bold text-[var(--ink)]">
            günlük kilitli
          </h3>
          <p className="font-geist text-xs text-[var(--ink-soft)] mt-1 mb-5">
            Bu kişisel sayfayı açmak için PIN kodunu gir.
          </p>

          <form onSubmit={handleUnlock} className="space-y-3">
            <input
              type="password"
              maxLength={4}
              value={enteredPin}
              onChange={(e) => {
                setEnteredPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                if (pinError) setPinError(null); // yeni giris yapilinca hata kaybolsun
              }}
              placeholder="••••"
              autoFocus
              className="w-full text-center tracking-[0.5em] font-mono text-2xl py-2 rounded-[12px] border-2 border-[var(--ink)] bg-[var(--app-bg)] outline-none focus:border-[var(--accent)]"
            />

            {/* v-fix(a): yanlis PIN uyarisi - gorunur, animasyonlu, kendiliginden kaybolur */}
            {pinError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="font-geist text-[11px] font-semibold text-[var(--accent)]"
                role="alert"
                aria-live="assertive"
              >
                {pinError}
              </motion.p>
            )}
            <button
              type="submit"
              className="w-full rounded-[20px] bg-[var(--accent)] py-2.5 font-gelica text-xs font-bold text-white shadow-sm hover:opacity-95"
            >
              kilidi aç
            </button>
          </form>

          {/* ⭐ MADDE 8: PIN UNUTULURSA ÇIKIŞ YOLU.
              Önceden kilitli ekranda hiçbir çıkış yoktu. Şimdi:
              hesap (Supabase auth) ile yeniden doğrulama → yeni PIN belirleme. */}
          <div className="mt-4 border-t border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] pt-3">
            {!recoverMode ? (
              <button
                type="button"
                data-forgot-pin="1"
                onClick={() => { playPopSound(); setRecoverMode(true); setRecoverError(null); }}
                className="mx-auto block font-handwritten text-[13px] font-bold text-[var(--accent)] underline decoration-dotted underline-offset-2 hover:opacity-80"
              >
                {t("journal.forgot_pin")}
              </button>
            ) : (
              <form onSubmit={handleRecoverPin} className="space-y-2.5" data-recover-form="1">
                <p className="font-gelica text-[12px] font-semibold text-[var(--ink)]">
                  {t("journal.reset_pin_title")}
                </p>
                <p className="font-geist text-[10.5px] leading-relaxed text-[var(--ink-soft)]">
                  {t("journal.reset_pin_desc")}
                </p>

                <input
                  type="email"
                  value={recoverEmail}
                  onChange={(e) => { setRecoverEmail(e.target.value); if (recoverError) setRecoverError(null); }}
                  placeholder={t("auth.email")}
                  data-recover-email="1"
                  autoComplete="email"
                  className="w-full rounded-[10px] border border-[var(--ink)] bg-[var(--app-bg)] px-3 py-2 font-geist text-[12px] text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                />
                <input
                  type="password"
                  value={recoverPassword}
                  onChange={(e) => { setRecoverPassword(e.target.value); if (recoverError) setRecoverError(null); }}
                  placeholder={t("auth.password")}
                  data-recover-password="1"
                  autoComplete="current-password"
                  className="w-full rounded-[10px] border border-[var(--ink)] bg-[var(--app-bg)] px-3 py-2 font-geist text-[12px] text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                />

                {recoverError && (
                  <p
                    className="rounded-[8px] border border-[#ef4444] bg-[color-mix(in_srgb,#ef4444_10%,transparent)] px-2.5 py-1.5 font-geist text-[11px] font-semibold text-[#b91c1c]"
                    role="alert"
                    aria-live="assertive"
                    data-recover-error="1"
                  >
                    {recoverError}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setRecoverMode(false); setRecoverError(null); setRecoverPassword(""); }}
                    className="rounded-[20px] border-[1.5px] border-[var(--ink)] bg-[var(--app-bg)] px-3 py-1.5 font-gelica text-[11px] font-semibold text-[var(--ink)]"
                  >
                    {t("act.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={recoverBusy}
                    data-recover-submit="1"
                    className="rounded-[20px] bg-[var(--accent)] px-3.5 py-1.5 font-gelica text-[11px] font-bold text-white disabled:opacity-50"
                  >
                    {recoverBusy ? "…" : t("journal.sign_in")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // Filtrelenmiş akış girişleri
  const filteredTimeline = entries.filter((e) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return e.content.toLowerCase().includes(q) || e.dateKey.includes(q);
  });

  return (
    <div className="paper-grain flex h-full w-full flex-col overflow-y-auto px-4 sm:px-10 py-5 sm:py-8 bg-[var(--app-bg)] text-[var(--ink)] scrollbar-thin">
      {/* 1. ÜST BAŞLIK + SERİ + KİLİT + DIŞA AKTAR */}
      <div className="border-b-2 border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 pb-1">
            <span className="font-handwritten text-[var(--accent)] text-sm font-bold">
              {t("journal.title_meta")}
            </span>
            {journalStreak > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-orange-400 bg-orange-50 px-2 py-0.5 font-gelica text-[10px] font-bold text-orange-700">
                <SketchFlame size={12} strokeWidth={2} className="shrink-0 text-orange-600" />
                <span>{t("journal.streak_days").replace("{n}", String(journalStreak))}</span>
              </span>
            )}
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold lowercase text-[var(--ink)] leading-tight tracking-tight">
            <span className="font-handwritten text-[var(--accent)] font-bold me-1.5 text-[1.18em] align-baseline">{t("journal.title_accent")}</span>{" "}
            <span className="font-gelica">{t("journal.word")}</span>
            <span className="text-[var(--accent)]">.</span>
          </h2>
        </div>

        {/* Aksiyon Butonları (Kilit, Dışa Aktar, Sekmeler) */}
        <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
          {/* Sekme Seçicisi (Yazma | Akış | Takvim) */}
          <div className="flex rounded-[22px] border border-[var(--ink)] bg-[var(--paper)] p-0.5 shadow-xs">
            <button
              onClick={() => { playPopSound(); setActiveTab("write"); }}
              className={`flex items-center gap-1.5 rounded-[18px] px-3 py-1 font-gelica text-xs font-semibold transition-colors ${
                activeTab === "write" ? "bg-[var(--ink)] text-white shadow-xs border-[var(--ink)]" : "text-[var(--ink)] border-[var(--ink)] hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
              }`}
            >
              <SketchFeatherEdit size={13} strokeWidth={1.8} className="shrink-0" />
              <span>{t("journal.tab.write")}</span>
            </button>
            <button
              onClick={() => { playPopSound(); setActiveTab("timeline"); }}
              className={`flex items-center gap-1.5 rounded-[18px] px-3 py-1 font-gelica text-xs font-semibold transition-colors ${
                activeTab === "timeline" ? "bg-[var(--ink)] text-white shadow-xs border-[var(--ink)]" : "text-[var(--ink)] border-[var(--ink)] hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
              }`}
            >
              <SketchOpenBook size={13} strokeWidth={1.8} className="shrink-0" />
              <span>{t("journal.tab.flow")}</span>
            </button>
            <button
              onClick={() => { playPopSound(); setActiveTab("calendar"); }}
              className={`flex items-center gap-1.5 rounded-[18px] px-3 py-1 font-gelica text-xs font-semibold transition-colors ${
                activeTab === "calendar" ? "bg-[var(--ink)] text-white shadow-xs border-[var(--ink)]" : "text-[var(--ink)] border-[var(--ink)] hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
              }`}
            >
              <SketchCompass size={13} strokeWidth={1.8} className="shrink-0" />
              <span>{t("journal.tab.compass")}</span>
            </button>
          </div>

          {/* Dışa Aktar */}
          {entries.length > 0 && (
            <button
              onClick={() => {
                playPopSound();
                setIsExportModalOpen(true);
              }}
              title={t("journal.export_modal_sub")}
              className="flex h-8 items-center gap-1.5 rounded-full border border-[var(--ink)] bg-[var(--paper)] px-2.5 text-[var(--ink)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors text-xs font-gelica font-semibold"
            >
              <Download size={13} />
              <span className="hidden sm:inline">{t("journal.export")}</span>
            </button>
          )}

          {/* PIN Kilit Ayarı */}
          <button
            onClick={() => setIsPinModalOpen(true)}
            aria-label="günlük PIN ayarları"
            title={pin ? t("journal.pin_edit") : t("journal.pin_add")}
            className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 font-gelica text-xs font-semibold transition-colors ${
              pin
                ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                : "border-[var(--ink)] bg-[color-mix(in_srgb,var(--accent)_7%,var(--paper))] text-[var(--ink)] hover:bg-[color-mix(in_srgb,var(--accent)_13%,transparent)]"
            }`}
          >
            {pin ? (
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={11} width={18} height={11} rx={2} ry={2} /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            ) : (
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x={3} y={11} width={18} height={11} rx={2} ry={2} /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>
            )}
            <span className="hidden md:inline">{pin ? t("journal.lock_on") : t("journal.pin_add")}</span>
          </button>
        </div>
      </div>

      {/* 2. GEÇMİŞTEN BİR SAYFA (ANLIK STICKER KARTI) */}
      {pastMemory && activeTab === "write" && (
        <div className="paper-grain mt-4 rounded-[14px] border border-dashed border-[var(--ink)] bg-[color-mix(in_srgb,var(--accent)_9%,var(--paper))] p-3.5 flex items-start gap-3">
          <span className="p-1 rounded-full bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] shrink-0"><SketchHistoryClock size={16} strokeWidth={1.8} /></span>
          <div className="min-w-0 flex-1">
            <span className="font-handwritten text-xs font-bold text-[var(--accent)] block">
              geçmişten bir anı ({pastMemory.dateKey})
            </span>
            <p className="font-gelica text-xs italic text-[var(--ink)] truncate mt-0.5">
              "{pastMemory.content.slice(0, 120)}..."
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedDateKey(pastMemory.dateKey);
              setActiveTab("write");
            }}
            className="shrink-0 rounded-full border-[var(--ink)] px-2.5 py-1 font-gelica text-[10px] font-bold text-[var(--ink)] hover:bg-[var(--ink)] hover:text-white transition-colors"
          >
            o güne git
          </button>
        </div>
      )}

      {/* ============ TAB 1: YAZMA MODU ============ */}
      {activeTab === "write" && (
        <div className="mt-6 flex flex-col gap-5 max-w-3xl">
          {/* Ruh Hali Seçici (Bugün nasıl hissediyorsun?) */}
          <div className="paper-grain rounded-[16px] border border-[var(--ink)] bg-[color-mix(in_srgb,var(--accent)_7%,var(--paper))] p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2.5">
              <span className="font-gelica text-xs font-semibold lowercase text-[var(--ink)]">
                <span className="font-handwritten text-[var(--ink)] font-bold">{t("journal.mood_q")}</span>
              </span>
              {saveStatus === "saving" && (
                <span className="font-geist text-[10px] text-amber-600 animate-pulse">
                  {t("journal.saving")}
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="font-geist text-[10px] text-[var(--accent)] font-semibold">
                  {t("journal.saved")}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => {
                const isSelected = selectedMood === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleMoodSelect(m.id)}
                    aria-label={`${moodLabel(m.id)} ruh hali`}
                    className={`flex items-center gap-1.5 rounded-[20px] border-2 px-3 py-1.5 text-xs font-gelica transition-all ${
                      isSelected
                        ? "border-[var(--ink)] bg-[var(--accent)] text-white font-bold shadow-xs scale-105"
                        : "border-[var(--ink)] bg-[color-mix(in_srgb,var(--accent)_6%,var(--paper))] text-[var(--ink)] hover:bg-[color-mix(in_srgb,var(--accent)_14%,var(--paper))]"
                    }`}
                  >
                    <span className="shrink-0">{renderMoodSketchIcon(m.id, 14)}</span>
                    <span>{moodLabel(m.id)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* İsteğe Bağlı Yazma İstemi (Prompt) */}
          {showPrompt && activePrompt && (
            <div className="paper-grain relative rounded-[12px] border border-[var(--ink)] bg-[color-mix(in_srgb,var(--accent)_9%,var(--paper))] p-3 pe-8">
              <span className="font-handwritten text-[11px] font-bold text-[var(--accent)] block mb-0.5">
                <span className="inline-flex items-center gap-1.5"><SketchLightbulb size={13} className="text-amber-700 shrink-0" strokeWidth={1.8} /> {t("radar.stat.prompt")}:{promptSource && ( <span data-prompt-source={promptSource} className="rounded-full border-[var(--accent)] px-1.5 py-[1px] font-geist text-[9px] font-bold text-[var(--accent)]">{t(promptSource === "agenda" ? "aprompt.from_agenda" : promptSource === "alarm" ? "aprompt.from_alarm_badge" : "aprompt.from_note_badge")}</span>)}</span>
              </span>
              <p className="font-gelica text-xs italic text-[var(--ink)]">
                "{activePrompt}"
              </p>
              <button
                onClick={() => setShowPrompt(false)}
                aria-label="yazma istemini kapat"
                title={t("journal.hide_prompt")}
                className="absolute top-2.5 end-2 text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                <Close size={13} />
              </button>
            </div>
          )}

          {/* Gerçek Defter Yazma Alanı */}
          <div className="paper-grain card-superr journal-sheet p-6 sm:p-8 relative min-h-[340px] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-black/5 text-[var(--ink-soft)] font-geist text-xs">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDateKey}
                  onChange={(e) => setSelectedDateKey(e.target.value)}
                  className="font-mono text-xs bg-transparent border border-[var(--border-ink)] rounded px-2 py-0.5 text-[var(--ink)] outline-none"
                />
                {selectedDateKey === todayKey && (
                  <span className="font-handwritten text-[var(--accent)] font-bold text-xs">
                    {t("time.today_title")}
                  </span>
                )}
              </div>
              {/* v-pen: yazim modu secici - mevcut klavye akisini DEGISTIRMEZ. */}
              <div className="flex items-center gap-1 rounded-full border border-[var(--border-ink)] p-[2px]">
                <button
                  type="button"
                  onClick={() => setPenMode("keyboard")}
                  aria-label="klavye ile yaz"
                  aria-pressed={penMode === "keyboard"}
                  className={
                    "rounded-full px-2.5 py-[3px] font-geist text-[10px] font-semibold transition-colors " +
                    (penMode === "keyboard"
                      ? "bg-[var(--accent)] text-[var(--app-bg)]"
                      : "text-[var(--ink-soft)] hover:text-[var(--ink)]")
                  }
                >
                  {t("pen.mode_keyboard")}
                </button>
                <button
                  type="button"
                  data-pen-mode="1"
                  onClick={() => setPenMode("pen")}
                  aria-label="kalemle yaz"
                  aria-pressed={penMode === "pen"}
                  className={
                    "rounded-full px-2.5 py-[3px] font-geist text-[10px] font-semibold transition-colors " +
                    (penMode === "pen"
                      ? "bg-[var(--accent)] text-[var(--app-bg)]"
                      : "text-[var(--ink-soft)] hover:text-[var(--ink)]")
                  }
                >
                  {t("pen.mode_pen")}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsOcrModalOpen(true)}
                  aria-label="kameradan metin aktar"
                  className="font-handwritten text-xs font-bold text-[var(--accent)] hover:underline flex items-center gap-1.5"
                  title={t("journal.ocr_tip")}
                >
                  <SketchCamera size={13} strokeWidth={1.8} className="shrink-0" />
                  <span>{t("journal.ocr")}</span>
                </button>
                <button
                  type="button"
                  data-dictation="1"
                  data-dictation-supported={dictation.supported ? "1" : "0"}
                  disabled={!dictation.supported}
                  onClick={dictationToggle}
                  title={
                    !dictation.supported
                      ? t("dict.unsupported")
                      : dictation.listening
                        ? t("dict.stop_tip")
                        : t("dict.start_tip")
                  }
                  aria-pressed={dictation.listening}
                  aria-label={
                    !dictation.supported
                      ? t("dict.unsupported")
                      : dictation.listening
                        ? t("dict.stop")
                        : t("dict.start")
                  }
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-gelica text-[11px] font-bold transition ${
                    !dictation.supported
                      ? "cursor-not-allowed border-dashed border-[var(--ink-soft)] text-[var(--ink-soft)] opacity-60"
                      : dictation.listening
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--ink)] text-[var(--ink)] hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
                  }`}
                >
                  <SketchMic size={12} strokeWidth={1.8} className="shrink-0" />
                  <span>
                    {!dictation.supported
                      ? t("dict.start")
                      : dictation.listening
                        ? t("dict.listening")
                        : t("dict.start")}
                  </span>
                </button>
                <span className="font-mono text-[11px]">
                  {currentText.trim().split(/\s+/).filter(Boolean).length} {t("spread.words")}
                </span>
              </div>
            </div>

            {/* v-pen: klavye modunda MEVCUT textarea, kalem modunda canvas. */}
            {penMode === "keyboard" ? (
              <textarea
                value={currentText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder={t("journal.placeholder")}
                rows={12}
                data-jump-flash={jumpFlash ? "1" : "0"}
                className={
                  "notebook-ruled-lines mt-4 w-full flex-1 resize-none font-gelica text-[18px] sm:text-[20px] leading-[2.1rem] text-[var(--ink)] placeholder:text-[var(--ink-soft)] bg-transparent outline-none select-text transition-colors duration-500 " +
                  (jumpFlash ? "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]" : "")
                }
              />
            ) : (
              <div className="mt-4 flex flex-1 flex-col gap-2">
                <PenCanvas
                  value={penLayer}
                  onLayerChange={setPenLayer}
                  showGuide
                  className="flex-1"
                />
                {/* v-pen: basit duzeltme - geri al / temizle */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-pen-undo="1"
                    disabled={!penLayer || penLayer.strokes.length === 0}
                    onClick={() => {
                      setPenLayer((prev) => {
                        if (!prev || !prev.strokes.length) return prev;
                        const strokes = prev.strokes.slice(0, -1);
                        return { ...prev, strokes };
                      });
                    }}
                    className="rounded-full border border-[var(--ink)] px-3 py-[3px] font-geist text-[10px] font-semibold text-[var(--ink)] transition hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t("pen.undo")}
                  </button>
                  <button
                    type="button"
                    data-pen-clear="1"
                    disabled={!penLayer || penLayer.strokes.length === 0}
                    onClick={() => setPenLayer(null)}
                    className="rounded-full border border-[var(--ink)] px-3 py-[3px] font-geist text-[10px] font-semibold text-[var(--ink)] transition hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t("pen.clear")}
                  </button>
                  <span className="font-mono text-[10px] text-[var(--ink-soft)]">
                    {penLayer ? penLayer.strokes.length : 0} {t("pen.stroke_count")}
                  </span>
                  <span className="ml-auto font-geist text-[10px] text-[var(--ink-soft)]">
                    {t("pen.attach_note")}
                  </span>
                </div>
              </div>
            )}

            {/* Ara metin artık doğrudan yazı alanına akıyor (aşağıdaki textarea). */}

            {/* Sesli dikte hatası — sessizce yutulmasın, kullanıcı sebebi görsün */}
            {dictation.error && (
              <div
                role="alert"
                data-dictation-error={dictation.error}
                className="mt-2 flex items-start gap-2 rounded-[10px] border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-3 py-2"
              >
                <span className="font-gelica text-[13px] leading-relaxed text-[var(--ink)]">
                  {t(`dict.err.${dictation.error}`)}
                </span>
                <button
                  type="button"
                  onClick={() => dictation.clearError()}
                  aria-label={t("common.close")}
                  className="ml-auto shrink-0 rounded-[6px] px-1 font-mono text-[12px] text-[var(--ink-soft)] transition hover:bg-black/5 hover:text-[var(--ink)]"
                >
                  ×
                </button>
              </div>
            )}


            {/* Kullanıcının kendi elinden çıkan imza örneği — gerçek el yazısı hissi */}
            {signatureImage && (
              <div className="pointer-events-none mt-1 flex justify-end pe-1">
                <span className="font-handwritten text-[10px] text-[var(--ink-soft)] italic me-2 self-end pb-1 opacity-80">
                  {t("hws.signature")}
                </span>
                <img
                  src={signatureImage}
                  alt={t("journal.signature_alt")}
                  className="signature-ink h-9 w-auto max-w-[140px] object-contain opacity-75 mix-blend-multiply"
                />
              </div>
            )}
            {/* Çapraz bağlantı: seçili gün ajanda kayıtları */}
            {dayAgendaEvents.length > 0 && (
              <div
                data-journal-agenda="1"
                className="mt-4 rounded-[12px] border-[1.5px] border-[var(--ink)] bg-[color-mix(in_srgb,var(--ink)_4%,var(--paper))] px-3.5 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-gelica text-[11px] font-bold lowercase text-[var(--ink)]">
                    {t("link.journal_agenda")}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--accent)]">
                    {t("link.journal_agenda_count").replace("{n}", String(dayAgendaEvents.length))}
                  </span>
                </div>
                <ul className="mt-1.5 space-y-0.5">
                  {dayAgendaEvents.slice(0, 4).map((ev) => (
                    <li key={ev.id} className="flex items-baseline gap-2 font-geist text-[11px] text-[var(--ink-soft)]">
                      <span className="shrink-0 font-mono text-[10px] text-[var(--ink)]">{ev.timeStr}</span>
                      <span className="truncate">{ev.title}</span>
                      {ev.hasAlarm && <span className="shrink-0 text-[var(--accent)]">•</span>}
                    </li>
                  ))}
                  {dayAgendaEvents.length > 4 && (
                    <li className="font-mono text-[10px] text-[var(--ink-soft)] opacity-70">
                      +{dayAgendaEvents.length - 4}
                    </li>
                  )}
                </ul>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between pt-3 border-t border-black/5">
              <button
                onClick={handleAddNewSession}
                aria-label="yeni günlük notu ekle"
                className="font-handwritten text-xs text-[var(--accent)] font-bold hover:underline"
              >
                {t("journal.add_note")}
              </button>

              <button
                onClick={() => saveCurrentEntry(currentText, selectedMood, penLayer)}
                aria-label="günlüğü kaydet"
                className="rounded-[20px] bg-[var(--ink)] text-[var(--app-bg)] px-4 py-1.5 font-gelica text-xs font-semibold shadow-xs hover:bg-[var(--accent)] transition-colors"
              >
                {t("act.save_now")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ TAB 2: AKIŞ VE ZAMAN ÇİZELGESİ ============ */}
      {activeTab === "timeline" && (
        <div className="mt-6 max-w-3xl space-y-4">
          {/* Arama Kutusu */}
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1">
            <Search size={14} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("journal.search_ph")}
              className="w-full rounded-[20px] border border-[var(--ink)] bg-[var(--paper)] py-2.5 ps-9 pe-12 font-geist text-xs text-[var(--ink)] placeholder:text-[var(--ink-soft)] outline-none focus:border-[var(--accent)]"
            />
            </div>
            <button
              data-spread-open="1"
              onClick={() => { playPopSound(); setSpreadOpen(true); }}
              title={t("spread.open_tip")}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-[20px] border-[var(--ink)] bg-[var(--paper)] px-3.5 py-2.5 font-gelica text-xs font-bold text-[var(--ink)] transition hover:bg-[var(--ink)] hover:text-white"
            >
              <SketchOpenBook size={14} strokeWidth={1.8} />
              {t("spread.open")}
            </button>
          </div>

          {filteredTimeline.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-[color-mix(in_srgb,var(--border-ink)_25%,transparent)] bg-[var(--paper)] p-10 text-center">
              <span className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]"><SketchOpenBook size={20} strokeWidth={1.8} /></span>
              <h4 className="font-gelica text-base font-bold text-[var(--ink)]">
                {searchQuery ? t("journal.empty_search") : t("journal.empty")}
              </h4>
              <p className="font-geist text-xs text-[var(--ink-soft)] max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
                bugün aklından ne geçiyor? istersen küçük bir şey yaz, kimse okumayacak, bu senin sayfan.
              </p>
              <button
                onClick={() => setActiveTab("write")}
                aria-label="yazmaya geç"
                className="rounded-[20px] bg-[var(--accent)] px-4 py-2 font-gelica text-xs font-bold text-white shadow-sm hover:opacity-95"
              >
                ilk sayfanı yaz
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTimeline.map((item) => {
                const moodObj = MOODS.find((m) => m.id === item.mood);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card-superr p-5 sm:p-6 transition-all hover:-translate-y-0.5"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-black/5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--ink)]">
                          {item.dateKey} · {item.timeStr}
                        </span>
                        {moodObj && (
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-gelica ${moodObj.color}`}>
                            <span className="shrink-0">{renderMoodSketchIcon(moodObj.id, 13)}</span>
                            <span>{moodLabel(moodObj.id)}</span>
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedDateKey(item.dateKey);
                          setCurrentEntryId(item.id);
                          setActiveTab("write");
                        }}
                        className="font-gelica text-xs font-semibold text-[var(--accent)] hover:underline"
                      >
                        düzenle
                      </button>
                    </div>

                    <p className="mt-3 font-gelica text-base sm:text-lg leading-relaxed text-[var(--ink)] whitespace-pre-wrap">
                      {item.content}
                    </p>


                    {/* v-pen: kayitli el yazisi cizimi (vektorden yeniden cizilir). */}
                    {item.pen && item.pen.strokes?.length > 0 && (
                      <div className="mt-3 h-[130px] w-full overflow-hidden rounded-[10px] border border-[color-mix(in_srgb,var(--ink)_14%,transparent)] bg-[color-mix(in_srgb,var(--paper)_92%,transparent)]">
                        <PenCanvas value={item.pen} onLayerChange={() => {}} showGuide={false} readOnly />
                      </div>
                    )}
                    {item.promptUsed && (
                      <span className="mt-3 block font-handwritten text-[11px] text-[var(--ink-soft)]">
                        ilham: "{item.promptUsed}"
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============ TAB 3: DUYGU PUSULASI & TAKVİM RADAR GÖRÜNÜMÜ ============ */}
      {activeTab === "calendar" && (
        <JournalMoodRadar
          entries={entries}
          onSelectDate={(dateKey) => {
            setSelectedDateKey(dateKey);
            setActiveTab("write");
            // Kısa süreli vurgu: kullanıcı bir güne atlandığını hissetsin
            setJumpFlash(true);
          }}
          onNewEntry={() => {
            handleAddNewSession();
            setActiveTab("write");
          }}
        />
      )}

      {/* ============ PIN KİLİT AYARLAMA MODALI ============ */}
      <AnimatePresence>
        {isPinModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 select-none"
            onClick={() => setIsPinModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="w-full max-w-sm rounded-[16px] border-2 border-[var(--ink)] bg-[var(--paper)] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h4 className="font-gelica text-base font-bold text-[var(--ink)]">
                  günlük mahremiyet kilidi
                </h4>
                <button
                  onClick={() => setIsPinModalOpen(false)}
                  className="rounded-full p-1 text-[var(--ink-soft)] hover:text-[var(--ink)]"
                >
                  <Close size={15} />
                </button>
              </div>

              <p className="font-geist text-xs text-[var(--ink-soft)] mb-4 leading-relaxed">
                4 haneli bir PIN belirleyerek günlüğünü meraklı gözlerden koru. Boş bırakıp kaydedersen kilit kaldırılır.
              </p>

              <input
                type="password"
                maxLength={4}
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value)}
                placeholder={pin ? t("journal.new_pin") : "4 haneli PIN"}
                className="w-full text-center tracking-[0.4em] font-mono text-xl py-2 mb-4 rounded-[12px] border-2 border-[var(--ink)] bg-[var(--app-bg)] outline-none focus:border-[var(--accent)]"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setIsPinModalOpen(false)}
                  className="flex-1 rounded-[20px] border border-[var(--ink)] py-2 font-gelica text-xs font-semibold"
                >
                  iptal
                </button>
                <button
                  onClick={handleSavePin}
                  className="flex-1 rounded-[20px] bg-[var(--accent)] py-2 font-gelica text-xs font-bold text-white shadow-sm"
                >
                  kaydet
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    
      <JournalExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        entries={entries}
      />

      <JournalOcrImportModal
        isOpen={isOcrModalOpen}
        onClose={() => setIsOcrModalOpen(false)}
        onImportText={(text) => {
          const combined = currentText.trim()
            ? currentText.trim() + "\n\n" + text
            : text;
          handleTextChange(combined);
          if (onAwardXp) onAwardXp(10);
        }}
      />
      {/* Defter Çift Sayfa (Book Spread) Okuma Modu */}
      {spreadOpen && (
        <JournalSpread
          entries={entries}
          onClose={() => setSpreadOpen(false)}
          onSaveEntry={handleSpreadSave}
          onCreateEntry={handleSpreadCreate}
          onEdit={(entry) => {
            setSelectedDateKey(entry.dateKey);
            setCurrentEntryId(entry.id);
            setActiveTab("write");
            setSpreadOpen(false);
          }}
          moodLabel={moodLabel}
          renderMoodIcon={renderMoodSketchIcon}
        />
      )}

    </div>
  );
}
