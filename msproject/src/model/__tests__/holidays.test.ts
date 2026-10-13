import { describe, expect, it } from "vitest";
import { WorkCalendar } from "../calendar";
import { mergeHolidays, nonWorkingDates, turkishHolidays, yearsWithoutReligiousData, type Holiday } from "../holidays";
import { RELIGIOUS_HOLIDAYS } from "../holidayData";
import { emptyProject, sampleProject } from "../sample";
import { schedule } from "../schedule";
import { sanitizeProject } from "../storage";
import { PROJECT_VERSION, type Project, type Task } from "../types";

const task = (id: string, duration: number, extra: Partial<Task> = {}): Task => ({
  id,
  name: id,
  duration,
  outline: 0,
  percent: 0,
  predecessors: [],
  ...extra,
});

describe("Madde 3: tatil verisi ve takvim seçenekleri", () => {
  it("mevcut 41 tatil aynen korunur (2026–2029, varsayılan seçenekler)", () => {
    const list = turkishHolidays(2026, 2029);
    expect(list).toHaveLength(41);
    expect(new Set(list.map((h) => h.date)).size).toBe(41);
    expect(list.find((h) => h.date === "2027-05-19")!.name).toBe("Atatürk'ü Anma, Gençlik ve Spor Bayramı / Kurban Bayramı 4. gün");
    expect(list.some((h) => h.halfDay)).toBe(false);
  });

  it("her bayramın gün sayısı doğru: Ramazan 3, Kurban 4", () => {
    const list = turkishHolidays(2026, 2027, { official: false, religious: true, halfDays: false });
    for (const y of [2026, 2027]) {
      expect(list.filter((h) => h.date.startsWith(`${y}`) && h.name.startsWith("Ramazan"))).toHaveLength(3);
      expect(list.filter((h) => h.date.startsWith(`${y}`) && h.name.startsWith("Kurban"))).toHaveLength(4);
    }
    for (const year of Object.values(RELIGIOUS_HOLIDAYS)) expect(year.map((r) => r.days)).toEqual([3, 4]);
  });

  it("veri olmayan yıllar bildirilir; tahmini tarih eklenmez", () => {
    expect(yearsWithoutReligiousData(2026, 2029)).toEqual([2028, 2029]);
    const y2028 = turkishHolidays(2028, 2028);
    expect(y2028.every((h) => !/Ramazan|Kurban/.test(h.name))).toBe(true);
  });

  it("seçenekler: yalnızca resmî, yalnızca dini, arifeler yarım gün", () => {
    expect(turkishHolidays(2026, 2026, { official: true, religious: false, halfDays: false })).toHaveLength(7);
    expect(turkishHolidays(2026, 2026, { official: false, religious: true, halfDays: false })).toHaveLength(7);
    const withEves = turkishHolidays(2026, 2026, { official: true, religious: true, halfDays: true });
    expect(withEves.filter((h) => h.halfDay).map((h) => h.date)).toEqual(["2026-03-19", "2026-05-26", "2026-10-28"]);
  });

  it("arife (yarım gün) iş günü sayılır, zamanlamayı değiştirmez", () => {
    const eve: Holiday = { date: "2026-10-28", name: "Cumhuriyet Bayramı arifesi", halfDay: true };
    expect(nonWorkingDates([eve])).toEqual([]);
    const p: Project = { name: "p", start: "2026-10-26", tasks: [task("a", 5)], holidays: [eve], resources: [] };
    const without = schedule({ ...p, holidays: [] });
    expect(schedule(p).rows[0].finishDate).toBe(without.rows[0].finishDate);
  });

  it("hafta sonuna denk gelen tatil iş günü sayısını değiştirmez", () => {
    // 1 Ocak 2028 cumartesi; Kurban Bayramı arifesi 2027-05-15 cumartesi
    const plain = new WorkCalendar("2027-12-27");
    const withHoliday = new WorkCalendar("2027-12-27", ["2028-01-01"]);
    expect(withHoliday.workdaysBetween("2027-12-27", "2028-01-14")).toBe(plain.workdaysBetween("2027-12-27", "2028-01-14"));
    expect(withHoliday.toDate(9)).toBe(plain.toDate(9));
  });

  it("bayrama denk gelen görev tatilleri atlar (2027 Ramazan, Diyanet verisi)", () => {
    const p: Project = { name: "p", start: "2027-03-08", tasks: [task("a", 5)], holidays: turkishHolidays(2027, 2027), resources: [] };
    // 8 Mart pzt, 9–11 Mart bayram, 12 cuma, 15–17 Mart
    expect(schedule(p).rows[0].finishDate).toBe("2027-03-17");
  });

  it("2028 başında başlayan görev kullanıcının girdiği bayram günlerini atlar", () => {
    // Test için kullanıcının Proje takvimi penceresinden girdiği varsayımsal 3 günlük bayram (gerçek tarih iddiası değil)
    const entered: Holiday[] = ["2028-01-12", "2028-01-13", "2028-01-14"].map((date, i) => ({ date, name: `Bayram ${i + 1}. gün` }));
    const p: Project = {
      name: "p",
      start: "2028-01-03",
      tasks: [task("a", 10)],
      holidays: mergeHolidays(turkishHolidays(2028, 2028), entered),
      resources: [],
    };
    // 3–7 Ocak (5) + 10–11 Ocak (2) + 17–19 Ocak (3) = 10 iş günü
    expect(schedule(p).rows[0].finishDate).toBe("2028-01-19");
  });

  it("birleştirme kullanıcının tatillerini ezmez, çift kayıt oluşturmaz", () => {
    const mine: Holiday[] = [
      { date: "2026-10-29", name: "Benim adım" },
      { date: "2026-08-14", name: "Şantiye bakımı" },
    ];
    const merged = mergeHolidays(mine, turkishHolidays(2026, 2026));
    expect(merged.find((h) => h.date === "2026-10-29")!.name).toBe("Benim adım");
    expect(merged.find((h) => h.date === "2026-08-14")).toBeTruthy();
    expect(new Set(merged.map((h) => h.date)).size).toBe(merged.length);
    expect(mergeHolidays(merged, turkishHolidays(2026, 2026))).toEqual(merged);
  });
});

