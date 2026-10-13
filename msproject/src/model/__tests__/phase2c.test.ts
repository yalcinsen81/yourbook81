import { describe, expect, it } from "vitest";
import { setLocale } from "../../i18n";
import { saveBaseline } from "../baseline";
import { ganttImage, ganttPages, pageSize } from "../ganttSvg";
import { progressCurves, resourceUsage } from "../resources";
import { buildReport, cashFlow, earnedValue, isLate, lateTaskIds, REPORT_KINDS, sCurveSeries } from "../reports";
import { schedule } from "../schedule";
import { emptyProject } from "../sample";
import { sanitizeProject } from "../storage";
import { guessMapping, importTasks, parseCsv, parseImportDate, reportToCsv, reportToSheet } from "../tabular";
import { applyTemplate, BUILTIN_TEMPLATES, projectToTemplate } from "../templates";
import { PROJECT_VERSION, type Project } from "../types";
import { crc32, excelSerial, fromExcelSerial, readXlsx, unzip, writeXlsx, zipStore } from "../xlsx";
import { referenceProject } from "./fixtures/reference";

/** Referans proje: 1. görev bitti, 2. görev %50; ilk referans plan ilerleme yokken kaydedildi */
function inProgress(): Project {
  const base = referenceProject();
  const withBaseline = saveBaseline(base, schedule(base), 0, "2026-11-01", "İlk plan");
  return { ...withBaseline, tasks: withBaseline.tasks.map((x, i) => (i === 0 ? { ...x, percent: 100, actualCost: 90_000 } : i === 1 ? { ...x, percent: 50 } : x)) };
}

describe("referans proje (regresyon, Faz 2C)", () => {
  it("bitiş 2027-03-01 ve toplam 635.000 değişmez; sürüm 5", () => {
    const p = sanitizeProject(referenceProject())!;
    const s = schedule(p);
    expect(p.version).toBe(PROJECT_VERSION);
    expect(PROJECT_VERSION).toBe(5);
    expect(s.finishDate).toBe("2027-03-01");
    expect(progressCurves(p, s, "2026-11-01").totalCost).toBe(635_000);
    expect(s.rows.every((r) => r.critical)).toBe(true);
  });
});

describe("C1 kazanılmış değer", () => {
  it("PV referans plandan, EV yüzdeden, AC girilen ya da EV; SPI, CPI, EAC", () => {
    const p = inProgress();
    const e = earnedValue(p, schedule(p), "2026-12-04", 0);
    expect(e.pvSource).toBe("baseline");
    expect(e.bac).toBe(635_000);
    // 1. görev 85.000 + 2. görevin 15 iş günü × 10.000
    expect(e.pv).toBe(235_000);
    expect(e.ev).toBe(210_000);
    // 90.000 girildi; 2. görevde gerçekleşen maliyet yok, EV sayıldı
    expect(e.ac).toBe(215_000);
    expect(e.acEstimatedRows).toEqual([2]);
    expect(e.sv).toBe(-25_000);
    expect(e.cv).toBe(-5_000);
    expect(e.spi).toBeCloseTo(0.894, 3);
    expect(e.cpi).toBeCloseTo(0.977, 3);
    expect(e.eac).toBeCloseTo(650_119.05, 0);
    expect(e.vac).toBeCloseTo(635_000 - 650_119.05, 0);
  });

  it("referans plan yoksa PV güncel plandan; başlamamış projede SPI hesaplanmaz", () => {
    const p = referenceProject();
    const e = earnedValue(p, schedule(p), "2026-10-30");
    expect(e.pvSource).toBe("plan");
    expect(e.pv).toBe(0);
    expect(e.spi).toBeNull();
    expect(e.cpi).toBeNull();
    expect(e.eac).toBe(635_000);
  });
});

