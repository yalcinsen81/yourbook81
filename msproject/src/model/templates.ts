import { getLang } from "../i18n";
import { addDays, diffDays } from "./calendar";
import { newId } from "./storage";
import type { LinkType, Project, Resource, Task } from "./types";

// Şablonlar (saf): hazır şablonlar (iki dilde) ve kullanıcının kaydettiği şablonlar. Şablondan proje oluşturulurken
// takvim (çalışma günleri, tatiller), ad ve başlangıç yeni proje penceresinden gelir; şablon yalnızca görevleri,
// bağları, kaynakları ve görev ayrıntılarını taşır. Hazır şablonlardaki süreler örnektir, ücretler boştur.

type Name = [tr: string, en: string];
/** [ad, süre (iş günü), düzey, öncüller ("2;3SS+2"), kaynaklar ("ekip[200%]; vinç")] */
type Row = [name: Name, duration: number, outline: number, preds?: string, resources?: string];

export interface BuiltinTemplate {
  id: string;
  name: Name;
  description: Name;
  resources: { key: string; name: Name; maxUnits: number; type?: Resource["type"]; unitLabel?: string }[];
  rows: Row[];
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: "konut",
    name: ["Konut yapımı", "Residential construction"],
    description: ["Ruhsattan teslime müstakil konut ya da küçük apartman: kaba inşaat, tesisat, ince işler.", "Detached house or small apartment block from permits to handover: structure, MEP, finishes."],
    resources: [
      { key: "sef", name: ["Şantiye şefi", "Site manager"], maxUnits: 100 },
      { key: "makine", name: ["İş makinesi", "Excavator"], maxUnits: 100, type: "equipment" },
      { key: "kaba", name: ["Kaba inşaat ekibi", "Structural crew"], maxUnits: 300 },
      { key: "tesisat", name: ["Tesisat ekibi", "MEP crew"], maxUnits: 200 },
      { key: "ince", name: ["İnce iş ekibi", "Finishing crew"], maxUnits: 300 },
      { key: "beton", name: ["Hazır beton", "Ready-mix concrete"], maxUnits: 100, type: "material", unitLabel: "m³" },
    ],
    rows: [
      [["Proje başlangıcı", "Project start"], 0, 0],
      [["Hazırlık", "Preparation"], 0, 0],
      [["Zemin etüdü", "Soil survey"], 5, 1, "1", "sef[50%]"],
      [["Ruhsat ve izinler", "Permits and approvals"], 15, 1, "3", "sef[50%]"],
      [["Şantiye kurulumu", "Site setup"], 5, 1, "4", "sef; makine"],
      [["Kaba inşaat", "Structure"], 0, 0],
      [["Hafriyat", "Excavation"], 6, 1, "5", "makine; sef[50%]"],
      [["Temel", "Foundation"], 10, 1, "7", "kaba[200%]; sef[50%]"],
      [["Bodrum perdeleri", "Basement walls"], 8, 1, "8", "kaba[200%]"],
      [["Kat betonları", "Floor slabs"], 25, 1, "9", "kaba[200%]; sef[50%]"],
      [["Çatı", "Roof"], 10, 1, "10", "kaba[200%]"],
      [["Duvarlar", "Masonry walls"], 15, 1, "10SS+10", "kaba"],
      [["Kaba inşaat tamamlandı", "Structure complete"], 0, 1, "11;12"],
      [["Tesisat", "MEP"], 0, 0],
      [["Elektrik tesisatı", "Electrical installation"], 15, 1, "12SS+5", "tesisat"],
      [["Sıhhi tesisat", "Plumbing"], 12, 1, "12SS+5", "tesisat"],
      [["Isıtma ve havalandırma", "Heating and ventilation"], 10, 1, "16", "tesisat"],
      [["İnce işler", "Finishes"], 0, 0],
      [["Doğrama", "Windows and doors"], 8, 1, "11", "ince"],
      [["Sıva", "Plastering"], 15, 1, "15;16;19", "ince[200%]"],
      [["Şap ve zemin kaplama", "Screed and flooring"], 12, 1, "20", "ince[200%]"],
      [["Boya", "Painting"], 10, 1, "21", "ince"],
      [["Cephe kaplaması", "Facade cladding"], 15, 1, "13", "ince"],
      [["Çevre düzenlemesi", "Landscaping"], 8, 1, "23", "makine; ince"],
      [["Kabul ve teslim", "Acceptance and handover"], 0, 0, "17;22;24"],
    ],
  },
  {
    id: "restorasyon",
    name: ["Restorasyon", "Restoration"],
    description: ["Tarihi ya da eski yapının belgelenmesi, onayı, sağlamlaştırılması ve yenilenmesi.", "Survey, approval, strengthening and renewal of a historic or old building."],
    resources: [
      { key: "mimar", name: ["Restorasyon mimarı", "Conservation architect"], maxUnits: 100 },
      { key: "usta", name: ["Restorasyon ustaları", "Restoration craftsmen"], maxUnits: 300 },
      { key: "insaat", name: ["İnşaat ekibi", "Construction crew"], maxUnits: 200 },
      { key: "tesisat", name: ["Tesisat ekibi", "MEP crew"], maxUnits: 100 },
      { key: "iskele", name: ["İskele", "Scaffolding"], maxUnits: 100, type: "equipment" },
    ],
    rows: [
      [["Proje başlangıcı", "Project start"], 0, 0],
      [["Belgeleme ve onay", "Survey and approval"], 0, 0],
      [["Rölöve ve fotogrametri", "Measured survey and photogrammetry"], 15, 1, "1", "mimar"],
      [["Malzeme analizleri", "Material analyses"], 10, 1, "3SS+5"],
      [["Restorasyon projesi", "Restoration design"], 20, 1, "3;4", "mimar"],
      [["Kurul onayı", "Heritage board approval"], 30, 1, "5"],
      [["Sağlamlaştırma", "Strengthening"], 0, 0],
      [["İskele kurulumu", "Scaffolding erection"], 5, 1, "6", "insaat; iskele"],
      [["Temel ve taşıyıcı güçlendirme", "Foundation and structural strengthening"], 25, 1, "8", "insaat[200%]; iskele"],
      [["Çatı onarımı", "Roof repair"], 15, 1, "9", "usta[200%]; iskele"],
      [["Yenileme", "Renewal"], 0, 0],
      [["Cephe taş temizliği ve onarımı", "Facade stone cleaning and repair"], 20, 1, "10", "usta[200%]; iskele"],
      [["Ahşap doğrama onarımı", "Timber window and door repair"], 15, 1, "10", "usta"],
      [["Tesisat yenileme", "MEP renewal"], 20, 1, "9", "tesisat"],
      [["İç sıva ve kalem işi", "Interior plaster and decorative painting"], 25, 1, "12;13;14", "usta[300%]"],
      [["İskele sökümü", "Scaffolding removal"], 3, 1, "12;15", "insaat; iskele"],
      [["Kurul kontrolü ve teslim", "Heritage board inspection and handover"], 0, 0, "16"],
    ],
  },
  {
    id: "fitout",
    name: ["Ofis fit-out", "Office fit-out"],
    description: ["Kiralanan ofis katının tasarımdan taşınmaya iç mimari uygulaması.", "Interior fit-out of a leased office floor from design to move-in."],
    resources: [
      { key: "pm", name: ["Proje yöneticisi", "Project manager"], maxUnits: 100 },
      { key: "tasarim", name: ["İç mimar", "Interior designer"], maxUnits: 100 },
      { key: "kuru", name: ["Kuru yapı ekibi", "Drywall crew"], maxUnits: 200 },
      { key: "mep", name: ["Mekanik-elektrik ekibi", "MEP crew"], maxUnits: 200 },
      { key: "it", name: ["BT ekibi", "IT team"], maxUnits: 100 },
      { key: "ince", name: ["İnce iş ekibi", "Finishing crew"], maxUnits: 200 },
    ],
    rows: [
      [["Proje başlangıcı", "Project start"], 0, 0],
      [["Tasarım", "Design"], 0, 0],
      [["İhtiyaç programı", "Brief and space programme"], 5, 1, "1", "pm[50%]; tasarim"],
      [["Konsept ve yerleşim planı", "Concept and layout"], 10, 1, "3", "tasarim"],
      [["Uygulama projeleri", "Construction drawings"], 15, 1, "4", "tasarim"],
      [["Bina yönetimi onayı", "Landlord approval"], 10, 1, "5"],
      [["Satın alma", "Procurement"], 0, 0],
      [["Teklif ve sözleşme", "Tender and contract"], 10, 1, "5", "pm"],
      [["Mobilya siparişi", "Furniture order"], 30, 1, "8"],
      [["Uygulama", "Construction"], 0, 0],
      [["Söküm ve hazırlık", "Strip-out"], 5, 1, "6;8", "kuru"],
      [["Bölme duvarlar", "Partitions"], 10, 1, "11", "kuru[200%]"],
      [["Mekanik ve elektrik", "Mechanical and electrical"], 15, 1, "12SS+3", "mep[200%]"],
      [["Asma tavan", "Suspended ceiling"], 8, 1, "13", "kuru"],
      [["Zemin kaplama", "Flooring"], 6, 1, "16", "ince"],
      [["Boya ve ince işler", "Painting and finishes"], 8, 1, "14", "ince[200%]"],
      [["Veri ve güvenlik altyapısı", "Data and security infrastructure"], 8, 1, "13", "it"],
      [["Mobilya montajı", "Furniture installation"], 5, 1, "9;15;16", "ince"],
      [["Eksik listesi ve taşınma", "Snagging and move-in"], 5, 1, "17;18", "pm; it"],
      [["Teslim", "Handover"], 0, 0, "19"],
    ],
  },
];

