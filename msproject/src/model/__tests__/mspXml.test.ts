// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseDurationHours, parseMspXml, toMspXml } from "../mspXml";
import { sampleProject } from "../sample";
import { schedule } from "../schedule";

// MS Project 2019'un "XML olarak kaydet" çıktısından kısaltılmış örnek
const MSP = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Bina.xml</Name>
  <Title>Bina &amp; Altyapı</Title>
  <StartDate>2026-11-02T08:00:00</StartDate>
  <MinutesPerDay>480</MinutesPerDay>
  <CalendarUID>1</CalendarUID>
  <Calendars>
    <Calendar><UID>1</UID><Name>Standard</Name><IsBaseCalendar>1</IsBaseCalendar>
      <Exceptions>
        <Exception><TimePeriod><FromDate>2026-12-31T00:00:00</FromDate><ToDate>2027-01-01T23:59:00</ToDate></TimePeriod>
          <Name>Yılbaşı</Name><DayWorking>0</DayWorking></Exception>
        <Exception><TimePeriod><FromDate>2026-12-05T00:00:00</FromDate><ToDate>2026-12-05T23:59:00</ToDate></TimePeriod>
          <Name>Fazla mesai</Name><DayWorking>1</DayWorking></Exception>
      </Exceptions>
    </Calendar>
  </Calendars>
  <Tasks>
    <Task><UID>0</UID><ID>0</ID><Name>Bina</Name><OutlineLevel>0</OutlineLevel><Summary>1</Summary></Task>
    <Task><UID>5</UID><ID>1</ID><Name>Kazı</Name><OutlineLevel>1</OutlineLevel><Summary>1</Summary>
      <Duration>PT80H0M0S</Duration><Start>2026-11-02T08:00:00</Start></Task>
    <Task><UID>7</UID><ID>2</ID><Name>Hafriyat</Name><OutlineLevel>2</OutlineLevel>
      <Duration>PT40H0M0S</Duration><PercentComplete>25</PercentComplete><Start>2026-11-02T08:00:00</Start></Task>
    <Task><UID>9</UID><ID>3</ID><Name>Grobeton</Name><OutlineLevel>2</OutlineLevel><Duration>PT16H0M0S</Duration>
      <ConstraintType>4</ConstraintType><ConstraintDate>2026-11-16T08:00:00</ConstraintDate>
      <PredecessorLink><PredecessorUID>7</PredecessorUID><Type>3</Type><LinkLag>9600</LinkLag><LagFormat>7</LagFormat></PredecessorLink>
    </Task>
    <Task><UID>12</UID><ID>4</ID><Name>Teslim</Name><OutlineLevel>1</OutlineLevel><Milestone>1</Milestone>
      <Duration>PT0H0M0S</Duration>
      <PredecessorLink><PredecessorUID>9</PredecessorUID><Type>1</Type><LinkLag>4800</LinkLag><LagFormat>20</LagFormat></PredecessorLink>
    </Task>
    <Task><UID>13</UID><ID>5</ID><Name>Elle</Name><OutlineLevel>1</OutlineLevel><Manual>1</Manual>
      <Duration>PT8H0M0S</Duration><Start>2026-11-20T08:00:00</Start></Task>
  </Tasks>
</Project>`;

describe("MS Project XML", () => {
  it("süre biçimini saate çevirir", () => {
    expect(parseDurationHours("PT40H0M0S")).toBe(40);
    expect(parseDurationHours("PT7H30M0S")).toBe(7.5);
    expect(parseDurationHours("P1DT2H0M0S")).toBe(26);
    expect(parseDurationHours("bozuk")).toBe(0);
  });

  it("görevleri, girintiyi, bağları, kısıtları ve tatilleri okur", () => {
    const { project, warnings } = parseMspXml(MSP);
    expect(project.name).toBe("Bina & Altyapı");
    expect(project.start).toBe("2026-11-02");
    expect(project.tasks.map((t) => [t.name, t.outline, t.duration])).toEqual([
      ["Kazı", 0, 10],
      ["Hafriyat", 1, 5],
      ["Grobeton", 1, 2],
      ["Teslim", 0, 0],
      ["Elle", 0, 1],
    ]);
    const [, hafriyat, grobeton, teslim, elle] = project.tasks;
    expect(hafriyat.percent).toBe(25);
    expect(grobeton.predecessors).toEqual([{ taskId: hafriyat.id, type: "SS", lag: 2 }]);
    expect(grobeton.startNoEarlierThan).toBe("2026-11-16");
    expect(teslim.predecessors[0].lag).toBe(0);
    expect(elle.startNoEarlierThan).toBe("2026-11-20");
    expect(project.holidays.map((h) => h.date)).toEqual(["2026-12-31", "2027-01-01"]);
    expect(warnings).toHaveLength(2);
  });

  it("geçersiz dosyayı reddeder", () => {
    expect(() => parseMspXml("<html><body/></html>")).toThrow();
    expect(() => parseMspXml("bozuk <")).toThrow();
  });

  it("dışa aktarılan dosya geri okununca aynı planı verir", () => {
    const original = sampleProject("2026-10-12");
    original.tasks[5].startNoEarlierThan = "2026-11-10";
    original.tasks[12].predecessors[0].lag = 3;
    const xml = toMspXml(original, schedule(original));
    const { project } = parseMspXml(xml);
    expect(project.name).toBe(original.name);
    expect(project.holidays).toEqual(original.holidays);
    const a = schedule(original);
    const b = schedule(project);
    expect(b.rows.map((r) => [r.startDate, r.finishDate, r.critical])).toEqual(
      a.rows.map((r) => [r.startDate, r.finishDate, r.critical]),
    );
    expect(project.tasks.map((t) => t.name)).toEqual(original.tasks.map((t) => t.name));
    // Kaynaklar, kapasiteleri, günlük ücretleri ve atamalar korunur
    expect(project.resources.map((r) => [r.name, r.maxUnits, r.rate])).toEqual(
      original.resources.map((r) => [r.name, r.maxUnits, r.rate]),
    );
    const names = (p: typeof project, i: number) =>
      (p.tasks[i].assignments ?? []).map((a) => [p.resources.find((r) => r.id === a.resourceId)!.name, a.units]);
    original.tasks.forEach((_, i) => expect(names(project, i)).toEqual(names(original, i)));
    expect(xml).toContain("<Work>PT160H0M0S</Work>"); // Temel: 10 gün × %200 kaba inşaat ekibi
  });
});