describe("C1 S eğrisi ve nakit akışı", () => {
  it("S eğrisi: planlanan, referans plan ve bugüne kadar gerçekleşen", () => {
    const p = inProgress();
    const s = schedule(p);
    const pts = sCurveSeries(p, s, progressCurves(p, s, "2026-12-04"), "2026-12-04", 0);
    expect(pts[0]).toMatchObject({ date: "2026-11-02", planned: 0, baseline: 0 });
    const last = pts[pts.length - 1];
    expect(last).toMatchObject({ date: "2027-03-01", planned: 100, plannedCost: 635_000, baseline: 100, actual: null });
    const today = pts.find((x) => x.date === "2026-12-04")!;
    expect(today.actualCost).toBe(210_000);
    expect(today.baselineCost).toBe(235_000);
  });

  it("aylık nakit akışı toplamı 635.000; ayların dağılımı takvime uyar", () => {
    const p = referenceProject();
    const s = schedule(p);
    const rows = cashFlow(p, s, progressCurves(p, s, "2026-11-01"), "month");
    expect(rows.map((r) => [r.from, r.planned])).toEqual([
      ["2026-11-01", 195_000],
      ["2026-12-01", 194_000],
      ["2027-01-01", 130_800],
      ["2027-02-01", 115_200],
    ]);
    expect(rows[rows.length - 1].cumulative).toBe(635_000);
    expect(rows[0].to).toBe("2026-11-30");
  });

  it("haftalık nakit akışı pazartesiden başlar ve boş hafta da satırdır", () => {
    const p = referenceProject();
    const s = schedule(p);
    const rows = cashFlow(p, s, progressCurves(p, s, "2026-11-01"), "week");
    expect(rows[0]).toMatchObject({ from: "2026-11-02", to: "2026-11-08", planned: 42_500 });
    expect(rows.reduce((a, r) => a + r.planned, 0)).toBeCloseTo(635_000, 2);
    // Yılbaşı haftası (28.12–03.01): 4 iş günü × 6.000
    expect(rows.find((r) => r.from === "2026-12-28")!.planned).toBe(24_000);
  });
});

describe("C1 tablo raporları", () => {
  it("her rapor üretilir; kritik yol 6 görev, kilometre taşı ve gecikme", () => {
    const p = inProgress();
    const s = schedule(p);
    for (const kind of REPORT_KINDS) {
      const r = buildReport(kind, p, s, { today: "2026-12-04", baselineIndex: 0 });
      expect(r.columns.length).toBeGreaterThan(1);
      for (const row of r.rows) for (const c of r.columns) expect(row).toHaveProperty(c.key);
    }
    const crit = buildReport("critical", p, s, { today: "2026-12-04" });
    expect(crit.rows).toHaveLength(6);
    expect(crit.total).toMatchObject({ cost: 635_000 });
    // Bitişi geçmiş ve %100 olmayan görev gecikmiştir
    expect(isLate(p, s, 1, "2026-12-21")).toBe(true);
    expect(isLate(p, s, 0, "2026-12-21")).toBe(false);
    expect([...lateTaskIds(p, s, "2026-12-21")]).toEqual(["ref-2"]);
  });

  it("kilometre taşı raporu referans plan tarihini ve sapmayı verir", () => {
    const p = inProgress();
    p.tasks.push({ id: "ms", name: "Teslim", duration: 0, outline: 0, percent: 0, predecessors: [{ taskId: "ref-6", type: "FS", lag: 0 }], deadline: "2027-02-26" });
    const s = schedule(p);
    const r = buildReport("milestones", p, s, { today: "2026-12-04", baselineIndex: 0 });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ name: "Teslim", date: "2027-03-01", baseline: null, status: "Son tarih aşıldı" });
  });

  it("İngilizce başlıklar", () => {
    setLocale({ lang: "en" });
    const p = referenceProject();
    const r = buildReport("tasks", p, schedule(p), { today: "2026-11-01" });
    expect(r.title).toBe("Task list");
    expect(r.columns.map((c) => c.label)).toContain("Status");
  });
});