/** Hazır şablonun görevleri ve kaynakları (seçili dilde; kimlikler yeni) */
export function builtinContent(tpl: BuiltinTemplate, lang = getLang()): Pick<Project, "tasks" | "resources"> {
  const li = lang === "en" ? 1 : 0;
  const ids = tpl.rows.map(() => newId());
  const resIds = new Map(tpl.resources.map((r) => [r.key, `r-${r.key}-${newId().slice(-5)}`]));
  const tasks: Task[] = tpl.rows.map(([name, duration, outline, preds = "", res = ""], i) => {
    const task: Task = {
      id: ids[i],
      name: name[li],
      duration,
      outline,
      percent: 0,
      predecessors: preds
        .split(";")
        .filter(Boolean)
        .map((p) => {
          const m = /^(\d+)(FS|SS|FF|SF)?([+-]\d+)?$/.exec(p)!;
          return { taskId: ids[Number(m[1]) - 1], type: (m[2] ?? "FS") as LinkType, lag: Number(m[3] ?? 0) };
        }),
    };
    if (res) {
      task.assignments = res.split(";").map((part) => {
        const m = /^\s*(\w+)(?:\[(\d+)%\])?\s*$/.exec(part)!;
        return { resourceId: resIds.get(m[1])!, units: Number(m[2] ?? 100) };
      });
    }
    return task;
  });
  const resources: Resource[] = tpl.resources.map((r) => {
    const res: Resource = { id: resIds.get(r.key)!, name: r.name[li], maxUnits: r.maxUnits, rate: 0 };
    if (r.type) res.type = r.type;
    if (r.unitLabel) res.unitLabel = r.unitLabel;
    return res;
  });
  return { tasks, resources };
}

