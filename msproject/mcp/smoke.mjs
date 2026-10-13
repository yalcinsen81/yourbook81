// MCP sunucusunu gerçek bir istemciyle uçtan uca dener: npm run mcp:smoke
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "msproject-"));
const file = join(dir, "proje.json");
const client = new Client({ name: "smoke", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: process.execPath, args: ["mcp/dist/msproject-mcp.mjs", file] }));

const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const text = r.content[0].text;
  if (r.isError) throw new Error(`${name}: ${text}`);
  return text;
};

const { tools } = await client.listTools();
console.log("Araçlar:", tools.map((t) => t.name).join(", "));
await call("set_project", { name: "Deneme", start: "2026-10-12" });
await call("add_task", { name: "Hazırlık" });
await call("add_task", { name: "Ruhsat", duration: 10, parent_row: 1 });
await call("add_task", { name: "Kurulum", duration: 5, parent_row: 1, predecessors: "2" });
await call("add_task", { name: "Teslim", duration: 0 });
await call("link_tasks", { from_row: 1, to_row: 4 });
await call("set_holiday", { date: "2026-10-29", name: "Cumhuriyet Bayramı" });
const tasks = JSON.parse(await call("get_tasks"));
console.table(tasks.map(({ row, name, duration, start, finish, predecessors, critical }) => ({ row, name, duration, start, finish, predecessors, critical })));
const bad = await client.callTool({ name: "link_tasks", arguments: { from_row: 4, to_row: 1 } });
console.log("Döngü denemesi reddedildi:", bad.isError, "-", bad.content[0].text);
// Kaynaklar: Ali iki çakışan göreve %100 atanır, aşırı yüklenir
await call("set_resource", { name: "Ali", rate: 1000 });
await call("update_task", { row: 2, resources: "Ali" });
await call("update_task", { row: 3, resources: "Ali; Vinç[50%]" });
await call("add_task", { name: "Paralel iş", duration: 3, resources: "Ali" });
await call("set_resource", { name: "Vinç", rate: 4000, max_units: 100 });
const resources = JSON.parse(await call("list_resources"));
console.table(resources);
const curve = JSON.parse(await call("get_progress_curve", { today: "2026-10-20" }));
console.log("Maliyet:", curve.totalCost, "Bugüne planlanan %", curve.plannedPercentToday);
const ali = resources.find((r) => r.name === "Ali");
if (!ali || ali.overallocated[0] !== "2026-10-12 – 2026-10-14" || ali.overallocatedTaskRows.join() !== "2,5" || curve.totalCost !== 28_000) {
  throw new Error("Kaynak sonucu beklenen gibi değil");
}
await call("export_msproject_xml", { path: join(dir, "proje.xml") });
console.log(await call("get_project_summary"));
const saved = JSON.parse(readFileSync(file, "utf8"));
if (saved.tasks.length !== 5 || !readFileSync(join(dir, "proje.xml"), "utf8").includes("<Assignment>") || !existsSync(join(dir, "proje.xml")) || tasks[3].start !== "2026-11-02" || tasks[2].finish !== "2026-11-02" || !bad.isError) {
  throw new Error("Beklenen sonuç alınamadı");
}
// Faz 1: eğri noktaları cuma günleri, aynı şema, takvim ayarı
const fridays = curve.curve.slice(1, -1).every((x) => x.date === curve.today || new Date(`${x.date}T00:00:00Z`).getUTCDay() === 5);
const rows = JSON.parse(await call("get_tasks"));
const sameKeys = rows.every((r) => Object.keys(r).sort().join() === Object.keys(rows[0]).sort().join());
await call("set_calendar", { workdays: [1, 2, 3, 4, 5, 6], progress_weight: "duration" });
const summary = JSON.parse(await call("get_project_summary"));
if (!fridays || curve.curve[0].plannedPercent !== 0 || !sameKeys || summary.progressWeight !== "duration" || summary.workdays.length !== 6) {
  throw new Error(`Faz 1 sonucu beklenen gibi değil: ${JSON.stringify({ fridays, first: curve.curve[0], sameKeys, w: summary.progressWeight, d: summary.workdays })}`);
}
// Faz 2B: kısıt, son tarih, referans plan, seviyeleme, malzeme, dönem
await call("set_calendar", { workdays: [1, 2, 3, 4, 5] });
await call("save_baseline", { number: 1, name: "İlk plan" });
await call("update_task", { row: 4, constraint_type: "SNET", constraint_date: "2026-11-09", deadline: "2026-11-10" });
const variance = JSON.parse(await call("get_baseline_variance", { number: 1 }));
const v5 = variance.tasks.find((x) => x.row === 4);
const lev = JSON.parse(await call("level_resources"));
await call("level_resources", { apply: "delay" });
const afterLevel = await call("level_resources");
await call("set_resource", { name: "Beton", type: "material", rate: 2000, unit_label: "m³" });
await call("update_task", { row: 3, resources: "Ali; Vinç[50%]; Beton[3]" });
await call("set_blackout", { name: "Kış", from: "2026-12-15", to: "2027-02-28" });
await call("update_task", { row: 5, blackouts: ["Kış"], fixed_cost: 5000 });
const cyc = await client.callTool({ name: "update_task", arguments: { row: 1, predecessors: "4" } });
const res2 = JSON.parse(await call("list_resources"));
const sum2 = JSON.parse(await call("get_project_summary"));
console.log({ v5, levelOptions: lev.options?.map((o) => o.strategy), afterLevel, cycle: cyc.content[0].text, total: sum2.totalCost });
if (v5.finishVarianceDays <= 0 || lev.options?.length !== 3 || !afterLevel.startsWith("Aşırı yüklü kaynak yok") || !cyc.isError || res2.find((r) => r.name === "Beton").type !== "material") {
  throw new Error("Faz 2B sonucu beklenen gibi değil");
}
console.log("Tamam:", file);
await client.close();