describe("C1 CSV ve Excel", () => {
  it("CSV: Türkçede noktalı virgül ve virgül ondalık; tırnak ve satır sonu korunur", () => {
    const p = referenceProject();
    p.tasks[0].name = 'Hafriyat; "temel"\nikinci satır';
    const r = buildReport("tasks", p, schedule(p), { today: "2026-11-01" });
    const csv = reportToCsv(r);
    expect(csv.startsWith("﻿")).toBe(true);
    const rows = parseCsv(csv);
    expect(rows[0][0]).toBe("#");
    expect(rows[1][2]).toBe('Hafriyat; "temel"\nikinci satır');
    expect(rows[1][4]).toBe("02.11.2026");
    expect(rows[1][9]).toBe("85000");
    expect(rows[rows.length - 1]).toContain("635000");
  });

  it("CSV: İngilizcede virgül ayırıcı", () => {
    setLocale({ lang: "en" });
    const p = referenceProject();
    const csv = reportToCsv(buildReport("critical", p, schedule(p), { today: "2026-11-01" }));
    expect(csv.split("\r\n")[0]).toBe("﻿#,Name,Duration,Start,Finish,Predecessors,Slack,% Comp.,Cost,Status".replace("Name", "Task Name"));
  });

  it("xlsx yazılır ve geri okunur (sayı, tarih, yüzde, Türkçe harf)", async () => {
    const p = inProgress();
    const sheet = reportToSheet(buildReport("tasks", p, schedule(p), { today: "2026-12-04" }));
    const bytes = writeXlsx([sheet, { ...sheet, name: sheet.name }]);
    const files = await unzip(bytes);
    expect([...files.keys()]).toContain("xl/worksheets/sheet2.xml");
    // Aynı adlı ikinci sayfa yeniden adlandırılır
    expect(new TextDecoder().decode(files.get("xl/workbook.xml")!)).toContain("Görev listesi 2");
    const rows = await readXlsx(bytes);
    expect(rows[0][2]).toBe("Görev Adı");
    expect(rows[1][2]).toBe("Hafriyat ve temel");
    expect(rows[1][4]).toBe("2026-11-02");
    // Yüzde oran olarak saklanır (%100 = 1)
    expect(rows[1][8]).toBe("1");
    expect(rows[2][8]).toBe("0.5");
    expect(rows[1][9]).toBe("85000");
  });

  it("zip: CRC32, saklanan ve deflate ile sıkıştırılmış girdi okunur", async () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    const stored = zipStore([{ name: "a.txt", data: "merhaba" }]);
    expect(new TextDecoder().decode((await unzip(stored)).get("a.txt")!)).toBe("merhaba");
    // Excel'in ürettiği gibi deflate yöntemli arşiv: saklanan arşivi yöntem 8 ile yeniden kur
    const text = "çok çok çok uzun metin ".repeat(20);
    const raw = new TextEncoder().encode(text);
    const data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
    const src = zipStore([{ name: "b.txt", data: raw }]);
    const head = 30 + 5;
    const central = src.subarray(head + raw.length, src.length - 22);
    const out = new Uint8Array(head + data.length + central.length + 22);
    out.set(src.subarray(0, head), 0);
    out.set(data, head);
    out.set(central, head + data.length);
    out.set(src.subarray(src.length - 22), head + data.length + central.length);
    const o = new DataView(out.buffer);
    const c = head + data.length;
    o.setUint16(8, 8, true);
    o.setUint32(18, data.length, true);
    o.setUint16(c + 10, 8, true);
    o.setUint32(c + 20, data.length, true);
    o.setUint32(out.length - 22 + 16, c, true);
    expect(new TextDecoder().decode((await unzip(out)).get("b.txt")!)).toBe(text);
  });

  it("Excel seri günü", () => {
    expect(excelSerial("2026-11-02")).toBe(46328);
    expect(fromExcelSerial(46328)).toBe("2026-11-02");
  });
});

