// Proje Planlayıcı MCP sunucusu: Claude'un (Claude Desktop / Claude Code) diskteki proje dosyasını okuyup
// düzenlemesini sağlar. Uygulamada "Dosyaya bağla" ile aynı dosya açıkken değişiklikler ekrana anında yansır.
//
// Çalıştırma:  node mcp/dist/msproject-mcp.mjs <proje.json yolu>
// (ya da MSPROJECT_FILE ortam değişkeni)

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";
import { formatDate, isValidDate, normalizeWorkdays } from "../src/model/calendar";
import { mergeHolidays, turkishHolidays, yearsWithoutReligiousData } from "../src/model/holidays";
import { toMspXml } from "../src/model/mspXml";
import {
  addTask,
  deleteResource,
  deleteTask,
  listResources,
  setResource,
  linkTasks,
  listTasks,
  OpError,
  progressWarnings,
  projectSummary,
  shiftTask,
  unlinkTasks,
  updateTask,
} from "../src/model/ops";
import { curveSamples, plannedAt, progressCurves, projectWeight } from "../src/model/resources";
import { emptyProject } from "../src/model/sample";
import { schedule } from "../src/model/schedule";
import { CONSTRAINT_TYPES, needsUpgradeBackup, sanitizeProject } from "../src/model/storage";
import { baselineVariance, clearBaseline, getBaseline, saveBaseline } from "../src/model/baseline";
import { clearLeveling, overallocations, proposeLeveling } from "../src/model/leveling";
import { detectLang, setLocale, t } from "../src/i18n";
import { BASELINE_SLOTS, type Project } from "../src/model/types";

/** "~", ${HOME}, ${DOCUMENTS}, ${DESKTOP} kısaltmalarını açar (Claude Desktop eklentisinin varsayılan yolu bunları içerir) */
function expandPath(p: string): string {
  const home = homedir();
  return p
    .replace(/^~(?=$|[\\/])/, home)
    .replace(/\$\{HOME\}/g, home)
    .replace(/\$\{DOCUMENTS\}/g, join(home, "Documents"))
    .replace(/\$\{DESKTOP\}/g, join(home, "Desktop"));
}

const file = resolve(expandPath(process.argv[2] || process.env.MSPROJECT_FILE || "proje.json"));

// Hata ve uyarı metinlerinin dili: MSPROJECT_LANG (tr/en), yoksa işletim sistemi dili
setLocale({ lang: process.env.MSPROJECT_LANG === "en" || process.env.MSPROJECT_LANG === "tr" ? process.env.MSPROJECT_LANG : detectLang() });

/** Eski sürümlü dosyanın özgün metni: ilk kayıttan önce <dosya>.bak olarak saklanır */
let upgradeBackup: string | null = null;

function load(): Project {
  if (!existsSync(file)) return emptyProject(formatDate(new Date()));
  const text = readFileSync(file, "utf8");
  if (!text.trim()) return emptyProject(formatDate(new Date()));
  const raw = JSON.parse(text);
  const p = sanitizeProject(raw);
  if (!p) throw new OpError(t("err.invalidFile", { file }));
  upgradeBackup = needsUpgradeBackup(raw) ? text : null;
  return p;
}

function save(p: Project): void {
  mkdirSync(dirname(file), { recursive: true });
  if (upgradeBackup !== null) {
    // Var olan yedeğin üzerine yazılmaz (ilk yükseltmedeki özgün dosya korunur)
    if (!existsSync(`${file}.bak`)) writeFileSync(`${file}.bak`, upgradeBackup, "utf8");
    upgradeBackup = null;
  }
  // Önce geçici dosyaya yaz, sonra taşı: uygulama yarım dosya okumasın
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(p, null, 2), "utf8");
  renameSync(tmp, file);
}

type Result = { content: { type: "text"; text: string }[]; isError?: boolean };

const ok = (data: unknown): Result => ({
  content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
});

