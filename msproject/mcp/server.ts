// Proje Planlayıcı MCP sunucusu: Claude'un (Claude Desktop / Claude Code) diskteki proje dosyasını okuyup
// düzenlemesini sağlar. Uygulamada "Dosyaya bağla" ile aynı dosya açıkken değişiklikler ekrana anında yansır.
//
// Çalıştırma:  node mcp/dist/msproject-mcp.mjs <proje.json yolu>
// (ya da MSPROJECT_FILE ortam değişkeni)

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { formatDate, isValidDate } from "../src/model/calendar";
import { toMspXml } from "../src/model/mspXml";
import {
  addTask,
  deleteTask,
  linkTasks,
  listTasks,
  OpError,
  projectSummary,
  shiftTask,
  unlinkTasks,
  updateTask,
} from "../src/model/ops";
import { emptyProject } from "../src/model/sample";
import { schedule } from "../src/model/schedule";
import { sanitizeProject } from "../src/model/storage";
import type { Project } from "../src/model/types";

const file = resolve(process.argv[2] ?? process.env.MSPROJECT_FILE ?? "proje.json");

function load(): Project {
  if (!existsSync(file)) return emptyProject(formatDate(new Date()));
  const text = readFileSync(file, "utf8");
  if (!text.trim()) return emptyProject(formatDate(new Date()));
  const p = sanitizeProject(JSON.parse(text));
  if (!p) throw new OpError(`${file} geçerli bir proje dosyası değil.`);
  return p;
}

function save(p: Project): void {
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
const linkType = z.enum(["FS", "SS", "FF", "SF"]).describe("FS bitiş-başlangıç (varsayılan), SS, FF, SF");

const server = new McpServer({ name: "proje-planlayici", version: "0.1.0" });

server.registerTool(
  "get_project_summary",
  {
    title: "Proje özeti",
    description: "Projenin adı, başlangıç/bitiş tarihi, iş günü süresi, görev sayısı, kritik görev sayısı ve ilerleme yüzdesi.",
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
      "Tüm görevleri zamanlanmış haliyle döner: satır, WBS, ad, düzey, süre (iş günü), başlangıç, bitiş, öncüller, yüzde, bolluk, kritik mi. " +
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
      start_no_earlier_than: z.string().optional().describe("YYYY-AA-GG"),
    },
  },
  async (a) =>
    mutate((p) => {
      const { project, row: r } = addTask(p, {
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
      "Görevin adını, süresini, öncüllerini (tamamen değiştirir; boş metin hepsini siler), yüzdesini ya da başlangıç kısıtını değiştirir. " +
      "start_no_earlier_than için boş metin kısıtı kaldırır.",
    inputSchema: {
      row,
      name: z.string().optional(),
      duration: z.number().min(0).optional(),
      predecessors: z.string().optional(),
      percent: z.number().min(0).max(100).optional(),
      start_no_earlier_than: z.string().optional(),
    },
  },
  async (a) =>
    mutate((p) => ({
      project: updateTask(p, a.row, {
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
    description: "Tarihi tatil olarak ekler (remove=true ise kaldırır). Görevler tatilleri atlar.",
    inputSchema: { date: z.string().describe("YYYY-AA-GG"), name: z.string().optional(), remove: z.boolean().optional() },
  },
  async (a) =>
    mutate((p) => {
      if (!isValidDate(a.date)) throw new OpError(`Geçersiz tarih: ${a.date}`);
      const rest = p.holidays.filter((h) => h.date !== a.date);
      const holidays = a.remove ? rest : [...rest, { date: a.date, name: a.name ?? "Tatil" }];
      holidays.sort((x, y) => x.date.localeCompare(y.date));
      return { project: { ...p, holidays }, message: a.remove ? `${a.date} tatilden çıkarıldı.` : `${a.date} tatil olarak eklendi.` };
    }),
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

await server.connect(new StdioServerTransport());
console.error(`proje-planlayici MCP hazır: ${file}`);
