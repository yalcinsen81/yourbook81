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
import { CONSTRAINT_TYPES, needsUpgradeBackup, safeUrl, sanitizeProject, toTags } from "../src/model/storage";
import { baselineVariance, clearBaseline, getBaseline, saveBaseline } from "../src/model/baseline";
import { clearLeveling, overallocations, proposeLeveling } from "../src/model/leveling";
import { detectLang, setLocale, t } from "../src/i18n";
import { BASELINE_SLOTS, TASK_COLORS, type Project, type Task } from "../src/model/types";
import { buildReport, earnedValue, REPORT_KINDS, type ReportTable } from "../src/model/reports";
import { guessMapping, importTasks, parseCsv, reportToCsv, reportToSheet } from "../src/model/tabular";
import { readXlsx, writeXlsx } from "../src/model/xlsx";
import { applyTemplate, BUILTIN_TEMPLATES } from "../src/model/templates";
import { exposure, MAX_ITERATIONS, newRiskId, removeRisk, riskChance, riskLevel, toSimulation, upsertRisk, validEstimate } from "../src/model/risks";
import { resultIsCurrent, settingsOf, simulate } from "../src/model/simulation";
import { planQuality } from "../src/model/quality";
import { RISK_RESPONSES, RISK_STATUSES, type Risk, type SimulationSettings, type SimulationSummary } from "../src/model/types";

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
const extraArgs = {
  notes: z.string().optional().describe("Görev notu (boş metin siler)"),
  tags: z.string().optional().describe("Etiketler, virgül ya da ';' ile: 'dış iş, beton'. Boş metin hepsini siler; listeyi değiştirir."),
  color: z.enum(["none", ...TASK_COLORS] as [string, ...string[]]).optional().describe("Satır/çubuk rengi; none kaldırır"),
  links: z
    .array(z.object({ url: z.string(), title: z.string().optional() }))
    .optional()
    .describe("Bağlantı ekleri (http/https/mailto/file); listeyi değiştirir, [] kaldırır"),
  actual_cost: z.number().min(0).optional().describe("Gerçekleşen maliyet (kazanılmış değerde AC); negatif olamaz, 0 kaldırır"),
};
type Extras = { notes?: string; tags?: string; color?: string; links?: { url: string; title?: string }[]; actual_cost?: number };

/** Not, etiket, renk, bağlantı ve gerçekleşen maliyeti satıra uygular */
function applyExtras(p: Project, r: number, a: Extras): Project {
  if (a.notes === undefined && a.tags === undefined && a.color === undefined && a.links === undefined && a.actual_cost === undefined) return p;
  const old = p.tasks[r - 1];
  if (!old) throw new OpError(t("err.noRow", { row: String(r), count: p.tasks.length }));
  const task: Task = { ...old };
  if (a.notes !== undefined) {
    if (a.notes.trim()) task.notes = a.notes.slice(0, 20000);
    else delete task.notes;
  }
  if (a.tags !== undefined) {
    const tags = toTags(a.tags);
    if (tags) task.tags = tags;
    else delete task.tags;
  }
  if (a.color !== undefined) {
    if (a.color === "none") delete task.color;
    else task.color = a.color as Task["color"];
  }
  if (a.links !== undefined) {
    const bad = a.links.find((l) => !safeUrl(l.url));
    if (bad) throw new OpError(`${t("err.linkUrl")} (${bad.url})`);
    const links = a.links.map((l) => ({ url: safeUrl(l.url)!, ...(l.title?.trim() ? { title: l.title.trim() } : {}) }));
    if (links.length) task.links = links;
    else delete task.links;
  }
  if (a.actual_cost !== undefined) {
    if (a.actual_cost > 0) task.actualCost = Math.round(a.actual_cost * 100) / 100;
    else delete task.actualCost;
  }
  return { ...p, tasks: p.tasks.map((x, i) => (i === r - 1 ? task : x)) };
}

const today = (d?: string) => (d && isValidDate(d) ? d : formatDate(new Date()));

/** Rapor tablosunu Claude için satır nesnelerine çevirir */
function tableRows(table: ReportTable) {
  const conv = (row: Record<string, unknown>) => Object.fromEntries(table.columns.map((c) => [c.label, row[c.key] ?? null]));
  return { rows: table.rows.map(conv), ...(table.total ? { total: conv(table.total) } : {}), ...(table.notes?.length ? { notes: table.notes } : {}) };
}