describe("C2 içe aktarma", () => {
  const csv = [
    "Sıra;Görev Adı;Süre;Başlangıç;Öncüller;Kaynaklar;% Tamamlanan;Düzey",
    "1;Hazırlık;;;;;;1",
    "2;Zemin etüdü;5 gün;02.11.2026;;Mühendis;%100;2",
    '3;Kazı;3;;2;"Mühendis[50%]; Ekskavatör";;2',
    "4;Teslim;0;;3FS+2;;;1",
    "5;;;;;;;",
  ].join("\n");

  it("başlıktan sütun eşlemesi tahmin edilir", () => {
    const rows = parseCsv(csv);
    expect(guessMapping(rows[0])).toEqual(["id", "name", "duration", "start", "predecessors", "resources", "percent", "outline"]);
    expect(guessMapping(["Task Name", "Duration", "Start", "Finish", "Predecessors", "Resource Names", "% Complete", "Outline Level"])).toEqual([
      "name",
      "duration",
      "start",
      "finish",
      "predecessors",
      "resources",
      "percent",
      "outline",
    ]);
  });

  it("görevler, düzey, öncül ve kaynaklar aktarılır; plan hesaplanır", () => {
    const rows = parseCsv(csv);
    const base = emptyProject("2026-11-02");
    const r = importTasks(base, rows, guessMapping(rows[0]), { hasHeader: true, mode: "replace" });
    expect(r.imported).toBe(4);
    expect(r.problems).toEqual([{ line: 6, message: "Adı boş satır atlandı." }]);
    const p = r.project;
    expect(p.tasks.map((x) => [x.name, x.duration, x.outline, x.percent])).toEqual([
      ["Hazırlık", 1, 0, 0],
      ["Zemin etüdü", 5, 1, 100],
      ["Kazı", 3, 1, 0],
      ["Teslim", 0, 0, 0],
    ]);
    expect(p.tasks[3].predecessors).toEqual([{ taskId: p.tasks[2].id, type: "FS", lag: 2 }]);
    expect(p.resources.map((x) => x.name)).toEqual(["Mühendis", "Ekskavatör"]);
    const s = schedule(p);
    expect(s.rows[2].startDate).toBe("2026-11-09");
    expect(s.rows[3].finishDate).toBe("2026-11-13");
  });

  it("hatalı değerler satır numarasıyla bildirilir; ekleme kipinde mevcut görevler kalır", () => {
    const rows = parseCsv("Ad;Süre;Başlangıç;Öncüller\nA;beş;32.13.2026;\nB;2;;9");
    const base = referenceProject();
    const r = importTasks(base, rows, guessMapping(rows[0]), { hasHeader: true, mode: "append" });
    expect(r.project.tasks).toHaveLength(8);
    expect(r.problems.map((x) => x.line)).toEqual([2, 2, 3]);
    expect(schedule(r.project).rows[5].finishDate).toBe("2027-03-01");
  });

  it("MS Project dışa aktarım tarihleri ve süreden önce başlangıç–bitiş", () => {
    expect(parseImportDate("Pzt 02.11.26")).toBe("2026-11-02");
    setLocale({ lang: "en" });
    expect(parseImportDate("Mon 11/2/26 8:00 AM")).toBe("2026-11-02");
    const rows = parseCsv("Name,Start,Finish\nA,11/2/2026,11/6/2026");
    const r = importTasks(emptyProject("2026-11-02"), rows, guessMapping(rows[0]), { hasHeader: true, mode: "replace" });
    expect(r.project.tasks[0].duration).toBe(5);
  });

  it("ad sütunu yoksa hiçbir şey aktarılmaz", () => {
    const r = importTasks(referenceProject(), [["x"], ["y"]], ["ignore"], { hasHeader: true, mode: "replace" });
    expect(r.imported).toBe(0);
    expect(r.project.tasks).toHaveLength(6);
  });
});