/** Kullanıcı şablonu: projenin yapısı (ilerleme, gerçekleşenler ve referans planlar olmadan) */
export interface UserTemplate {
  id: string;
  name: string;
  savedAt: string;
  /** Şablonun kaydedildiği projenin başlangıcı: tarihli kısıtlar yeni başlangıca kaydırılır */
  start: string;
  tasks: Task[];
  resources: Resource[];
  blackouts?: Project["blackouts"];
  overheadPercent?: number;
  hoursPerDay?: number;
}

/** Projeden şablon: ilerleme sıfırlanır; gerçekleşen tarih/maliyet, seviyeleme gecikmesi ve referans planlar atılır */
export function projectToTemplate(p: Project, name: string, today: string): UserTemplate {
  const tasks = p.tasks.map((x) => {
    const task: Task = { ...x, percent: 0 };
    delete task.actualStart;
    delete task.actualFinish;
    delete task.actualCost;
    delete task.levelingDelay;
    return task;
  });
  const tpl: UserTemplate = { id: `u${newId()}`, name: name.trim() || p.name, savedAt: today, start: p.start, tasks, resources: p.resources };
  if (p.blackouts?.length) tpl.blackouts = p.blackouts;
  if (p.overheadPercent) tpl.overheadPercent = p.overheadPercent;
  if (p.hoursPerDay) tpl.hoursPerDay = p.hoursPerDay;
  return tpl;
}

/**
 * Şablonu yeni projeye uygular: `base` takvimi ve başlangıcı verir (yeni proje penceresinden). Kullanıcı şablonundaki
 * tarihler (kısıt, son tarih, dönem, izin) iki başlangıç arasındaki takvim günü farkı kadar kaydırılır; kimlikler yenilenir.
 */
export function applyTemplate(base: Project, tpl: UserTemplate | BuiltinTemplate, lang = getLang()): Project {
  if ("rows" in tpl) return { ...base, ...builtinContent(tpl, lang) };
  const shift = diffDays(tpl.start, base.start);
  const mv = (d: string | undefined) => (d ? addDays(d, shift) : d);
  const ids = new Map(tpl.tasks.map((x) => [x.id, newId()]));
  const blackoutIds = new Map((tpl.blackouts ?? []).map((b, i) => [b.id, `b${i + 1}`]));
  const tasks = tpl.tasks.map((x) => {
    const task: Task = { ...x, id: ids.get(x.id)!, predecessors: x.predecessors.filter((pr) => ids.has(pr.taskId)).map((pr) => ({ ...pr, taskId: ids.get(pr.taskId)! })) };
    if (task.constraint?.date) task.constraint = { ...task.constraint, date: mv(task.constraint.date) };
    if (task.deadline) task.deadline = mv(task.deadline);
    if (task.blackouts) task.blackouts = task.blackouts.flatMap((id) => (blackoutIds.has(id) ? [blackoutIds.get(id)!] : []));
    return task;
  });
  const resources = tpl.resources.map((r) => (r.leaves ? { ...r, leaves: r.leaves.map((l) => ({ ...l, from: mv(l.from)!, to: mv(l.to)! })) } : r));
  const next: Project = { ...base, tasks, resources };
  if (tpl.blackouts?.length) next.blackouts = tpl.blackouts.map((b) => ({ ...b, id: blackoutIds.get(b.id)!, from: mv(b.from)!, to: mv(b.to)! }));
  if (tpl.overheadPercent) next.overheadPercent = tpl.overheadPercent;
  if (tpl.hoursPerDay) next.hoursPerDay = tpl.hoursPerDay;
  return next;
}
