import type { Holiday } from "./holidays";
import type { WorkCalendar } from "./calendar";

// Bağımlılık tipleri (MS Project ile aynı): Bitiş-Başlangıç, Başlangıç-Başlangıç, Bitiş-Bitiş, Başlangıç-Bitiş
export type LinkType = "FS" | "SS" | "FF" | "SF";

export interface Predecessor {
  taskId: string;
  type: LinkType;
  /** Gecikme (iş günü). Negatif değer öne çekme (lead) demektir. */
  lag: number;
}

/**
 * Kısıt türleri (MS Project ile aynı): ASAP en kısa sürede, ALAP olabildiğince geç, SNET şu tarihten önce başlamasın,
 * SNLT şu tarihten geç başlamasın, MSO şu tarihte başlamalı, MFO şu tarihte bitmeli, FNET şu tarihten önce bitmesin,
 * FNLT şu tarihten geç bitmesin.
 */
export type ConstraintType = "ASAP" | "ALAP" | "SNET" | "SNLT" | "MSO" | "MFO" | "FNET" | "FNLT";

export interface Constraint {
  type: ConstraintType;
  /** YYYY-MM-DD; ASAP ve ALAP'ta yoktur */
  date?: string;
}

/** Maliyetin görev süresine dağılımı: eşit, başlangıçta, bitişte */
export type CostAccrual = "prorated" | "start" | "end";

export interface Task {
  id: string;
  name: string;
  /** Süre (iş günü). 0 = kilometre taşı. Özet görevlerde yok sayılır. */
  duration: number;
  /** Girintileme düzeyi; 0 en üst. Altında daha derin satır olan görev özet görevdir. */
  outline: number;
  predecessors: Predecessor[];
  /** Kısıt; yoksa ASAP. (Sürüm 4 öncesindeki `startNoEarlierThan` alanı SNET kısıtına çevrilir.) */
  constraint?: Constraint;
  /** Son tarih (YYYY-MM-DD): aşılırsa uyarı; bolluk buna göre hesaplanır. */
  deadline?: string;
  /** Tamamlanma yüzdesi 0–100. */
  percent: number;
  /** Gerçekleşen başlangıç: varsa görev bu tarihe sabitlenir. */
  actualStart?: string;
  /** Gerçekleşen bitiş: varsa görev bu tarihte biter (%100). */
  actualFinish?: string;
  /** Kaynak atamaları; özet görevlerde yok sayılır. */
  assignments?: Assignment[];
  /** Kaynaktan bağımsız sabit maliyet (proje para birimiyle) */
  fixedCost?: number;
  /** Yoksa "prorated" (eşit) */
  costAccrual?: CostAccrual;
  /** Bu göreve uygulanan çalışılamayan dönemlerin kimlikleri (Project.blackouts) */
  blackouts?: string[];
  /** Seviyeleme gecikmesi (görevin iş günü cinsinden); kaynak seviyelemesi yazar */
  levelingDelay?: number;
  /** Gerçekleşen maliyet (kazanılmış değerde AC); yoksa AC = EV sayılır */
  actualCost?: number;
  /** Serbest not */
  notes?: string;
  /** Bağlantı ekleri (web adresi ya da paylaşılan dosya adresi) */
  links?: TaskLink[];
  /** Etiketler (filtre için) */
  tags?: string[];
  /** Satır ve çubuk rengi */
  color?: TaskColor;
}

export interface TaskLink {
  url: string;
  title?: string;
}

export const TASK_COLORS = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "gray"] as const;
export type TaskColor = (typeof TASK_COLORS)[number];

/** Çalışılamayan dönem (ör. kışın dış işler durur); yalnızca seçildiği görevlere uygulanır. */
export interface Blackout {
  id: string;
  name: string;
  /** İlk ve son gün dahil (YYYY-MM-DD) */
  from: string;
  to: string;
}

/** Kaynak izni ya da çalışamadığı aralık (ilk ve son gün dahil) */
export interface Leave {
  from: string;
  to: string;
  name?: string;
}

export type ResourceType = "work" | "equipment" | "material";
/** Ücret türü: gün başına, saat başına ya da kullanım (atama) başına */
export type RateType = "day" | "hour" | "use";

/** İş kaynağı: kişi, ekip ya da makine. */
export interface Resource {
  id: string;
  name: string;
  /** Azami birim (%): 100 = bir kişi tam gün, 300 = üç kişilik ekip. */
  maxUnits: number;
  /** Ücret (proje para birimiyle). İşgücü/ekipmanda %100 birimde gün ya da saat başına ya da kullanım başına;
   * malzemede birim fiyat. */
  rate: number;
  /** Yoksa "work" (işgücü) */
  type?: ResourceType;
  /** Yoksa "day". Malzemede kullanılmaz. */
  rateType?: RateType;
  /** Malzeme birimi (ör. m³, ton) */
  unitLabel?: string;
  /** Kaynağın kendi çalışma günleri; yoksa proje takvimi (0 = pazar … 6 = cumartesi) */
  workdays?: number[];
  /** İzin / çalışılamayan aralıklar */
  leaves?: Leave[];
}

export interface Assignment {
  resourceId: string;
  /** Göreve ayrılan birim (%): 50 = yarım gün. Malzeme kaynağında miktardır (ör. 12,5 m³). */
  units: number;
}