describe("C2 şablonlar", () => {
  it("hazır şablonlar iki dilde, döngüsüz ve uyarısız planlanır", () => {
    for (const tpl of BUILTIN_TEMPLATES) {
      for (const lang of ["tr", "en"] as const) {
        const p = applyTemplate(emptyProject("2027-03-01"), tpl, lang);
        const s = schedule(p);
        expect(s.cycle).toEqual([]);
        expect(s.issues).toEqual([]);
        // Hazır şablon kendi kaynaklarını aşırı yüklemez
        expect(resourceUsage(p, s).filter((u) => u.overDays.length).map((u) => `${tpl.id}: ${u.resource.name}`)).toEqual([]);
        expect(p.tasks[0].name).toBe(lang === "tr" ? "Proje başlangıcı" : "Project start");
        expect(sanitizeProject(p)!.tasks).toHaveLength(tpl.rows.length);
      }
    }
  });

  it("kullanıcı şablonu ilerlemeyi atar, tarihleri yeni başlangıca kaydırır", () => {
    const src = inProgress();
    src.tasks[2] = { ...src.tasks[2], constraint: { type: "SNET", date: "2026-12-28" }, deadline: "2027-01-15", notes: "not" };
    const tpl = projectToTemplate(src, "Ev", "2026-12-04");
    expect(tpl.tasks.every((x) => x.percent === 0 && x.actualCost === undefined)).toBe(true);
    const p = applyTemplate(emptyProject("2027-11-01"), tpl);
    expect(p.tasks[2].constraint).toEqual({ type: "SNET", date: "2027-12-27" });
    expect(p.tasks[2].deadline).toBe("2028-01-14");
    expect(p.tasks[2].notes).toBe("not");
    expect(p.tasks[1].predecessors[0].taskId).toBe(p.tasks[0].id);
    expect(p.baselines).toBeUndefined();
    expect(new Set(p.tasks.map((x) => x.id)).size).toBe(6);
    expect(p.tasks[0].id).not.toBe(src.tasks[0].id);
  });
});

describe("C3 görev alanları (sürüm 5)", () => {
  it("not, bağlantı, etiket, renk, gerçekleşen maliyet doğrulanır; güvensiz adres atılır", () => {
    const raw = {
      ...referenceProject(),
      version: 4,
      tasks: [
        {
          ...referenceProject().tasks[0],
          notes: "Zemin raporu bekleniyor",
          links: [{ url: "https://ornek.com/plan.pdf", title: "Plan" }, { url: "javascript:alert(1)" }, { url: "www.ornek.com/a" }],
          tags: ["dış iş", "Dış İş", " beton ", ""],
          color: "green",
          actualCost: 90_000,
        },
      ],
    };
    const p = sanitizeProject(raw)!;
    const task = p.tasks[0];
    expect(task.notes).toBe("Zemin raporu bekleniyor");
    expect(task.links).toEqual([{ url: "https://ornek.com/plan.pdf", title: "Plan" }, { url: "https://www.ornek.com/a" }]);
    expect(task.tags).toEqual(["dış iş", "beton"]);
    expect(task.color).toBe("green");
    expect(task.actualCost).toBe(90_000);
    expect(sanitizeProject({ ...raw, tasks: [{ ...raw.tasks[0], color: "pink", actualCost: -1 }] })!.tasks[0]).not.toHaveProperty("color");
  });
});

describe("C1 Gantt çıktısı", () => {
  it("sayfalara bölünür; her sayfada tablo ve sayfa numarası", () => {
    const p = referenceProject();
    const s = schedule(p);
    const pages = ganttPages(p, s, { from: "2026-11-02", to: "2027-03-01", scale: "day", size: "A4", orientation: "landscape" });
    // 120 günlük plan günlük ölçekte A4'e sığmaz; sayfalar sırayla numaralanır
    expect(pages.length).toBe(4);
    expect(pages[0]).toContain("Hafriyat ve temel");
    expect(pages[3]).toContain("Hafriyat ve temel");
    expect(pages[3]).toContain("Sayfa 4/4");
    const fit = ganttPages(p, s, { from: "2026-11-02", to: "2027-03-01", scale: "fit", size: "A3", orientation: "landscape" });
    expect(fit).toHaveLength(1);
    expect(pageSize("A3", "landscape")).toEqual({ width: 1587, height: 1123 });
  });

  it("tarih aralığı dışındaki görevler çizilmez; tek parça görüntü", () => {
    const p = referenceProject();
    const s = schedule(p);
    const img = ganttImage(p, s, { from: "2027-01-01", to: "2027-03-01", scale: "week", size: "A4", orientation: "landscape" });
    expect(img.svg).not.toContain("Hafriyat ve temel");
    expect(img.svg).toContain("Snag list");
    expect(img.width).toBeGreaterThan(400);
  });
});
