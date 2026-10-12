// MCP sunucusunu gerçek bir istemciyle uçtan uca dener: node mcp/smoke.mjs
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
console.log("Döngü denemesi:", bad.isError, bad.content[0].text);
await call("export_msproject_xml", { path: join(dir, "proje.xml") });
console.log(await call("get_project_summary"));
const saved = JSON.parse(readFileSync(file, "utf8"));
if (saved.tasks.length !== 4 || !existsSync(join(dir, "proje.xml")) || tasks[3].start !== "2026-11-02") {
  throw new Error("Beklenen sonuç alınamadı");
}
console.log("Tamam:", file);
await client.close();
