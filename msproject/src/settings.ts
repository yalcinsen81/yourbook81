import { detectLang, setLocale, type DateStyle, type Lang } from "./i18n";
import type { UserTemplate } from "./model/templates";

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
  /** Kullanıcının kaydettiği şablonlar */
  templates?: UserTemplate[];
  /** Görev tablosunda gizlenen sütunlar */
  hiddenColumns?: string[];
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

// --- Şablonlar ---

const MAX_TEMPLATES = 20;

export function listTemplates(): UserTemplate[] {
  return loadSettings().templates ?? [];
}

export function addTemplate(tpl: UserTemplate): boolean {
  let ok = true;
  updateSettings((s) => {
    const others = (s.templates ?? []).filter((x) => x.name.toLocaleLowerCase() !== tpl.name.toLocaleLowerCase());
    return { ...s, templates: [tpl, ...others].slice(0, MAX_TEMPLATES) };
  });
  // Depolama doluysa kayıt yazılamamış olabilir
  ok = listTemplates().some((x) => x.id === tpl.id);
  return ok;
}

export function removeTemplate(id: string): void {
  updateSettings((s) => ({ ...s, templates: (s.templates ?? []).filter((x) => x.id !== id) }));
}

// --- Sütunlar ---

export function loadHiddenColumns(): string[] {
  return loadSettings().hiddenColumns ?? [];
}

export function saveHiddenColumns(cols: string[]): void {
  updateSettings((s) => ({ ...s, hiddenColumns: cols }));
}

// --- Kurtarma noktaları ---
// Proje her değiştiğinde en çok dakikada bir anlık görüntü alınır (son 8). Tarayıcı çökse ya da yanlışlıkla başka
// proje açılsa da önceki hal geri yüklenebilir.

const RECOVERY_KEY = "msproject.recovery";
const MAX_SNAPSHOTS = 8;
const SNAPSHOT_MS = 60_000;

export interface Snapshot {
  at: string;
  name: string;
  tasks: number;
  text: string;
}

export function listSnapshots(): Snapshot[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECOVERY_KEY) ?? "[]");
    return Array.isArray(raw) ? (raw as Snapshot[]) : [];
  } catch {
    return [];
  }
}

/** Anlık görüntü al: son görüntüden bu yana süre dolmadıysa ya da içerik aynıysa alınmaz (force: süreye bakma) */
export function takeSnapshot(name: string, tasks: number, text: string, now = new Date(), force = false): boolean {
  const list = listSnapshots();
  const last = list[0];
  if (last && last.text === text) return false;
  if (last && !force && now.getTime() - new Date(last.at).getTime() < SNAPSHOT_MS) return false;
  const next = [{ at: now.toISOString(), name, tasks, text }, ...list].slice(0, MAX_SNAPSHOTS);
  for (let n = next.length; n > 0; n--) {
    try {
      localStorage.setItem(RECOVERY_KEY, JSON.stringify(next.slice(0, n)));
      return true;
    } catch {
      // Depolama dolu: daha az görüntüyle dene
    }
  }
  return false;
}
