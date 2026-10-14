// Claude Desktop eklentisi (.mcpb) üretir: npm run build:mcpb
// Paket: manifest + simge + tek dosyalık sunucu. Claude Desktop kendi Node'unu kullanır; bilgisayarda Node gerekmez.
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const stage = "mcp/.mcpb-stage";
rmSync(stage, { recursive: true, force: true });
mkdirSync(`${stage}/server`, { recursive: true });
cpSync("mcp/mcpb/manifest.json", `${stage}/manifest.json`);
cpSync("public/icons/icon-512.png", `${stage}/icon.png`);
cpSync("mcp/dist/msproject-mcp.mjs", `${stage}/server/index.mjs`);
execFileSync("npx", ["mcpb", "pack", stage, "mcp/dist/proje-planlayici.mcpb"], { stdio: "inherit" });
rmSync(stage, { recursive: true, force: true });
