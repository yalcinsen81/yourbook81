/**
 * yourbook "Sıcak Defter" Kişiselleştirme ve Cilt Sistemi
 */

export type PaperTextureType = "plain" | "ruled" | "dotted" | "kraft";
export type HandwritingStyleType = "kalam" | "architect" | "marck" | "custom";
export type InkStampType = "approved" | "archive" | "withlove" | "none";

export interface CustomHandwritingConfig {
  createdAt: number;
  previewImage?: string;
  slant: number;
  weight: number;
  letterSpacing: number;
  baseFont: 'kalam' | 'architect' | 'marck';
  label: string;
  sourceType: 'photo' | 'draw' | 'hybrid';
  analysis: {
    strokeDensity: number;
    detectedSlant: number;
    inkContrast: number;
    naturalJitter: number;
  };
}
export interface ArchivedVolume {
  volume: number;
  completedAt: number;
  wordsLearned: number;
  daysActive: number;
  stickersUnlocked: number;
  journalCount: number;
  note?: string;
}

export interface MilestoneSticker {
  id: string;
  emoji: string;
  title: string;
  description: string;
  titleKey?: string;
  descKey?: string;
  unlocked: boolean;
  rotation: number; // Doğal elle yapıştırılmış açı (-8 ile +8 arası)
  color: string;
  badgeBg: string;
  current?: number;
  target?: number;
}

export const PAPER_TEXTURES: {
  id: PaperTextureType;
  name: string;
  nameKey: string;
  description: string;
  descKey: string;
  previewClass: string;
}[] = [
  {
    id: "plain",
    nameKey: "paper.plain.name",
    descKey: "paper.plain.desc",
    name: "Düz Kağıt",
    description: "Sakin, doğal krem kağıt dokusu",
    previewClass: "texture-plain",
  },
  {
    id: "ruled",
    nameKey: "paper.ruled.name",
    descKey: "paper.ruled.desc",
    name: "Çizgili Defter",
    description: "Klasik okul defteri satırları",
    previewClass: "texture-ruled",
  },
  {
    id: "dotted",
    nameKey: "paper.dotted.name",
    descKey: "paper.dotted.desc",
    name: "Noktalı (Bullet)",
    description: "Bullet journal noktalı ızgarası",
    previewClass: "texture-dotted",
  },
  {
    id: "kraft",
    nameKey: "paper.kraft.name",
    descKey: "paper.kraft.desc",
    name: "Kraft Kağıt",
    description: "Geri dönüştürülmüş organik lifli doku",
    previewClass: "texture-kraft",
  },
];

export const HANDWRITING_STYLES: {
  id: HandwritingStyleType;
  name: string;
  nameKey: string;
  sample: string;
  sampleKey: string;
  description: string;
  descKey: string;
  fontFamily: string;
}[] = [
  {
    id: "kalam",
    nameKey: "font.kalam.name",
    sampleKey: "font.kalam.sample",
    descKey: "font.kalam.desc",
    name: "Akıcı & Hızlı",
    sample: "Hızlı notlar, fikirler ve yeni kelimeler!",
    description: "Dinamik, canlı dolmakalem notları",
    fontFamily: '"Kalam", "Comic Sans MS", cursive',
  },
  {
    id: "architect",
    nameKey: "font.architect.name",
    sampleKey: "font.architect.sample",
    descKey: "font.architect.desc",
    name: "Titiz & Mimari",
    sample: "DÜZENLİ PLANLAR, HEDEFLER & ÇALIŞMA",
    description: "Temiz, net ve yapısal mimar el yazısı",
    fontFamily: '"Architects Daughter", "Segoe Print", cursive',
  },
  {
    id: "marck",
    nameKey: "font.marck.name",
    sampleKey: "font.marck.sample",
    descKey: "font.marck.desc",
    name: "Klasik Dolmakalem",
    sample: "Zamanın içinden süzülen zarif satırlar...",
    description: "Eski anı defteri havasında zarif hatlar",
    fontFamily: '"Marck Script", "Caveat", cursive',
  },
  {
    id: "custom",
    nameKey: "font.custom.name",
    sampleKey: "font.custom.sample",
    descKey: "font.custom.desc",
    name: "Benim El Yazım",
    sample: "Kendi defterimden kalibre edilmiş özel el yazısı...",
    description: "Fotoğraftan veya çizimden analiz edilmiş kişisel karakter",
    fontFamily: 'var(--custom-handwriting-family, "Caveat", "Segoe Script", cursive)',
  },
];