const dateRange = z.object({ from: z.string(), to: z.string(), name: z.string().optional() });

const server = new McpServer({ name: "proje-planlayici", version: "0.8.0" });

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
      ...extraArgs,
      resources: resourcesArg,
    },
  },
  async (a) =>
    mutate((p) => {
      const { project: added, row: r } = addTask(p, {
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
      return { project: applyExtras(added, r, a), message: `"${a.name}" ${r}. satıra eklendi.` };
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
      ...extraArgs,
      resources: resourcesArg,
    },
  },
  async (a) =>
    mutate((p) => ({
      project: applyExtras(updateTask(p, a.row, {
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
      }), a.row, a),
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

const baselineArg = z.number().int().min(1).max(BASELINE_SLOTS).optional().describe("Karşılaştırılacak referans plan 1–3; varsayılan ilk kayıtlı");

server.registerTool(
  "get_earned_value",
  {
    title: "Kazanılmış değer (EVM)",
    description:
      "Bugünün sonu itibarıyla BAC, PV, EV, AC, SV, CV, SPI, CPI, EAC, ETC, VAC. PV referans plandan (yoksa güncel plandan); " +
      "gerçekleşen maliyeti girilmemiş başlamış görevlerde AC = EV sayılır (acEstimatedRows). SPI/CPI < 1 gecikme/aşım demektir.",
    inputSchema: { today: z.string().optional().describe("YYYY-AA-GG; varsayılan bugün"), baseline: baselineArg },
    annotations: { readOnlyHint: true },
  },
  async (a) =>
    run(() => {
      const p = load();
      return earnedValue(p, schedule(p), today(a.today), a.baseline !== undefined ? a.baseline - 1 : undefined);
    }),
);

const reportArgs = {
  kind: z
    .enum(REPORT_KINDS as [string, ...string[]])
    .describe(
      "evm, scurve (S eğrisi), critical (kritik yol), resources, histogram (kaynak yükü), cashflow (nakit akışı), tasks (görev listesi), milestones, " +
        "risks (risk sicili), simulation (son benzetim özeti), quality (plan kalite denetimi)",
    ),
  period: z.enum(["month", "week"]).optional().describe("Nakit akışı dönemi; varsayılan month"),
  baseline: baselineArg,
  today: z.string().optional().describe("YYYY-AA-GG; varsayılan bugün"),
};
type ReportArgs = { kind: string; period?: "month" | "week"; baseline?: number; today?: string };

function reportOf(a: ReportArgs): ReportTable {
  const p = load();
  return buildReport(a.kind as (typeof REPORT_KINDS)[number], p, schedule(p), {
    today: today(a.today),
    period: a.period ?? "month",
    baselineIndex: a.baseline !== undefined ? a.baseline - 1 : undefined,
  });
}

server.registerTool(
  "get_report",
  {
    title: "Rapor",
    description: "Uygulamanın Raporlar görünümündeki tabloyu satır nesneleri olarak döner (sütun adları seçili dilde).",
    inputSchema: reportArgs,
    annotations: { readOnlyHint: true },
  },
  async (a) =>
    run(() => {
      const table = reportOf(a);
      return { title: table.title, ...tableRows(table) };
    }),
);

server.registerTool(
  "export_report",
  {
    title: "Raporu dosyaya yaz",
    description: "Raporu .csv (Excel'in dil ayarına uygun ayraçla) ya da .xlsx olarak verilen yola yazar; biçim uzantıdan anlaşılır.",
    inputSchema: { ...reportArgs, path: z.string().describe("Hedef .csv ya da .xlsx dosya yolu") },
  },
  async (a) =>
    run(() => {
      const table = reportOf(a);
      const target = resolve(expandPath(a.path));
      if (/\.xlsx$/i.test(target)) writeFileSync(target, writeXlsx([reportToSheet(table)]));
      else if (/\.csv$/i.test(target)) writeFileSync(target, reportToCsv(table), "utf8");
      else throw new OpError("Uzantı .csv ya da .xlsx olmalı.");
      return `${table.title}: ${table.rows.length} satır yazıldı → ${target}`;
    }),
);

server.registerTool(
  "new_from_template",
  {
    title: "Şablondan yeni proje",
    description:
      `Proje dosyasını hazır şablonla DEĞİŞTİRİR (görevler ve kaynaklar; tatiller ve takvim korunur). Şablonlar: ${BUILTIN_TEMPLATES.map((x) => x.id).join(", ")}. ` +
      "Var olan görevler silineceği için önce kullanıcıya sorun.",
    inputSchema: {
      template: z.enum(BUILTIN_TEMPLATES.map((x) => x.id) as [string, ...string[]]),
      name: z.string().optional().describe("Proje adı"),
      start: z.string().optional().describe("Başlangıç YYYY-AA-GG; varsayılan mevcut başlangıç"),
    },
    annotations: { destructiveHint: true },
  },
  async (a) =>
    mutate((p) => {
      if (a.start !== undefined && !isValidDate(a.start)) throw new OpError(`Geçersiz tarih: ${a.start}`);
      const tpl = BUILTIN_TEMPLATES.find((x) => x.id === a.template)!;
      const base: Project = { ...p, tasks: [], resources: [], baselines: undefined, name: a.name ?? p.name, start: a.start ?? p.start };
      const project = applyTemplate(base, tpl);
      return { project, message: `"${a.template}" şablonundan ${project.tasks.length} görev oluşturuldu.` };
    }),
);

server.registerTool(
  "import_tasks",
  {
    title: "CSV / Excel'den görev al",
    description:
      "CSV ya da .xlsx dosyasından görev alır. İlk satır başlıktır; sütunlar başlıktan tanınır (Ad/Name, Süre/Duration, Başlangıç/Start, Bitiş/Finish, " +
      "Öncüller/Predecessors, Kaynaklar/Resource Names, % Tamamlanan, Anahat düzeyi/Outline Level, WBS, Notlar, Etiketler). " +
      "mode=replace mevcut görevleri siler (önce kullanıcıya sorun); varsayılan append sona ekler.",
    inputSchema: { path: z.string(), mode: z.enum(["append", "replace"]).optional() },
  },
  async (a) => {
    const target = resolve(expandPath(a.path));
    let table: string[][];
    try {
      table = /\.xlsx$/i.test(target) ? await readXlsx(new Uint8Array(readFileSync(target))) : parseCsv(readFileSync(target, "utf8").replace(/^\uFEFF/, ""));
    } catch (e) {
      return { content: [{ type: "text" as const, text: `Dosya okunamadı: ${(e as Error).message}` }], isError: true };
    }
    return mutate((p) => {
      if (!table.length) throw new OpError("Dosya boş.");
      const mapping = guessMapping(table[0]);
      const r = importTasks(p, table, mapping, { hasHeader: true, mode: a.mode ?? "append" });
      if (!r.imported) throw new OpError(`Görev alınamadı. ${r.problems.map((x) => `${x.line}: ${x.message}`).join(" ")}`);
      const notes = r.problems.length ? `\nSorunlar: ${r.problems.map((x) => `satır ${x.line}: ${x.message}`).join("; ")}` : "";
      return { project: r.project, message: `${r.imported} görev alındı (sütunlar: ${mapping.join(", ")}).${notes}` };
    });
  },
);

// --- Riskler ve Monte Carlo benzetimi (Faz 2D) ---

/** Risk: satır numaraları ve görev adlarıyla, okunur biçimde */
function riskView(p: Project, r: Risk) {
  const index = new Map(p.tasks.map((x, i) => [x.id, i]));
  return {
    id: r.id,
    title: r.title,
    ...(r.category ? { category: r.category } : {}),
    ...(r.owner ? { owner: r.owner } : {}),
    ...(r.description ? { description: r.description } : {}),
    probability: r.probability,
    impact: r.impact,
    exposure: exposure(r),
    level: riskLevel(exposure(r)),
    chancePercent: Math.round(riskChance(r) * 1000) / 10,
    chanceFromScore: r.chance === undefined,
    ...(r.response ? { response: r.response } : {}),
    ...(r.mitigation ? { mitigation: r.mitigation } : {}),
    status: r.status,
    ...(r.review ? { review: r.review } : {}),
    tasks: r.tasks.map((x) => ({ row: (index.get(x.taskId) ?? -1) + 1, name: p.tasks[index.get(x.taskId) ?? -1]?.name ?? "", days: x.days, cost: x.cost })),
  };
}

/** Benzetim özeti: grafik noktaları çıkarılmış, görevler satır adıyla */
function simView(p: Project, r: SimulationSummary) {
  const index = new Map(p.tasks.map((x, i) => [x.id, i]));
  const name = (id: string) => {
    const i = index.get(id);
    return i === undefined ? { row: null, name: "(silinmiş)" } : { row: i + 1, name: p.tasks[i].name };
  };
  return {
    current: resultIsCurrent(p),
    ranAt: r.at,
    iterations: r.iterations,
    seed: r.seed,
    distribution: r.distribution,
    plan: { finish: r.planFinish, cost: r.planCost },
    onTimeProbability: r.onTime,
    onBudgetProbability: r.onBudget,
    finish: r.finish,
    cost: r.cost,
    finishCurve: r.finishCdf.filter((_, i, a) => a.length <= 20 || i % Math.ceil(a.length / 20) === 0 || i === a.length - 1),
    drivers: [...r.tasks]
      .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
      .slice(0, 10)
      .map((x) => ({ ...name(x.id), criticality: x.criticality, correlation: x.correlation })),
    risks: r.risks.map((x) => ({ id: x.id, title: p.risks?.find((k) => k.id === x.id)?.title ?? "", occurred: x.triggered, finishDelayWorkdays: x.delay, cost: x.cost })),
  };
}

server.registerTool(
  "list_risks",
  {
    title: "Risk sicili",
    description:
      "Riskleri maruziyete (olasılık × etki, 1–25) göre sıralı döner: düzey (low/medium/high/critical), benzetimde kullanılan gerçekleşme yüzdesi, " +
      "yanıt, durum ve bağlı görevlere ek gün/maliyet. Kapananlar include_closed=true ile gelir.",
    inputSchema: { include_closed: z.boolean().optional() },
    annotations: { readOnlyHint: true },
  },
  async (a) =>
    run(() => {
      const p = load();
      return (p.risks ?? [])
        .filter((r) => a.include_closed || r.status !== "closed")
        .sort((x, y) => exposure(y) - exposure(x))
        .map((r) => riskView(p, r));
    }),
);

server.registerTool(
  "set_risk",
  {
    title: "Risk ekle / değiştir",
    description:
      "id verilmezse yeni risk ekler (R1, R2…). Verilen alanlar değişir, verilmeyenler korunur. Olasılık ve etki 1–5 puan; " +
      "chance (0–100) verilmezse olasılık puanından alınır (1→%10, 2→%30, 3→%50, 4→%70, 5→%90). " +
      "tasks listesi bağlı görevleri DEĞİŞTİRİR: her biri satır, ek iş günü ve ek maliyet (risk gerçekleşirse göreve eklenir). Özet satırlar bağlanamaz.",
    inputSchema: {
      id: z.string().optional().describe("Var olan riskin kimliği (ör. R2); yoksa yeni risk"),
      title: z.string().optional().describe("Risk adı (yeni riskte gerekli)"),
      category: z.string().optional().describe("Kategori; boş metin kaldırır"),
      owner: z.string().optional().describe("Sorumlu; boş metin kaldırır"),
      description: z.string().optional(),
      probability: z.number().int().min(1).max(5).optional(),
      impact: z.number().int().min(1).max(5).optional(),
      chance: z.number().min(0).max(100).nullable().optional().describe("Gerçekleşme yüzdesi; null puandan hesaplanana döner"),
      response: z.enum(["none", ...RISK_RESPONSES] as [string, ...string[]]).optional().describe("avoid (kaçın), mitigate (azalt), transfer (aktar), accept (kabul); none kaldırır"),
      mitigation: z.string().optional().describe("Önlem planı; boş metin kaldırır"),
      status: z.enum(RISK_STATUSES as [string, ...string[]]).optional().describe("open, watch (izleniyor), closed (benzetime katılmaz)"),
      review: z.string().optional().describe("Gözden geçirme tarihi YYYY-AA-GG; boş metin kaldırır"),
      tasks: z
        .array(z.object({ row, days: z.number().min(0).max(10000).optional(), cost: z.number().min(0).optional() }))
        .optional()
        .describe("Etkilenen görevler: [{row: 3, days: 5, cost: 20000}]; [] tüm bağları kaldırır"),
    },
  },
  async (a) =>
    mutate((p) => {
      const old = a.id ? p.risks?.find((r) => r.id === a.id) : undefined;
      if (a.id && !old) throw new OpError(`Risk bulunamadı: ${a.id}. Kimlikler: ${(p.risks ?? []).map((r) => r.id).join(", ") || "(yok)"}`);
      if (!old && !a.title?.trim()) throw new OpError("Yeni risk için title gerekli.");
      if (a.review && !isValidDate(a.review)) throw new OpError(`Geçersiz tarih: ${a.review}`);
      const s = schedule(p);
      const tasks = a.tasks?.map((x) => {
        const i = x.row - 1;
        if (!p.tasks[i]) throw new OpError(t("err.noRow", { row: String(x.row), count: p.tasks.length }));
        if (s.rows[i].isSummary) throw new OpError(`${x.row}. satır özet görev; riski alt görevlerine bağlayın.`);
        return { taskId: p.tasks[i].id, days: x.days ?? 0, cost: x.cost ?? 0 };
      });
      if (tasks && new Set(tasks.map((x) => x.taskId)).size !== tasks.length) throw new OpError("Aynı satır iki kez verilmiş.");
      const risk: Risk = { ...(old ?? { id: newRiskId(p), title: "", probability: 3, impact: 3, status: "open", tasks: [] }) };
      const text = (k: "title" | "category" | "owner" | "description" | "mitigation", v: string | undefined) => {
        if (v === undefined) return;
        if (v.trim()) risk[k] = v.trim();
        else if (k !== "title") delete risk[k];
      };
      text("title", a.title);
      text("category", a.category);
      text("owner", a.owner);
      text("description", a.description);
      text("mitigation", a.mitigation);
      if (a.probability !== undefined) risk.probability = a.probability;
      if (a.impact !== undefined) risk.impact = a.impact;
      if (a.chance === null) delete risk.chance;
      else if (a.chance !== undefined) risk.chance = a.chance;
      if (a.response === "none") delete risk.response;
      else if (a.response) risk.response = a.response as Risk["response"];
      if (a.status) risk.status = a.status as Risk["status"];
      if (a.review !== undefined) {
        if (a.review) risk.review = a.review;
        else delete risk.review;
      }
      if (tasks) risk.tasks = tasks;
      const project = upsertRisk(p, risk);
      const saved = project.risks!.find((r) => r.id === risk.id)!;
      return { project, message: `${old ? "Risk güncellendi" : "Risk eklendi"}: ${JSON.stringify(riskView(project, saved))}` };
    }),
);

server.registerTool(
  "delete_risk",
  {
    title: "Riski sil",
    description: "Riski sicilden siler. Geçmişte tutmak için silmek yerine status=closed tercih edin.",
    inputSchema: { id: z.string() },
    annotations: { destructiveHint: true },
  },
  async (a) =>
    mutate((p) => {
      const r = p.risks?.find((x) => x.id === a.id);
      if (!r) throw new OpError(`Risk bulunamadı: ${a.id}`);
      return { project: removeRisk(p, a.id), message: `${a.id} "${r.title}" silindi.` };
    }),
);

server.registerTool(
  "set_task_estimates",
  {
    title: "Üç nokta süre tahmini",
    description:
      "Görevin iyimser / en olası / kötümser süresini (iş günü) yazar; benzetim bu görevde genel belirsizlik yerine bunu kullanır. " +
      "0 ≤ iyimser ≤ en olası ≤ kötümser olmalı. clear=true tahmini kaldırır. Görevin planlanan süresi değişmez.",
    inputSchema: {
      row,
      optimistic: z.number().min(0).optional(),
      likely: z.number().min(0).optional().describe("Verilmezse görevin planlanan süresi"),
      pessimistic: z.number().min(0).optional(),
      clear: z.boolean().optional(),
    },
  },
  async (a) =>
    mutate((p) => {
      const i = a.row - 1;
      const task = p.tasks[i];
      if (!task) throw new OpError(t("err.noRow", { row: String(a.row), count: p.tasks.length }));
      const s = schedule(p);
      if (s.rows[i].isSummary || task.duration <= 0) throw new OpError(`${a.row}. satır özet ya da kilometre taşı; tahmin yalnız süreli görevlere yazılır.`);
      const next: Task = { ...task };
      if (a.clear) delete next.estimate;
      else {
        if (a.optimistic === undefined || a.pessimistic === undefined) throw new OpError("optimistic ve pessimistic gerekli (ya da clear=true).");
        const e = { optimistic: a.optimistic, likely: a.likely ?? task.duration, pessimistic: a.pessimistic };
        if (!validEstimate(e)) throw new OpError(t("err.estimate"));
        next.estimate = e;
      }
      const project = { ...p, tasks: p.tasks.map((x, j) => (j === i ? next : x)) };
      return { project, message: a.clear ? `${a.row}. satırın tahmini kaldırıldı.` : `${a.row}. satır tahmini: ${JSON.stringify(next.estimate)}` };
    }),
);

server.registerTool(
  "run_simulation",
  {
    title: "Monte Carlo benzetimi",
    description:
      "Görev sürelerini dağılımdan çekip (tahmini olmayanlarda genel belirsizlik −low% / +high%), riskleri olasılıklarına göre gerçekleştirip planı " +
      "her yinelemede yeniden hesaplar. P10–P95 bitiş tarihi ve maliyet, plan tarihinde/bütçesinde bitme olasılığı, bitişi en çok etkileyen görevler " +
      "(korelasyon, kritiklik indeksi) ve risklerin etkisini döner; ayarlar ve özet dosyaya kaydedilir (uygulamada Riskler sekmesinde görünür). " +
      "Tamamlanan görevler sabit, başlamışlarda yalnız kalan kısım değişir. Aynı tohum aynı sonucu verir. Büyük projede yineleme sayısını düşük tutun.",
    inputSchema: {
      iterations: z.number().int().min(100).max(MAX_ITERATIONS).optional().describe("Varsayılan kayıtlı ayar ya da 5000"),
      distribution: z.enum(["triangular", "pert"]).optional(),
      uncertainty_low: z.number().min(0).max(95).optional().describe("Genel belirsizlik eksi % (varsayılan 10)"),
      uncertainty_high: z.number().min(0).max(500).optional().describe("Genel belirsizlik artı % (varsayılan 25)"),
      seed: z.number().int().min(0).optional(),
      include_risks: z.boolean().optional(),
    },
  },
  async (a) =>
    mutate((p) => {
      const cur = settingsOf(p);
      const settings: SimulationSettings = toSimulation({
        iterations: a.iterations ?? cur.iterations,
        distribution: a.distribution ?? cur.distribution,
        uncertaintyLow: a.uncertainty_low ?? cur.uncertaintyLow,
        uncertaintyHigh: a.uncertainty_high ?? cur.uncertaintyHigh,
        seed: a.seed ?? cur.seed,
        includeRisks: a.include_risks ?? cur.includeRisks,
      })!;
      if (!p.tasks.length) throw new OpError("Projede görev yok.");
      const started = Date.now();
      const runResult = simulate({ ...p, simulation: settings }, settings)!;
      const project: Project = { ...p, simulation: settings, simResult: runResult.summary };
      return { project, message: `Benzetim ${((Date.now() - started) / 1000).toFixed(1)} sn sürdü.\n${JSON.stringify(simView(project, runResult.summary), null, 2)}` };
    }),
);

server.registerTool(
  "get_simulation",
  {
    title: "Son benzetim sonucu",
    description: "Kayıtlı son benzetim özetini ve ayarlarını döner; current=false ise proje ya da ayarlar sonradan değişmiştir (run_simulation ile yenileyin).",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () =>
    run(() => {
      const p = load();
      return { settings: settingsOf(p), result: p.simResult ? simView(p, p.simResult) : null };
    }),
);

server.registerTool(
  "check_plan_quality",
  {
    title: "Plan kalite denetimi",
    description:
      "DCMA 14 nokta denetiminin takvime dayalı maddeleri: eksik bağ, negatif/pozitif gecikme, BB dışı bağ, katı kısıt, yüksek/negatif bolluk, " +
      "44 iş gününden uzun görev, geçersiz tarih, kaynaksız görev, kaçırılan görev (referans plana göre). Her madde için sorunlu satırlar, oran ve eşik.",
    inputSchema: { today: z.string().optional().describe("YYYY-AA-GG; varsayılan bugün") },
    annotations: { readOnlyHint: true },
  },
  async (a) =>
    run(() => {
      const p = load();
      return planQuality(p, schedule(p), today(a.today)).map((c) => ({ check: c.key, name: t(`quality.${c.key}`), ...c }));
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
