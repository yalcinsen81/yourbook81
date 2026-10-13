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
// Faz 2C: not/etiket/renk/bağlantı/AC, EVM, raporlar, şablon, içe aktarma
await call("update_task", { row: 2, percent: 100, actual_cost: 12000, notes: "Belediye onayı alındı", tags: "resmi, Resmi; izin", color: "green", links: [{ url: "www.ornek.com/ruhsat.pdf", title: "Ruhsat" }] });
const badLink = await client.callTool({ name: "update_task", arguments: { row: 2, links: [{ url: "javascript:alert(1)" }] } });
const t2 = JSON.parse(readFileSync(file, "utf8")).tasks[1];
const evm = JSON.parse(await call("get_earned_value", { today: "2026-11-20", baseline: 1 }));
const cash = JSON.parse(await call("get_report", { kind: "cashflow", period: "month", today: "2026-11-20" }));
await call("export_report", { kind: "tasks", path: join(dir, "gorevler.csv") });
await call("export_report", { kind: "cashflow", path: join(dir, "nakit.xlsx") });
const xlsx = readFileSync(join(dir, "nakit.xlsx"));
console.log({ tags: t2.tags, color: t2.color, link: t2.links?.[0], evm: { pv: evm.pv, ev: evm.ev, ac: evm.ac, cpi: evm.cpi }, cashRows: cash.rows.length });
if (t2.tags?.join() !== "resmi,izin" || t2.color !== "green" || t2.links?.[0].url !== "https://www.ornek.com/ruhsat.pdf" || t2.actualCost !== 12000 || !badLink.isError ||
  evm.ac < 12000 || evm.pvSource !== "baseline" || !cash.rows.length || xlsx[0] !== 0x50 || !readFileSync(join(dir, "gorevler.csv"), "utf8").includes("Ruhsat")) {
  throw new Error("Faz 2C sonucu beklenen gibi değil");
}
await call("import_tasks", { path: join(dir, "gorevler.csv") });
const afterImport = JSON.parse(readFileSync(file, "utf8")).tasks.length;
await call("new_from_template", { template: "fitout", name: "Ofis", start: "2027-01-04" });
const tpl = JSON.parse(await call("get_project_summary"));
console.log({ afterImport, template: { name: tpl.name, tasks: tpl.tasks, finish: tpl.finish } });
if (afterImport <= 5 || tpl.name !== "Ofis" || !tpl.tasks) throw new Error("Şablon / içe aktarma beklenen gibi değil");
// Faz 2D: risk sicili, üç nokta tahmin, benzetim, plan kalitesi (şablondaki ilk iki süreli alt görev)
const [leafA, leafB] = JSON.parse(await call("get_tasks")).filter((x) => !x.summary && x.duration > 0).map((x) => x.row);
const r1 = await call("set_risk", { title: "Kalıp ustası yok", probability: 4, impact: 3, response: "mitigate", tasks: [{ row: leafA, days: 4, cost: 15000 }] });
await call("set_risk", { id: "R1", chance: 100, owner: "Şef" });
const badRisk = await client.callTool({ name: "set_risk", arguments: { id: "R9", title: "x" } });
await call("set_risk", { title: "Silinecek", probability: 1, impact: 1 });
await call("delete_risk", { id: "R2" });
await call("set_task_estimates", { row: leafB, optimistic: 2, likely: 3, pessimistic: 8 });
const badEst = await client.callTool({ name: "set_task_estimates", arguments: { row: leafB, optimistic: 5, pessimistic: 2 } });
const risks = JSON.parse(await call("list_risks"));
const simText = await call("run_simulation", { iterations: 500, seed: 3 });
const sim = JSON.parse(await call("get_simulation"));
const quality = JSON.parse(await call("check_plan_quality"));
const saved2d = JSON.parse(readFileSync(file, "utf8"));
console.log({ risks: risks.map((r) => `${r.id}:${r.exposure}:${r.chancePercent}`), p80: sim.result?.finish.p80, onTime: sim.result?.onTimeProbability, quality: quality.length });
if (!r1.includes("R1") || !badRisk.isError || !badEst.isError || risks.length !== 1 || risks[0].chancePercent !== 100 || !simText.includes("Benzetim") ||
  !sim.result?.current || sim.result.risks[0].occurred !== 1 || quality.length !== 11 || saved2d.version !== 6 || saved2d.tasks[leafB - 1].estimate?.pessimistic !== 8) {
  throw new Error("Faz 2D sonucu beklenen gibi değil");
}
await call("update_task", { row: leafB, duration: 9 });
if (JSON.parse(await call("get_simulation")).result.current) throw new Error("Benzetim eskimiş görünmeli");
console.log("Tamam:", file);
await client.close();
