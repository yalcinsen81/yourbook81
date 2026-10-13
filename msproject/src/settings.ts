import { detectLang, setLocale, type DateStyle, type Lang } from "./i18n";

// Uygulama ayarları (bu bilgisayara özgü): dil, tarih biçimi, projeye göre Gantt görünümü, yükseltme yedekleri.
// Proje dosyasına yazılmaz; böylece aynı dosyayı açan iki kişi kendi dilinde görür.

const KEY = "msproject.settings";

export interface GanttView {
  /** Piksel / gün */
  ppd: number;
  /** Görünümün sol kenarındaki tarih (yakınlaştırma değişse de aynı yer açılır) */
  date: string;
  scrollTop: number;
}

export interface UpgradeBackup {
  name: string;
  /** Yedeğin alındığı an (ISO) */
  at: string;
  /** Dosyanın yükseltilmeden önceki metni */
  text: string;
}

export interface AppSettings {
  lang?: Lang;
  dateStyle?: DateStyle;
  views?: Record<string, GanttView>;
  backups?: UpgradeBackup[];
}

const MAX_BACKUPS = 3;
const MAX_VIEWS = 30;

export function loadSettings(): AppSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return raw && typeof raw === "object" ? (raw as AppSettings) : {};
  } catch {
    return {};
  }
}

function save(next: AppSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Depolama dolu ya da kapalı: ayar bu oturumla sınırlı kalır
  }
}

export function updateSettings(patch: (s: AppSettings) => AppSettings): AppSettings {
  const next = patch(loadSettings());
  save(next);
  return next;
}

/** Açılışta kayıtlı dil ve tarih biçimini uygular; kayıt yoksa işletim sistemi dili */
export function applySavedLocale(): void {
  const s = loadSettings();
  setLocale({ lang: s.lang === "tr" || s.lang === "en" ? s.lang : detectLang(), dateStyle: s.dateStyle === "iso" ? "iso" : "locale" });
}

export function saveLocale(lang: Lang, dateStyle: DateStyle): void {
  setLocale({ lang, dateStyle });
  updateSettings((s) => ({ ...s, lang, dateStyle }));
}

/** Projeyi ayırt eden anahtar (ad + başlangıç) */
export function viewKey(name: string, start: string): string {
  return `${name}|${start}`;
}

export function loadView(key: string): GanttView | undefined {
  return loadSettings().views?.[key];
}

export function saveView(key: string, view: GanttView): void {
  updateSettings((s) => {
    const views = { ...(s.views ?? {}) };
    delete views[key];
    views[key] = view;
    // En eski kayıtlar silinir
    const keys = Object.keys(views);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_VIEWS))) delete views[k];
    return { ...s, views };
  });
}

/** Eski sürümlü dosyanın özgün metnini saklar (kaydetmeden önce) */
export function addBackup(name: string, text: string): void {
  updateSettings((s) => ({
    ...s,
    backups: [{ name, at: new Date().toISOString(), text }, ...(s.backups ?? [])].slice(0, MAX_BACKUPS),
  }));
}

export function listBackups(): UpgradeBackup[] {
  return loadSettings().backups ?? [];
}
