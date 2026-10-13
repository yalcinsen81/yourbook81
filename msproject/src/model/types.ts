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

export interface Task {
  id: string;
  name: string;
  /** Süre (iş günü). 0 = kilometre taşı. Özet görevlerde yok sayılır. */
  duration: number;
  /** Girintileme düzeyi; 0 en üst. Altında daha derin satır olan görev özet görevdir. */
  outline: number;
  predecessors: Predecessor[];
  /** "Şundan önce başlamasın" kısıtı (YYYY-MM-DD). Boşsa en erken tarihte başlar. */
  startNoEarlierThan?: string;
  /** Tamamlanma yüzdesi 0–100. */
  percent: number;
  /** Kaynak atamaları; özet görevlerde yok sayılır. */
  assignments?: Assignment[];
}

/** İş kaynağı: kişi, ekip ya da makine. */
export interface Resource {
  id: string;
  name: string;
  /** Azami birim (%): 100 = bir kişi tam gün, 300 = üç kişilik ekip. */
  maxUnits: number;
  /** %100 birimde günlük ücret (₺/gün). */
  rate: number;
}

export interface Assignment {
  resourceId: string;
  /** Göreve ayrılan birim (%): 50 = yarım gün. */
  units: number;
}

export interface Project {
  name: string;
  /** Proje başlangıç tarihi (YYYY-MM-DD). */
  start: string;
  tasks: Task[];
  /** Çalışılmayan günler (resmî tatil vb.); hafta sonları zaten tatildir. */
  holidays: Holiday[];
  resources: Resource[];
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
  /** Özet görevler için hesaplanan süre (iş günü). */
  duration: number;
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
}