describe("Madde 3: çalışma günleri kullanıcı seçimi", () => {
  it("Pzt–Cmt çalışılırsa cumartesi iş günüdür", () => {
    const p = { ...emptyProject("2026-11-02", { workdays: [1, 2, 3, 4, 5, 6], holidays: { official: false, religious: false, halfDays: false } }), tasks: [task("a", 10)] };
    // 2–7 Kasım (6) + 9–12 Kasım (4)
    expect(schedule(p).rows[0].finishDate).toBe("2026-11-12");
  });

  it("yeni proje seçilen takvimle kurulur", () => {
    const p = emptyProject("2026-11-02", { name: "Ev", holidays: { official: true, religious: false, halfDays: false }, progressWeight: "work" });
    expect(p).toMatchObject({ name: "Ev", version: PROJECT_VERSION, workdays: [1, 2, 3, 4, 5], progressWeight: "work" });
    expect(p.holidays.every((h) => !/Ramazan|Kurban/.test(h.name))).toBe(true);
  });
});

describe("dosya sürümü ve otomatik yükseltme", () => {
  it("sürümsüz (v1) dosya açılır: Pzt–Cum, maliyet ağırlığı, tatiller aynen", () => {
    const v1 = JSON.parse(JSON.stringify({ ...sampleProject("2026-10-12"), version: undefined, workdays: undefined, progressWeight: undefined }));
    v1.holidays.push({ date: "2026-08-14", name: "Kullanıcının tatili" });
    const p = sanitizeProject(v1)!;
    expect(p.version).toBe(PROJECT_VERSION);
    expect(p.workdays).toEqual([1, 2, 3, 4, 5]);
    expect(p.progressWeight).toBe("cost");
    expect(p.holidays).toHaveLength(42);
    expect(p.holidays.find((h) => h.date === "2026-08-14")!.name).toBe("Kullanıcının tatili");
    expect(schedule(p).finishDate).toBe(schedule(sampleProject("2026-10-12")).finishDate);
  });

  it("bozuk çalışma günü ve ağırlık varsayılana döner, yarım gün bayrağı korunur", () => {
    const p = sanitizeProject({
      name: "x",
      start: "2026-11-02",
      tasks: [],
      holidays: [{ date: "2026-10-28", name: "Arife", halfDay: true }],
      workdays: [9, "a"],
      progressWeight: "foo",
    })!;
    expect(p.workdays).toEqual([1, 2, 3, 4, 5]);
    expect(p.progressWeight).toBe("cost");
    expect(p.holidays[0].halfDay).toBe(true);
  });
});
