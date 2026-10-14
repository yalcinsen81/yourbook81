import { getLang, t } from "../i18n";
import { DEFAULT_WORKDAYS, normalizeWorkdays } from "./calendar";
import { DEFAULT_HOLIDAY_OPTIONS, turkishHolidays, type HolidayOptions } from "./holidays";
import { PROJECT_VERSION, type LinkType, type ProgressWeight, type Project, type Resource, type Task } from "./types";

// İlk açılışta gösterilen örnek proje: küçük bir konut inşaatı. Adlar seçili dilde üretilir (oluşturulduktan sonra
// kullanıcı içeriğidir, dil değişince çevrilmez).

type Name = [tr: string, en: string];
type Row = [name: Name, duration: number, outline: number, preds?: string, percent?: number, resources?: string];

const RESOURCES: (Omit<Resource, "name"> & { name: Name })[] = [
  { id: "kaynak-sef", name: ["Şantiye şefi", "Site manager"], maxUnits: 100, rate: 4500 },
  { id: "kaynak-makine", name: ["İş makinesi", "Excavator"], maxUnits: 100, rate: 12000 },
  { id: "kaynak-kaba", name: ["Kaba inşaat ekibi", "Structural crew"], maxUnits: 300, rate: 7000 },
  { id: "kaynak-tesisat", name: ["Tesisat ekibi", "MEP crew"], maxUnits: 100, rate: 6000 },
  { id: "kaynak-ince", name: ["İnce iş ekibi", "Finishing crew"], maxUnits: 300, rate: 5500 },
];

// Kaynak sütunu kaynak kimliğinin sonekiyle yazılır: "sef[50%]; makine"
const ROWS: Row[] = [
  [["Proje başlangıcı", "Project start"], 0, 0, "", 100],
  [["Hazırlık", "Preparation"], 0, 0],
  [["Ruhsat ve izinler", "Permits and approvals"], 10, 1, "1", 100, "sef[50%]"],
  [["Şantiye kurulumu", "Site setup"], 5, 1, "3", 40, "sef; makine"],
  [["Kaba inşaat", "Structure"], 0, 0, "2"],
  [["Hafriyat", "Excavation"], 6, 1, "", 0, "makine; sef[50%]"],
  [["Temel", "Foundation"], 10, 1, "6", 0, "kaba[200%]; sef[50%]"],
  [["Bodrum perdeleri", "Basement walls"], 8, 1, "7", 0, "kaba[200%]"],
  [["Kat betonları", "Floor slabs"], 20, 1, "8", 0, "kaba[300%]; sef[50%]"],
  [["Çatı", "Roof"], 8, 1, "9", 0, "kaba[200%]"],
  [["Kaba inşaat tamamlandı", "Structure complete"], 0, 1, "10"],
  [["İnce işler", "Finishes"], 0, 0],
  [["Elektrik tesisatı", "Electrical installation"], 15, 1, "9SS+5", 0, "tesisat"],
  [["Mekanik tesisat", "Mechanical installation"], 15, 1, "9SS+5", 0, "tesisat"],
  [["Sıva", "Plastering"], 12, 1, "13;14", 0, "ince[200%]"],
  [["Boya", "Painting"], 8, 1, "15", 0, "ince"],
  [["Doğrama", "Windows and doors"], 6, 1, "10", 0, "ince"],
  [["Teslim", "Handover"], 0, 0, "16;17"],
];

export function sampleProject(start: string): Project {
  const li = getLang() === "en" ? 1 : 0;
  const ids = ROWS.map((_, i) => `ornek-${i + 1}`);
  const tasks: Task[] = ROWS.map(([name, duration, outline, preds = "", percent = 0, res = ""], i) => ({
    id: ids[i],
    name: name[li],
    duration,
    outline,
    percent,
    predecessors: preds
      .split(";")
      .filter(Boolean)
      .map((p) => {
        const m = /^(\d+)(FS|SS|FF|SF)?([+-]\d+)?$/.exec(p)!;
        return { taskId: ids[Number(m[1]) - 1], type: (m[2] ?? "FS") as LinkType, lag: Number(m[3] ?? 0) };
      }),
    ...(res
      ? {
          assignments: res.split(";").map((part) => {
            const m = /^\s*(\w+)(?:\[(\d+)%\])?\s*$/.exec(part)!;
            return { resourceId: `kaynak-${m[1]}`, units: Number(m[2] ?? 100) };
          }),
        }
      : {}),
  }));
  return {
    ...emptyProject(start),
    name: li ? "Sample: House Construction" : "Örnek: Konut İnşaatı",
    tasks,
    resources: RESOURCES.map((r) => ({ ...r, name: r.name[li] })),
  };
}

export interface ProjectSetup {
  name: string;
  start: string;
  /** 0 = pazar … 6 = cumartesi */
  workdays: number[];
  holidays: HolidayOptions;
  progressWeight: ProgressWeight;
  currency: string;
}

export const DEFAULT_SETUP: Omit<ProjectSetup, "start"> = {
  name: "",
  workdays: DEFAULT_WORKDAYS,
  holidays: DEFAULT_HOLIDAY_OPTIONS,
  progressWeight: "cost",
  currency: "TRY",
};

/** Kullanıcının proje başında seçtiği takvimle boş proje (MS Project'teki "Proje bilgileri" gibi) */
export function emptyProject(start: string, setup: Partial<Omit<ProjectSetup, "start">> = {}): Project {
  const s = { ...DEFAULT_SETUP, ...setup };
  return {
    version: PROJECT_VERSION,
    name: s.name || t("default.project"),
    start,
    tasks: [],
    holidays: defaultHolidays(start, s.holidays),
    resources: [],
    workdays: normalizeWorkdays(s.workdays),
    progressWeight: s.progressWeight,
    currency: s.currency,
  };
}

/** Proje başlangıç yılından itibaren 4 yılın seçilen Türkiye tatilleri */
export function defaultHolidays(start: string, options: HolidayOptions = DEFAULT_HOLIDAY_OPTIONS) {
  const y = Number(start.slice(0, 4));
  return turkishHolidays(y, y + 3, options);
}