export const INK_STAMPS: {
  id: InkStampType;
  title: string;
  titleKey: string;
  subtitle: string;
  subtitleKey: string;
  color: string;
}[] = [
  {
    id: "approved",
    title: "ONAYLANDI",
    titleKey: "stamp.approved.title",
    subtitle: "YOURBOOK DEFTERİ",
    subtitleKey: "stamp.approved.subtitle",
    color: "border-[var(--accent)] text-[var(--accent)]",
  },
  {
    id: "archive",
    title: "CİLT ARŞİVİ",
    titleKey: "stamp.archive.title",
    subtitle: "2026 BASKISI",
    subtitleKey: "stamp.archive.subtitle",
    color: "border-emerald-600 text-emerald-700",
  },
  {
    id: "withlove",
    title: "SEVGİYLE ÇALIŞILDI",
    titleKey: "stamp.withlove.title",
    subtitle: "ÇALIŞKAN İNSAN",
    subtitleKey: "stamp.withlove.subtitle",
    color: "border-purple-600 text-purple-700",
  },
  {
    id: "none",
    title: "Damgasız",
    titleKey: "stamp.none.title",
    subtitle: "Sade görünüm",
    subtitleKey: "stamp.none.subtitle",
    color: "border-gray-400 text-gray-400",
  },
];

// --- STORAGE KEYS ---
export const STORAGE_KEY_PAPER = "yourbook_paper_texture_v1";
export const STORAGE_KEY_FONT = "yourbook_handwriting_font_v1";
export const STORAGE_KEY_CUSTOM_HANDWRITING = "yourbook_custom_handwriting_v1";
export const STORAGE_KEY_STAMP = "yourbook_ink_stamp_v1";
export const STORAGE_KEY_VOLUME = "yourbook_notebook_volume_v1";
export const STORAGE_KEY_ARCHIVES = "yourbook_volumes_archive_v1";
export const STORAGE_KEY_TIME_LIGHT = "yourbook_time_lighting_enabled_v1";
export const STORAGE_KEY_RITUAL_WINDOW = "yourbook_ritual_window_v1";
export const STORAGE_KEY_GIFTED = "yourbook_gifted_notebook_v1";
export type TimeLightingPeriod = "morning" | "day" | "afternoon" | "night";
export type TimePeriod = TimeLightingPeriod;

// --- DEĞERLERİ OKUMA / YAZMA ---
export function getSavedPaperTexture(): PaperTextureType {
  try {
    const val = localStorage.getItem(STORAGE_KEY_PAPER);
    if (val === "plain" || val === "ruled" || val === "dotted" || val === "kraft") return val;
  } catch {}
  return "plain";
}

export function getSavedHandwriting(): HandwritingStyleType {
  try {
    const val = localStorage.getItem(STORAGE_KEY_FONT);
    if (val === "kalam" || val === "architect" || val === "marck" || val === "custom") return val;
  } catch {}
  // Varsayılan (kayıtlı tercih yoksa): "Titiz & Mimari" (Architects Daughter)
  return "architect";
}

export function getSavedCustomHandwriting(): CustomHandwritingConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_HANDWRITING);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function saveCustomHandwriting(config: CustomHandwritingConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_HANDWRITING, JSON.stringify(config));
  } catch {}
}

export function applyCustomHandwritingVars(config?: CustomHandwritingConfig | null): void {
  if (typeof document === 'undefined') return;
  const cfg = config || getSavedCustomHandwriting();
  const root = document.documentElement;
  if (!cfg) {
    root.style.removeProperty('--custom-handwriting-family');
    root.style.removeProperty('--custom-handwriting-slant');
    root.style.removeProperty('--custom-handwriting-weight');
    root.style.removeProperty('--custom-handwriting-tracking');
    return;
  }
  const baseMap: Record<string, string> = {
    kalam: '"Kalam", "Comic Sans MS", cursive',
    architect: '"Architects Daughter", "Segoe Print", cursive',
    marck: '"Marck Script", "Caveat", cursive',
  };
  const family = baseMap[cfg.baseFont] || baseMap.kalam;
  root.style.setProperty('--custom-handwriting-family', family);
  root.style.setProperty('--custom-handwriting-slant', cfg.slant + 'deg');
  root.style.setProperty('--custom-handwriting-weight', String(cfg.weight));
  root.style.setProperty('--custom-handwriting-tracking', cfg.letterSpacing + 'px');
}