/** Hata olursa Claude'a okunur mesaj döner; dosyaya yalnızca başarılı işlemde yazılır. */
function run(fn: () => unknown): Result {
  try {
    return ok(fn());
  } catch (e) {
    const msg = e instanceof OpError ? e.message : `Beklenmeyen hata: ${(e as Error).message}`;
    return { content: [{ type: "text", text: msg }], isError: true };
  }
}

function mutate(fn: (p: Project) => { project: Project; message: string }): Result {
  return run(() => {
    const { project, message } = fn(load());
    save(project);
    return `${message}\n\n${JSON.stringify(projectSummary(project), null, 2)}`;
  });
}

const row = z.number().int().min(1).describe("Satır numarası (1'den başlar; get_tasks çıktısındaki row)");
const resourcesArg = z
  .string()
  .optional()
  .describe("Kaynak atamaları: 'Ali', 'Ali[50%]; Vinç', 'Kalıp ekibi[200%]'. Listede olmayan ad yeni kaynak olur.");
const linkType = z.enum(["FS", "SS", "FF", "SF"]).describe("FS bitiş-başlangıç (varsayılan), SS, FF, SF");
const constraintArgs = {
  constraint_type: z
    .enum(CONSTRAINT_TYPES as [string, ...string[]])
    .optional()
    .describe(
      "Kısıt: ASAP (varsayılan), ALAP (olabildiğince geç), SNET (şu tarihten önce başlamasın), SNLT (şu tarihten geç başlamasın), " +
        "MSO (şu tarihte başlamalı), MFO (şu tarihte bitmeli), FNET (şu tarihten önce bitmesin), FNLT (şu tarihten geç bitmesin)",
    ),
  constraint_date: z.string().optional().describe("Kısıt tarihi YYYY-AA-GG (ASAP/ALAP dışındakiler için gerekli)"),
  deadline: z.string().optional().describe("Son tarih YYYY-AA-GG; aşılırsa uyarı. Boş metin kaldırır."),
  fixed_cost: z.number().min(0).optional().describe("Kaynaktan bağımsız sabit maliyet; 0 kaldırır"),
  cost_accrual: z.enum(["prorated", "start", "end"]).optional().describe("Maliyet dağılımı: eşit (varsayılan), başta, sonda"),
};
const dateRange = z.object({ from: z.string(), to: z.string(), name: z.string().optional() });

const server = new McpServer({ name: "proje-planlayici", version: "0.6.0" });