/** İlerleme ağırlığı: planlanan %, gerçekleşen %, kazanılan değer ve sapma aynı ağırlıkla hesaplanır. */
export type ProgressWeight = "cost" | "work" | "duration";

/**
 * Dosya biçimi sürümü. 1: sürüm alanı olmayan ilk biçim. 2: çalışma günleri ve ilerleme ağırlığı eklendi.
 * 3: para birimi ve hazır tatillerin kaynak anahtarı (ad seçili dilde gösterilir) eklendi.
 * 4: kısıtlar, son tarih, gerçekleşen tarihler, referans planlar, kaynak takvimi/türü, maliyet kalemleri,
 *    çalışılamayan dönemler, yarım gün seçeneği. `startNoEarlierThan` → `constraint: SNET`.
 * 5: görev notu, bağlantılar, etiketler, renk ve gerçekleşen maliyet (hepsi isteğe bağlı).
 */
export const PROJECT_VERSION = 5;

/** Referans plan (baseline): kaydedildiği andaki tarihler, süre ve maliyet */
export interface Baseline {
  /** 0, 1, 2 */
  index: number;
  name: string;
  /** Kaydedildiği gün (YYYY-MM-DD) */
  savedAt: string;
  finish: string;
  tasks: Record<string, { start: string; finish: string; duration: number; cost: number }>;
}

export const BASELINE_SLOTS = 3;

export interface Project {
  /** Dosya biçimi sürümü (sanitizeProject eski dosyaları otomatik yükseltir) */
  version?: number;
  name: string;
  /** Proje başlangıç tarihi (YYYY-MM-DD). */
  start: string;
  tasks: Task[];
  /** Çalışılmayan günler (resmî tatil vb.); hafta sonları zaten tatildir. */
  holidays: Holiday[];
  resources: Resource[];
  /** Haftanın çalışılan günleri (0 = pazar … 6 = cumartesi). Yoksa pazartesi–cuma. */
  workdays?: number[];
  /** Yoksa "cost" (maliyet) */
  progressWeight?: ProgressWeight;
  /** Para birimi kodu (TRY, USD, EUR, GBP ya da özel kod). Tutar dönüştürülmez, yalnızca sembol. Yoksa TRY. */
  currency?: string;
  /** Arifeler (yarım gün tatiller): "full" iş günü sayılır (yalnızca işaret), "half" yarım gün kapasite. Yoksa "full". */
  halfDayMode?: "full" | "half";
  /** Çalışılamayan dönemler (görev bazında uygulanır) */
  blackouts?: Blackout[];
  /** Genel gider yüzdesi: görev maliyetlerine eklenir. Yoksa 0. */
  overheadPercent?: number;
  /** Saatlik ücretli kaynaklarda günlük çalışma saati. Yoksa 8. */
  hoursPerDay?: number;
  baselines?: Baseline[];
}

/** Zamanlama uyarısı: kısıt ile bağımlılık çatışması, son tarih aşımı vb. */
export interface ScheduleIssue {
  taskId: string;
  kind: "constraintLink" | "startLate" | "finishLate" | "deadline" | "noWorkingTime";
}

/** Hesaplanmış satır: zamanlama motorunun her görev için ürettiği sonuç. */
export interface ScheduledTask {
  id: string;
  /** Satır numarası (1'den başlar), öncül sütununda bu numara kullanılır. */
  row: number;
  isSummary: boolean;
  isMilestone: boolean;
  /** Kilometre taşı, gösterilen tarihin gün sonundadır (öncülünün bitişine bağlı) */
  atDayEnd: boolean;
  /** Proje başlangıcından itibaren iş günü ofseti; başlangıç dahil. */
  es: number;
  /** Bitiş ofseti (hariç): es + süre. */
  ef: number;
  ls: number;
  lf: number;
  /** Toplam bolluk (iş günü). */
  slack: number;
  critical: boolean;
  startDate: string;
  finishDate: string;
  /** Süre (iş günü): yaprakta görevin süresi, özette proje takviminde başlangıç–bitiş arası iş günü. */
  duration: number;
  /** Özette alt görevlerden süre ağırlıklı tamamlanma; yaprakta görevin yüzdesi */
  percent: number;
}

export interface Schedule {
  rows: ScheduledTask[];
  byId: Map<string, ScheduledTask>;
  /** Projenin bitiş ofseti (hariç). */
  finish: number;
  finishDate: string;
  /** Bu zamanlamada kullanılan iş takvimi (tatiller dahil). */
  calendar: WorkCalendar;
  /** Döngüye giren görevlerin kimlikleri; boşsa döngü yok. */
  cycle: string[];
  /** Döngü zinciri (ör. [a, b, c, a]); döngü yoksa boş */
  cyclePath: string[];
  issues: ScheduleIssue[];
  /** Görevin [from, to) ofset aralığındaki çalışma kapasitesi (iş günü; yarım gün 0,5) */
  capacity: (taskId: string, from: number, to: number) => number;
  /** Görevin o ofsette çalışıp çalışmadığı (0, 0,5 ya da 1) */
  dayCapacity: (taskId: string, offset: number) => number;
}