export function getSavedInkStamp(): InkStampType {
  try {
    const val = localStorage.getItem(STORAGE_KEY_STAMP);
    if (val === "approved" || val === "archive" || val === "withlove" || val === "none") return val;
  } catch {}
  return "approved";
}

export function getCurrentVolume(): number {
  try {
    const val = localStorage.getItem(STORAGE_KEY_VOLUME);
    if (val) {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num >= 1) return num;
    }
  } catch {}
  return 1;
}


export function advanceToNextVolume(wordsLearned = 0, journalCount = 0): number {
  const current = getCurrentVolume();
  const next = current + 1;
  const archives = getArchivedVolumes();
  const milestones = evaluateMilestones();
  const unlocked = milestones.filter((m: any) => m.unlocked).length;

  const newArchive: ArchivedVolume = {
    volume: current,
    completedAt: Date.now(),
    wordsLearned,
    daysActive: Math.max(1, unlocked * 2),
    stickersUnlocked: unlocked,
    journalCount,
    note: `Cilt 0${current} başarıyla tamamlandı.`,
  };

  try {
    localStorage.setItem(STORAGE_KEY_VOLUME, String(next));
    localStorage.setItem(STORAGE_KEY_ARCHIVES, JSON.stringify([...archives, newArchive]));
  } catch {}

  return next;
}