server.registerTool(
  "get_project_summary",
  {
    title: "Proje özeti",
    description: "Projenin adı, başlangıç/bitiş tarihi, iş günü süresi, görev sayısı, kritik görev sayısı, ilerleme yüzdesi, toplam maliyet ve aşırı yüklü kaynaklar.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => run(() => ({ file, ...projectSummary(load()) })),
);

server.registerTool(
  "get_tasks",
  {
    title: "Görevleri listele",
    description:
      "Tüm görevleri zamanlanmış haliyle döner: satır, WBS, ad, düzey, süre (iş günü), başlangıç, bitiş, öncüller, yüzde, bolluk, kritik mi, " +
      "kaynaklar, maliyet ve aşırı yüklü kaynak varsa overallocated. " +
      "Öncül yazımı: '2' (FS), '3SS', '4FS+2' (2 gün gecikme), '5FF-1'; birden çok için ';'.",
    inputSchema: { critical_only: z.boolean().optional().describe("Yalnızca kritik yoldaki görevler") },
    annotations: { readOnlyHint: true },
  },
  async ({ critical_only }) =>
    run(() => {
      const rows = listTasks(load());
      return critical_only ? rows.filter((r) => r.critical && !r.summary) : rows;
    }),
);

server.registerTool(
  "add_task",
  {
    title: "Görev ekle",
    description:
      "Yeni görev ekler. parent_row verilirse o görevin son alt görevi olur (o görev özete dönüşür); after_row verilirse o satırın altına aynı düzeyde; " +
      "ikisi de yoksa sona. Süre 0 = kilometre taşı.",
    inputSchema: {
      name: z.string().min(1),
      duration: z.number().min(0).optional().describe("İş günü; varsayılan 1"),
      parent_row: row.optional(),
      after_row: row.optional(),
      predecessors: z.string().optional().describe("Örn. '3' ya da '3;5SS+2'"),
      percent: z.number().min(0).max(100).optional(),
      start_no_earlier_than: z.string().optional().describe("YYYY-AA-GG (SNET kısıtının kısa yolu)"),
      ...constraintArgs,
      resources: resourcesArg,
    },
  },
  async (a) =>
    mutate((p) => {
      const { project, row: r } = addTask(p, {
        constraintType: a.constraint_type,
        constraintDate: a.constraint_date,
        deadline: a.deadline,
        fixedCost: a.fixed_cost,
        costAccrual: a.cost_accrual,
        resources: a.resources,
        name: a.name,
        duration: a.duration,
        parentRow: a.parent_row,
        afterRow: a.after_row,
        predecessors: a.predecessors,
        percent: a.percent,
        startNoEarlierThan: a.start_no_earlier_than,
      });
      return { project, message: `"${a.name}" ${r}. satıra eklendi.` };
    }),
);

server.registerTool(
  "update_task",
  {
    title: "Görevi güncelle",
    description:
      "Görevin adını, süresini, öncüllerini (tamamen değiştirir; boş metin hepsini siler), yüzdesini, kısıtını, son tarihini, " +
      "gerçekleşen tarihlerini, kalan süresini, sabit maliyetini ya da çalışılamayan dönemlerini değiştirir. " +
      "start_no_earlier_than için boş metin kısıtı kaldırır. resources atamaları tamamen değiştirir; boş metin hepsini kaldırır. " +
      "Yüzde girilince gerçekleşen başlangıç (ve %100'de bitiş) MS Project'teki gibi planlanan tarihle dolar; gerçekleşen başlangıçlı görev o tarihe sabitlenir.",
    inputSchema: {
      row,
      name: z.string().optional(),
      duration: z.number().min(0).optional(),
      predecessors: z.string().optional(),
      percent: z.number().min(0).max(100).optional(),
      start_no_earlier_than: z.string().optional(),
      ...constraintArgs,
      actual_start: z.string().optional().describe("Gerçekleşen başlangıç YYYY-AA-GG; boş metin kaldırır (yüzde 0 olur)"),
      actual_finish: z.string().optional().describe("Gerçekleşen bitiş: görev %100 olur, süre gerçek tarihlere göre ayarlanır"),
      remaining_duration: z.number().min(0).optional().describe("Kalan süre (iş günü): süre = gerçekleşen + kalan"),
      blackouts: z.array(z.string()).optional().describe("Uygulanacak çalışılamayan dönemlerin adları (listeyi değiştirir; [] kaldırır)"),
      resources: resourcesArg,
    },
  },
  async (a) =>
    mutate((p) => ({
      project: updateTask(p, a.row, {
        constraintType: a.constraint_type,
        constraintDate: a.constraint_date,
        deadline: a.deadline,
        fixedCost: a.fixed_cost,
        costAccrual: a.cost_accrual,
        actualStart: a.actual_start,
        actualFinish: a.actual_finish,
        remainingDuration: a.remaining_duration,
        blackouts: a.blackouts,
        resources: a.resources,
        name: a.name,
        duration: a.duration,
        predecessors: a.predecessors,
        percent: a.percent,
        startNoEarlierThan: a.start_no_earlier_than,
      }),
      message: `${a.row}. satır güncellendi.`,
    })),
);

server.registerTool(
  "delete_task",
  {
    title: "Görevi sil",
    description: "Görevi siler; özet görevse tüm alt görevleri de silinir. Sonraki satır numaraları kayar.",
    inputSchema: { row },
    annotations: { destructiveHint: true },
  },
  async ({ row: r }) =>
    mutate((p) => {
      const { project, deleted } = deleteTask(p, r);
      return { project, message: `${deleted} görev silindi.` };
    }),
);

server.registerTool(
  "indent_task",
  {
    title: "Girinti",
    description: "Görevi alt görevleriyle birlikte içeri (üstündeki görevin altına; o özet olur) ya da dışarı alır.",
    inputSchema: { row, direction: z.enum(["in", "out"]) },
  },
  async ({ row: r, direction }) =>
    mutate((p) => ({ project: shiftTask(p, r, direction), message: `${r}. satır ${direction === "in" ? "içeri" : "dışarı"} alındı.` })),
);

server.registerTool(
  "link_tasks",
  {
    title: "Görevleri bağla",
    description: "from_row görevini to_row görevinin öncülü yapar. lag iş günü (negatif = öne çekme). Aynı bağ varsa güncellenir.",
    inputSchema: { from_row: row, to_row: row, type: linkType.optional(), lag: z.number().int().optional() },
  },
  async (a) =>
    mutate((p) => ({
      project: linkTasks(p, a.from_row, a.to_row, a.type ?? "FS", a.lag ?? 0),
      message: `${a.from_row} → ${a.to_row} bağlandı (${a.type ?? "FS"}${a.lag ? `${a.lag > 0 ? "+" : ""}${a.lag}g` : ""}).`,
    })),
);

server.registerTool(
  "unlink_tasks",
  {
    title: "Bağı kaldır",
    description: "from_row → to_row bağını kaldırır.",
    inputSchema: { from_row: row, to_row: row },
  },
  async (a) => mutate((p) => ({ project: unlinkTasks(p, a.from_row, a.to_row), message: "Bağ kaldırıldı." })),
);

server.registerTool(
  "set_project",
  {
    title: "Proje ayarları",
    description: "Proje adını ve/veya başlangıç tarihini (YYYY-AA-GG) değiştirir.",
    inputSchema: { name: z.string().optional(), start: z.string().optional() },
  },
  async (a) =>
    mutate((p) => {
      if (a.start !== undefined && !isValidDate(a.start)) throw new OpError(`Geçersiz tarih: ${a.start}`);
      return { project: { ...p, name: a.name ?? p.name, start: a.start ?? p.start }, message: "Proje güncellendi." };
    }),
);

server.registerTool(
  "list_resources",
  {
    title: "Kaynakları listele",
    description:
      "Kaynaklar: kapasite (%), günlük ücret, toplam iş (adam-gün), maliyet, en yüksek yük ve kapasitenin aşıldığı tarih aralıkları " +
      "ile o günlerde çalışan görevlerin satırları. Aşırı yükü çözmek için level_resources ile öneri al (önizleme), ya da görevi kaydır, birimi düşür, kapasiteyi artır.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => run(() => listResources(load())),
);

server.registerTool(
  "set_resource",
  {
    title: "Kaynak ekle / güncelle",
    description:
      "Adına göre kaynağı günceller, yoksa ekler. max_units kapasite yüzdesi (100 = bir kişi, 300 = üç kişilik ekip). " +
      "type: work (işgücü), equipment (ekipman), material (malzeme; görevde 'Beton[12.5]' miktar yazılır, rate birim fiyattır). " +
      "rate_type: day (gün başına, varsayılan), hour (saat başına), use (kullanım başına). " +
      "workdays kaynağın kendi çalışma günleri (0 = pazar … 6 = cumartesi; [] proje takvimine döner); leaves izinler (listeyi değiştirir).",
    inputSchema: {
      name: z.string().min(1),
      new_name: z.string().optional().describe("Yeniden adlandırmak için"),
      max_units: z.number().min(1).optional(),
      rate: z.number().min(0).optional(),
      type: z.enum(["work", "equipment", "material"]).optional(),
      rate_type: z.enum(["day", "hour", "use"]).optional(),
      unit_label: z.string().optional().describe("Malzeme birimi (m³, ton …)"),
      workdays: z.array(z.number().int().min(0).max(6)).optional(),
      leaves: z.array(dateRange).optional().describe("İzin aralıkları [{from, to, name?}] YYYY-AA-GG"),
    },
  },
  async (a) =>
    mutate((p) => {
      const { project, created } = setResource(p, {
        name: a.name,
        newName: a.new_name,
        maxUnits: a.max_units,
        rate: a.rate,
        type: a.type,
        rateType: a.rate_type,
        unitLabel: a.unit_label,
        workdays: a.workdays,
        leaves: a.leaves,
      });
      return { project, message: created ? `"${a.name}" kaynağı eklendi.` : `"${a.name}" kaynağı güncellendi.` };
    }),
);

server.registerTool(
  "delete_resource",
  {
    title: "Kaynağı sil",
    description: "Kaynağı ve görevlerdeki atamalarını siler.",
    inputSchema: { name: z.string().min(1) },
    annotations: { destructiveHint: true },
  },
  async (a) =>
    mutate((p) => {
      const { project, unassigned } = deleteResource(p, a.name);
      return { project, message: `"${a.name}" silindi; ${unassigned} görevden ataması kaldırıldı.` };
    }),
);

const weightArg = z
  .enum(["cost", "work", "duration"])
  .describe("İlerleme ağırlığı: cost = maliyet (varsayılan), work = iş (adam-gün), duration = süre (iş günü)");

server.registerTool(
  "get_progress_curve",
  {
    title: "S eğrisi ve maliyet eğrisi",
    description:
      "Planlanan kümülatif ilerleme (%) ve maliyet; noktalar proje başlangıcı, her cuma, proje bitişi ve bugündür. " +
      "Planlanan %, gerçekleşen % ve sapma projenin ilerleme ağırlığıyla (varsayılan maliyet) hesaplanır; kazanılan değer ₺'dir.",
    inputSchema: {
      today: z.string().optional().describe("YYYY-AA-GG; varsayılan bugün"),
      weight: weightArg.optional().describe("Verilmezse projenin ayarı (set_calendar ile değişir)"),
    },
    annotations: { readOnlyHint: true },
  },
  async (a) =>
    run(() => {
      const p = load();
      const s = schedule(p);
      const today = a.today && isValidDate(a.today) ? a.today : formatDate(new Date());
      const c = progressCurves(p, s, today, a.weight ?? projectWeight(p));
      const at = Math.min(Math.max(c.todayDay, -1), s.finish - 1);
      const plannedToday = at < 0 ? 0 : plannedAt(c, at);
      const plannedCostToday = at < 0 ? 0 : c.points[at + 1]?.cost ?? 0;
      const r1 = (n: number) => Math.round(n * 10) / 10;
      return {
        today,
        progressWeight: c.weight,
        totalCost: Math.round(c.totalCost),
        plannedPercentToday: r1(plannedToday),
        actualPercent: r1(c.earnedPercent),
        variancePercent: r1(c.earnedPercent - plannedToday),
        plannedCostToday: Math.round(plannedCostToday),
        earnedValue: Math.round(c.earnedCost),
        warnings: progressWarnings(c, a.weight ?? projectWeight(p)),
        curve: curveSamples(c, s, today).map((x) => ({
          date: x.date,
          plannedPercent: Math.round(x.plannedPercent * 100) / 100,
          plannedCost: Math.round(x.plannedCost),
        })),
      };
    }),
);

server.registerTool(
  "set_calendar",
  {
    title: "Proje takvimi ayarları",
    description:
      "Haftanın çalışılan günlerini, ilerleme ağırlığını, arifelerin yarım gün sayılmasını, genel gider yüzdesini ve saatlik ücret için " +
      "günlük saati değiştirir. workdays: 0 = pazar, 1 = pazartesi … 6 = cumartesi (ör. Pzt–Cmt için [1,2,3,4,5,6]).",
    inputSchema: {
      workdays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
      progress_weight: weightArg.optional(),
      half_day_mode: z.enum(["full", "half"]).optional().describe("full: arife iş günü (yalnızca işaret); half: yarım gün kapasite"),
      overhead_percent: z.number().min(0).max(1000).optional().describe("Görev maliyetlerine eklenen genel gider %"),
      hours_per_day: z.number().min(0.5).max(24).optional().describe("Saatlik ücretli kaynaklar için günlük saat (varsayılan 8)"),
    },
  },
  async (a) =>
    mutate((p) => {
      const next: Project = {
        ...p,
        ...(a.workdays ? { workdays: normalizeWorkdays(a.workdays) } : {}),
        ...(a.progress_weight ? { progressWeight: a.progress_weight } : {}),
        ...(a.half_day_mode ? { halfDayMode: a.half_day_mode } : {}),
        ...(a.overhead_percent !== undefined ? { overheadPercent: a.overhead_percent } : {}),
        ...(a.hours_per_day !== undefined ? { hoursPerDay: a.hours_per_day } : {}),
      };
      return { project: next, message: "Takvim ayarları güncellendi." };
    }),
);

server.registerTool(
  "add_turkish_holidays",
  {
    title: "Türkiye tatillerini ekle",
    description:
      "Proje başlangıç yılından itibaren 4 yılın seçilen Türkiye tatillerini ekler; var olan tatillere dokunmaz. " +
      "Dini bayram verisi yalnızca Diyanet takviminden girilmiş yıllar içindir; diğer yıllar set_holiday ile kullanıcıya sorularak girilmeli.",
    inputSchema: {
      official: z.boolean().optional().describe("Sabit resmî tatiller; varsayılan true"),
      religious: z.boolean().optional().describe("Ramazan ve Kurban bayramları; varsayılan true"),
      half_days: z.boolean().optional().describe("Arifeleri yarım gün olarak işaretle; varsayılan false"),
    },
  },
  async (a) =>
    mutate((p) => {
      const y = Number(p.start.slice(0, 4));
      const incoming = turkishHolidays(y, y + 3, {
        official: a.official ?? true,
        religious: a.religious ?? true,
        halfDays: a.half_days ?? false,
      });
      const holidays = mergeHolidays(p.holidays, incoming);
      const missing = a.religious === false ? [] : yearsWithoutReligiousData(y, y + 3);
      return {
        project: { ...p, holidays },
        message:
          `${holidays.length - p.holidays.length} tatil eklendi.` +
          (missing.length ? ` ${missing.join(", ")} için dini bayram verisi yok; tarihleri kullanıcıdan alıp set_holiday ile ekleyin.` : ""),
      };
    }),
);

server.registerTool(
  "list_holidays",
  {
    title: "Tatilleri listele",
    description: "Projenin çalışılmayan günleri (hafta sonları dışında).",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => run(() => load().holidays),
);

server.registerTool(
  "set_holiday",
  {
    title: "Tatil ekle / kaldır",
    description:
      "Tarihi tatil olarak ekler (remove=true ise kaldırır). Görevler tam gün tatilleri atlar; half_day (arife) set_calendar half_day_mode=half ise yarım gün sayılır, değilse yalnızca işarettir.",
    inputSchema: {
      date: z.string().describe("YYYY-AA-GG"),
      name: z.string().optional(),
      remove: z.boolean().optional(),
      half_day: z.boolean().optional().describe("Yarım gün (arife)"),
    },
  },
  async (a) =>
    mutate((p) => {
      if (!isValidDate(a.date)) throw new OpError(`Geçersiz tarih: ${a.date}`);
      const rest = p.holidays.filter((h) => h.date !== a.date);
      const holidays = a.remove ? rest : [...rest, { date: a.date, name: a.name ?? "Tatil", ...(a.half_day ? { halfDay: true } : {}) }];
      holidays.sort((x, y) => x.date.localeCompare(y.date));
      return { project: { ...p, holidays }, message: a.remove ? `${a.date} tatilden çıkarıldı.` : `${a.date} tatil olarak eklendi.` };
    }),
);

server.registerTool(
  "set_blackout",
  {
    title: "Çalışılamayan dönem",
    description:
      "Adlı çalışılamayan dönem ekler/günceller (ör. 'Kış' 2026-12-15 – 2027-02-28; dış işler durur) ya da remove=true ile siler. " +
      "Dönem yalnızca update_task blackouts ile seçilen görevlere uygulanır.",
    inputSchema: { name: z.string().min(1), from: z.string().optional(), to: z.string().optional(), remove: z.boolean().optional() },
  },
  async (a) =>
    mutate((p) => {
      const list = p.blackouts ?? [];
      const key = a.name.trim().toLocaleLowerCase("tr");
      const existing = list.find((b) => b.name.toLocaleLowerCase("tr") === key);
      if (a.remove) {
        if (!existing) throw new OpError(t("err.noBlackout", { name: a.name }));
        const blackouts = list.filter((b) => b !== existing);
        const tasks = p.tasks.map((x) => (x.blackouts?.includes(existing.id) ? { ...x, blackouts: x.blackouts.filter((id) => id !== existing.id) } : x));
        return { project: { ...p, blackouts, tasks }, message: `"${a.name}" dönemi silindi.` };
      }
      if (!a.from || !isValidDate(a.from) || (a.to !== undefined && !isValidDate(a.to))) throw new OpError(t("err.date", { date: `${a.from ?? ""} ${a.to ?? ""}`.trim(), pattern: "YYYY-MM-DD" }));
      const to = a.to ?? a.from;
      const [from, until] = a.from <= to ? [a.from, to] : [to, a.from];
      let n = list.length + 1;
      while (list.some((b) => b.id === `b${n}`)) n++;
      const item = { id: existing?.id ?? `b${n}`, name: a.name.trim(), from, to: until };
      return {
        project: { ...p, blackouts: existing ? list.map((b) => (b === existing ? item : b)) : [...list, item] },
        message: `"${a.name}" dönemi ${from} – ${until} olarak kaydedildi.`,
      };
    }),
);

server.registerTool(
  "save_baseline",
  {
    title: "Referans plan kaydet",
    description: "Planın şimdiki tarihlerini, sürelerini ve maliyetlerini 1–3 numaralı referans plana (baseline) kaydeder; varsa üzerine yazar.",
    inputSchema: {
      number: z.number().int().min(1).max(BASELINE_SLOTS).optional().describe("1–3; varsayılan 1"),
      name: z.string().optional(),
      clear: z.boolean().optional().describe("true ise bu referans planı siler"),
    },
  },
  async (a) =>
    mutate((p) => {
      const i = (a.number ?? 1) - 1;
      if (a.clear) return { project: clearBaseline(p, i), message: `Referans plan ${i + 1} silindi.` };
      return { project: saveBaseline(p, schedule(p), i, formatDate(new Date()), a.name), message: `Referans plan ${i + 1} kaydedildi.` };
    }),
);

server.registerTool(
  "get_baseline_variance",
  {
    title: "Referans plana göre sapma",
    description: "Her görevin referans plandaki başlangıç/bitişi ve güncel plana göre sapması (proje iş günü; pozitif = gecikme), süre ve maliyet farkı.",
    inputSchema: { number: z.number().int().min(1).max(BASELINE_SLOTS).optional().describe("1–3; varsayılan 1") },
    annotations: { readOnlyHint: true },
  },
  async (a) =>
    run(() => {
      const p = load();
      const s = schedule(p);
      const i = (a.number ?? 1) - 1;
      const b = getBaseline(p, i);
      if (!b) throw new OpError(`Referans plan ${i + 1} kayıtlı değil (save_baseline ile kaydedin).`);
      const v = baselineVariance(p, s, i);
      return {
        baseline: b.name,
        savedAt: b.savedAt,
        baselineFinish: b.finish,
        currentFinish: s.finishDate,
        tasks: p.tasks.flatMap((x, k) => {
          const d = v.get(x.id);
          if (!d) return [];
          return [{ row: k + 1, name: x.name, baselineStart: b.tasks[x.id].start, baselineFinish: b.tasks[x.id].finish, start: s.rows[k].startDate, finish: s.rows[k].finishDate, startVarianceDays: d.start, finishVarianceDays: d.finish, durationVariance: d.duration, costVariance: Math.round(d.cost) }];
        }),
      };
    }),
);

server.registerTool(
  "level_resources",
  {
    title: "Kaynak seviyeleme",
    description:
      "Aşırı yüklü kaynaklar için üç çözüm önerir: delay (bolluğu fazla görevi geciktir), units (birimi düşür, süre uzar), capacity (kapasiteyi artır). " +
      "apply verilmezse yalnızca önizleme döner (dosya değişmez); kullanıcı onaylarsa apply ile seçilen çözüm uygulanır. clear=true seviyeleme gecikmelerini siler.",
    inputSchema: {
      apply: z.enum(["delay", "units", "capacity"]).optional(),
      clear: z.boolean().optional(),
    },
  },
  async (a) => {
    if (a.clear) return mutate((p) => ({ project: clearLeveling(p), message: "Seviyeleme gecikmeleri silindi." }));
    if (a.apply) {
      return mutate((p) => {
        const option = proposeLeveling(p).find((o) => o.kind === a.apply);
        if (!option) throw new OpError("Aşırı yüklü kaynak yok; seviyeleme gerekmiyor.");
        return { project: option.project, message: `Seviyeleme (${a.apply}) uygulandı: ${option.changes.length} değişiklik, bitiş ${option.finishBefore} → ${option.finishAfter}.` };
      });
    }
    return run(() => {
      const p = load();
      const over = overallocations(p);
      if (!over.length) return "Aşırı yüklü kaynak yok.";
      return {
        overallocated: over,
        options: proposeLeveling(p).map((o) => ({
          strategy: o.kind,
          finishBefore: o.finishBefore,
          finishAfter: o.finishAfter,
          costBefore: Math.round(o.costBefore),
          costAfter: Math.round(o.costAfter),
          remainingOverallocated: o.remainingOver,
          changes: o.changes,
        })),
        note: "Önizlemedir; uygulamak için kullanıcıya sorup level_resources apply ile çağırın.",
      };
    });
  },
);

server.registerTool(
  "export_msproject_xml",
  {
    title: "MS Project XML olarak kaydet",
    description: "Projeyi MS Project'te açılabilen XML dosyası olarak verilen yola yazar.",
    inputSchema: { path: z.string().describe("Hedef .xml dosya yolu") },
  },
  async ({ path }) =>
    run(() => {
      const p = load();
      const target = resolve(path);
      writeFileSync(target, toMspXml(p, schedule(p)), "utf8");
      return `MS Project XML yazıldı: ${target}`;
    }),
);

// Dosya yoksa boş proje olarak oluşturulur: uygulamada "Dosyaya bağla" ile hemen açılabilsin
try {
  if (!existsSync(file)) save(emptyProject(formatDate(new Date())));
} catch (e) {
  console.error(`Proje dosyası oluşturulamadı (${file}): ${(e as Error).message}`);
}

await server.connect(new StdioServerTransport());
console.error(`proje-planlayici MCP hazır: ${file}`);