export function getArchivedVolumes(): ArchivedVolume[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ARCHIVES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/**
 * 8 Anlamlı Kilometre Taşı Rozetini Değerlendirir
 */
function badgeProgress(id: string, masteredCount: number, streakCount: number, langCount: number, level: number): { current: number; target: number } {
  if (id === "word_hunter") return { current: masteredCount, target: 100 };
  if (id === "streak_rhythm") return { current: streakCount, target: 7 };
  if (id === "level_up") return { current: masteredCount, target: 100 };
  if (id === "dual_language") return { current: langCount, target: 3 };
  return { current: Math.min(masteredCount, 1), target: 1 };
}

export function evaluateMilestones(): MilestoneSticker[] {
  let hasJournal = false;
  let streakCount = 0;
  let level = 1;
  let masteredCount = 0;
  let hasPlayedGame = false;
  let hasAgenda = false;
  let hasDualLang = false;
  let isCustomized = false;

  try {
    // 1. Günlük
    const rawJ = localStorage.getItem("yourbook_journal_entries_v1");
    if (rawJ) {
      const pj = JSON.parse(rawJ);
      if (Array.isArray(pj) && pj.length > 0) hasJournal = true;
    }

    // 2. Engagement (Streak, Level, Bonus XP)
    const rawEng = localStorage.getItem("lexi_engagement_v1");
    if (rawEng) {
      const pe = JSON.parse(rawEng);
      streakCount = pe.streak || 0;
      level = Math.floor((pe.xp || 0) / 500) + 1;
      if (pe.bonusXpToday && pe.bonusXpToday > 0) hasPlayedGame = true;
    }

    // 3. Deck
    const rawDeck = localStorage.getItem("yourbook_deck_v7_clean");
    if (rawDeck) {
      const pd = JSON.parse(rawDeck);
      if (Array.isArray(pd)) {
        masteredCount = pd.filter((c: any) => c.learnedAt || (c.reviewCount && c.reviewCount >= 1)).length;
        // v97: Rozet = KULLANILAN kartlarin farkli DIL sayisi >= 2 VEYA farkli masa sayisi >= 2.
        //     Boylece spaceId olmasa bile `lang` uzerinden acilir.
        const used = pd.filter((c: any) => c && (c.learnedAt || (c.reviewCount && c.reviewCount >= 1)));
        const langSet = new Set(
          used
            .map((c: any) => (typeof c.lang === "string" ? c.lang.toUpperCase() : ""))
            .filter((x: string) => x.length > 0)
        );
        const spaceSet = new Set(
          used
            .map((c: any) => c.spaceId)
            .filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
        );
        hasDualLang = langSet.size >= 2 || spaceSet.size >= 2;
      }
    }

    // 4. Agenda
    const rawAgenda = localStorage.getItem("superr_agenda_events_v4");
    if (rawAgenda) {
      const pa = JSON.parse(rawAgenda);
      if (Array.isArray(pa) && pa.length > 0) hasAgenda = true;
    }

    // 5. Özelleştirme yapıldı mı
    const paper = localStorage.getItem(STORAGE_KEY_PAPER);
    const font = localStorage.getItem(STORAGE_KEY_FONT);
    if ((paper && paper !== "plain") || (font && font !== "architect")) {
      isCustomized = true;
    }
  } catch {}

  return [
    {
      id: "first_journal",
      emoji: "",
      title: "İlk Sayfa",
      description: "İlk kişisel günlük kaydını yazdın",
      unlocked: hasJournal,
      rotation: -5,
      color: "text-amber-700",
      badgeBg: "bg-amber-100 border-amber-300",
    },
    {
      id: "streak_rhythm",
      emoji: "",
      title: "Ritim",
      description: "Çalışma serisi yakaladın",
      unlocked: streakCount >= 1,
      rotation: 6,
      color: "text-orange-700",
      badgeBg: "bg-orange-100 border-orange-300",
    },
    {
      id: "word_master",
      emoji: "",
      title: "Kelime Ustası",
      description: "Masanızdaki kelimeleri başarıyla öğrendin",
      unlocked: masteredCount >= 3,
      rotation: -4,
      color: "text-emerald-700",
      badgeBg: "bg-emerald-100 border-emerald-300",
    },
    {
      id: "word_hunter",
      emoji: "",
      title: "Kelime Avcısı",
      description: "Kelime Avı mini oyununu tamamladın",
      unlocked: hasPlayedGame,
      rotation: 7,
      color: "text-rose-700",
      badgeBg: "bg-rose-100 border-rose-300",
    },
    {
      id: "level_up",
      emoji: "⭐",
      title: "Seviye 2+",
      description: "Çalışma hedeflerini tamamlayarak seviye atladın",
      unlocked: level >= 2,
      rotation: -6,
      color: "text-yellow-700",
      badgeBg: "bg-yellow-100 border-yellow-300",
    },
    {
      id: "agenda_planner",
      emoji: "",
      title: "Zaman Ustası",
      description: "Takvim ve ajandaya saatlik plan kaydettin",
      unlocked: hasAgenda,
      rotation: 4,
      color: "text-blue-700",
      badgeBg: "bg-blue-100 border-blue-300",
    },
    {
      id: "dual_language",
      emoji: "",
      title: "Çok Dilli", titleKey: "badge.dual_language.title",
      description: "En az iki çalışma masasını birlikte kullandın", descKey: "badge.dual_language.desc",
      unlocked: hasDualLang,
      rotation: -3,
      color: "text-teal-700",
      badgeBg: "bg-teal-100 border-teal-300",
    },
    {
      id: "custom_notebook",
      emoji: "",
      title: "Özgün Defter",
      description: "Defterinin kağıt veya el yazısı stilini kişiselleştirdin",
      unlocked: isCustomized,
      rotation: 5,
      color: "text-purple-700",
      badgeBg: "bg-purple-100 border-purple-300",
    },
    {
      id: "gift_notebook",
      emoji: "",
      title: "Hediye Defter",
      description: "Bir dostuna boş bir defter hediye ettin",
      unlocked: hasGiftedNotebook(),
      rotation: -7,
      color: "text-pink-700",
      badgeBg: "bg-pink-100 border-pink-300",
    },  ];
}

// --- 1. ZAMANA DUYARLI IŞIK SİSTEMİ ---
export function isTimeLightingEnabled(): boolean {
  try {
    const val = localStorage.getItem(STORAGE_KEY_TIME_LIGHT);
    if (val !== null) return val === "true";
  } catch {}
  return true;
}

export function setTimeLightingEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY_TIME_LIGHT, String(enabled));
  } catch {}
}

export function getCurrentTimePeriod(): TimeLightingPeriod {
  if (typeof window === "undefined") return "day";
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 10) return "morning";
  if (hour >= 10 && hour < 14) return "day";
  if (hour >= 14 && hour < 18) return "afternoon";
  return "night";
}

export const TIME_PERIOD_META: Record<
  TimeLightingPeriod,
  { labelKey: string; icon: string; descriptionKey: string; overlayStyle: string }
> = {
  morning: {
    labelKey: "ritual.period.morning",
    icon: "",
    descriptionKey: "ritual.desc.morning",
    overlayStyle: "linear-gradient(135deg, rgba(210, 230, 255, 0.045) 0%, transparent 60%)",
  },
  day: {
    labelKey: "ritual.period.day",
    icon: "",
    descriptionKey: "ritual.desc.day",
    overlayStyle: "transparent",
  },
  afternoon: {
    labelKey: "ritual.period.afternoon",
    icon: "",
    descriptionKey: "ritual.desc.afternoon",
    overlayStyle: "linear-gradient(135deg, rgba(255, 170, 70, 0.065) 0%, rgba(245, 130, 30, 0.035) 100%)",
  },
  night: {
    labelKey: "ritual.period.night",
    icon: "",
    descriptionKey: "ritual.desc.night",
    overlayStyle: "linear-gradient(180deg, rgba(20, 15, 30, 0.05) 0%, rgba(230, 160, 80, 0.035) 100%)",
  },
};

// --- 2. KİŞİSEL AÇILIŞ RİTÜELİ ---
export function getRitualPreference(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_RITUAL_WINDOW) || "auto";
  } catch {}
  return "auto";
}

export function setRitualPreference(pref: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_RITUAL_WINDOW, pref);
  } catch {}
}

const GREETINGS_MORNING = [
  "greet.morning.1",
  "greet.morning.2",
  "greet.morning.3",
  "greet.morning.4",
];

const GREETINGS_AFTERNOON = [
  "greet.afternoon.1",
  "greet.afternoon.2",
  "greet.afternoon.3",
  "greet.afternoon.4",
];

const GREETINGS_NIGHT = [
  "greet.night.1",
  "greet.night.2",
  "greet.night.3",
  "greet.night.4",
];

export function getOpeningRitualGreeting(): { icon: string; textKey: string; period: TimeLightingPeriod } {
  const period = getCurrentTimePeriod();
  let list = GREETINGS_AFTERNOON;
  let icon = "";
  if (period === "morning") {
    list = GREETINGS_MORNING;
    icon = "";
  } else if (period === "night") {
    list = GREETINGS_NIGHT;
    icon = "";
  }
  const idx = Math.floor(Math.random() * list.length);
  return { icon, textKey: list[idx], period };
}

// --- 3. DEFTER HEDİYE ET ---
export function hasGiftedNotebook(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_GIFTED) === "true";
  } catch {}
  return false;
}

/**
 * Defterin fiziksel "yaşlanma" kademesi (0-3).
 * Tamamen görsel bir katman içindir; kullanıcıya gösterilen bir başarı mekaniği DEĞİLDİR.
 * Kademe; çalışma serisi (streak), öğrenilen kart sayısı ve defterin cilt yaşına göre sessizce artar.
 *
 *  0 = yeni       (0-7 gün)
 *  1 = gelişen    (8-30 gün)
 *  2 = yerleşik   (31-90 gün)
 *  3 = eski dost  (90+ gün)
 */
export function getNotebookAgeTier(): 0 | 1 | 2 | 3 {
  let streak = 0;
  let mastered = 0;
  let volume = 1;

  try {
    const rawEng = localStorage.getItem("lexi_engagement_v1");
    if (rawEng) {
      const pe = JSON.parse(rawEng);
      streak = pe.streak || 0;
    }
  } catch {}

  try {
    const rawDeck = localStorage.getItem("yourbook_deck_v7_clean");
    if (rawDeck) {
      const pd = JSON.parse(rawDeck);
      if (Array.isArray(pd)) {
        mastered = pd.filter((c: any) => c.learnedAt || (c.reviewCount && c.reviewCount >= 1)).length;
      }
    }
  } catch {}

  try {
    volume = getCurrentVolume();
  } catch {}

  // Seri + öğrenilen kelime + cilt sayısını tek bir "olgunluk puanına" indir.
  // Örn: 40 gün seri VEYA 120 öğrenilen kelime VEYA 3. cilt ≈ yerleşik/olgun defter.
  const score = streak + Math.floor(mastered / 3) + (volume - 1) * 15;

  if (score >= 90) return 3;
  if (score >= 31) return 2;
  if (score >= 8) return 1;
  return 0;
}
/** Cilt doluluk değerlendirmesi — otomatik geçiş kararı için. */
export interface VolumeFill {
  /** Açılmış rozet sayısı (0..9). */
  badges: number;
  /** Toplam rozet sayısı. */
  totalBadges: number;
  /** Günlük girdisi sayısı. */
  journalCount: number;
  /** Öğrenilmiş kelime sayısı. */
  wordsLearned: number;
  /** 0..1 arası genel doluluk (rozet + içerik karışımı). */
  ratio: number;
  /** Cilt "dolu" sayılır mı? (9/9 rozet VEYA yüksek içerik) */
  isFull: boolean;
  /** Doluluğu tetikleyen neden anahtarları (i18n: volume.reason.*). */
  reasons: string[];
}

/** Rozet kapasitesi (CoverStickerCluster ile aynı: 9). */
export const TOTAL_BADGES = 9;

/** Cilt istatistiklerini okur ve doluluk oranını hesaplar. */
export function evaluateVolumeFill(): VolumeFill {
  let journalCount = 0;
  let wordsLearned = 0;

  try {
    const rawJ = localStorage.getItem("yourbook_journal_entries_v1");
    if (rawJ) journalCount = (JSON.parse(rawJ) || []).length || 0;
  } catch {}

  try {
    const rawD = localStorage.getItem("yourbook_deck_v7_clean");
    if (rawD) wordsLearned = (JSON.parse(rawD) || []).filter((c: { learnedAt?: number }) => c.learnedAt).length || 0;
  } catch {}

  const badges = evaluateMilestones().filter((m) => m.unlocked).length;
  const totalBadges = TOTAL_BADGES;

  // Karışım: rozetler %60, günlük %25, kelime %15
  const badgePart = totalBadges > 0 ? badges / totalBadges : 0;
  const journalPart = Math.min(1, journalCount / 30);
  const wordPart = Math.min(1, wordsLearned / 60);
  const ratio = Math.round((badgePart * 0.6 + journalPart * 0.25 + wordPart * 0.15) * 100) / 100;

  const reasons: string[] = [];
  if (badges >= totalBadges) reasons.push("all_badges");
  if (journalCount >= 30) reasons.push("many_journals");
  if (wordsLearned >= 60) reasons.push("many_words");

  // Tam dolu: tüm rozetler VEYA (çok içerik + en az 7 rozet)
  const isFull = badges >= totalBadges || (ratio >= 0.85 && badges >= totalBadges - 2);

  return { badges, totalBadges, journalCount, wordsLearned, ratio, isFull, reasons };
}

/** Otomatik cilt geçişi tercihi. */
export const VOLUME_AUTOSWITCH_KEY = "yourbook_volume_autoswitch_v1";

export function isVolumeAutoswitchEnabled(): boolean {
  try {
    return localStorage.getItem(VOLUME_AUTOSWITCH_KEY) === "1";
  } catch {
    return false;
  }
}

export function setVolumeAutoswitchEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(VOLUME_AUTOSWITCH_KEY, enabled ? "1" : "0");
  } catch {}
}

/**
 * Otomatik geçiş için "karar" durumunu döner.
 * - "off": tercih kapalı
 * - "idle": cilt henüz dolu değil
 * - "prompt": otomatik geçiş açık ama kullanıcı onayı görülmedi (rozet kutlaması)
 */
export function getVolumeAutoswitchState(): "off" | "idle" | "prompt" {
  if (!isVolumeAutoswitchEnabled()) return "off";
  const fill = evaluateVolumeFill();
  return fill.isFull ? "prompt" : "idle";
}
