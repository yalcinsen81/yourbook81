import { addDays, DEFAULT_WORKDAYS, isValidDate, normalizeWorkdays } from "./calendar";
import type { Holiday } from "./holidays";
import { normalizeOutline, wbsCodes } from "./outline";
import type { Assignment, LinkType, Predecessor, Project, Resource, Schedule, Task } from "./types";

// Microsoft Project XML biçimi (Dosya > Farklı Kaydet > XML). .mpp ikili biçimi tarayıcıda okunamaz;
// MS Project'te "XML Biçimi (*.xml)" olarak kaydedilen dosya buraya açılır, buradan kaydedilen dosya MS Project'te açılır.

const NS = "http://schemas.microsoft.com/project";
// MS Project bağ tipi kodları
const TYPE_FROM_MSP: Record<string, LinkType> = { "0": "FF", "1": "FS", "2": "SF", "3": "SS" };
const TYPE_TO_MSP: Record<LinkType, number> = { FF: 0, FS: 1, SF: 2, SS: 3 };
// ConstraintType: 0 = Mümkün olan en kısa sürede, 4 = Şundan önce başlamasın
const SNET = "4";

export interface ImportResult {
  project: Project;
  /** Kullanıcıya gösterilecek uyarılar (desteklenmeyen alanlar vb.) */
  warnings: string[];
}

function child(el: Element, name: string): Element | undefined {
  for (const c of Array.from(el.children)) if (c.localName === name) return c;
  return undefined;
}

function children(el: Element | undefined, name: string): Element[] {
  return el ? Array.from(el.children).filter((c) => c.localName === name) : [];
}

function text(el: Element, name: string): string {
  return child(el, name)?.textContent?.trim() ?? "";
}

/** "PT40H0M0S", "PT7H30M0S", "P2DT4H0M0S" → saat */
export function parseDurationHours(iso: string): number {
  const m = /^-?P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso.trim());
  if (!m) return 0;
  const [, d = "0", h = "0", min = "0", s = "0"] = m;
  return Number(d) * 24 + Number(h) + Number(min) / 60 + Number(s) / 3600;
}

const dateOf = (dt: string) => dt.slice(0, 10);

export function parseMspXml(xml: string): ImportResult {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const root = doc.documentElement;
  if (!root || root.localName !== "Project" || doc.getElementsByTagName("parsererror").length) {
    throw new Error("Bu dosya bir MS Project XML dosyası değil.");
  }
  const warnings: string[] = [];
  const minutesPerDay = Number(text(root, "MinutesPerDay")) || 480;
  const hoursPerDay = minutesPerDay / 60;
  const toDays = (iso: string) => Math.max(0, Math.round(parseDurationHours(iso) / hoursPerDay));

  const rawTasks = children(child(root, "Tasks"), "Task").filter(
    (t) => text(t, "OutlineLevel") !== "0" && text(t, "UID") !== "0" && text(t, "IsNull") !== "1",
  );
  const startCandidates = [dateOf(text(root, "StartDate")), ...rawTasks.map((t) => dateOf(text(t, "Start")))].filter(
    isValidDate,
  );
  const start = startCandidates.length ? startCandidates.sort()[0] : new Date().toISOString().slice(0, 10);

  const idOf = new Map<string, string>(); // MSP UID → bizim kimlik
  rawTasks.forEach((t, i) => idOf.set(text(t, "UID"), `msp-${text(t, "UID") || i}`));

  let manual = 0;
  let percentLags = 0;
  const tasks: Task[] = rawTasks.map((t) => {
    const milestone = text(t, "Milestone") === "1";
    const duration = milestone ? 0 : toDays(text(t, "Duration"));
    let snet: string | undefined;
    const constraintDate = dateOf(text(t, "ConstraintDate"));
    if (text(t, "ConstraintType") === SNET && isValidDate(constraintDate)) snet = constraintDate;
    // Elle zamanlanan görev: MS Project'teki tarihi korunsun diye başlangıç kısıtı olur
    if (text(t, "Manual") === "1" && isValidDate(dateOf(text(t, "Start")))) {
      snet = dateOf(text(t, "Start"));
      manual++;
    }
    const predecessors: Predecessor[] = children(t, "PredecessorLink").flatMap((l) => {
      const taskId = idOf.get(text(l, "PredecessorUID"));
      if (!taskId) return [];
      const format = Number(text(l, "LagFormat"));
      let lag = 0;
      if (format === 19 || format === 20) percentLags++;
      // LinkLag dakikanın onda biri cinsinden
      else lag = Math.round(Number(text(l, "LinkLag") || 0) / 10 / minutesPerDay);
      return [{ taskId, type: TYPE_FROM_MSP[text(l, "Type")] ?? "FS", lag }];
    });
    return {
      id: idOf.get(text(t, "UID"))!,
      name: text(t, "Name"),
      duration,
      outline: Math.max(0, (Number(text(t, "OutlineLevel")) || 1) - 1),
      percent: Math.min(100, Math.max(0, Math.round(Number(text(t, "PercentComplete")) || 0))),
      startNoEarlierThan: snet,
      predecessors,
    };
  });

  // Kaynaklar (yalnızca iş kaynakları; malzeme ve maliyet kaynakları atlanır)
  const resources: Resource[] = [];
  const resOf = new Map<string, string>();
  let skippedRes = 0;
  for (const r of children(child(root, "Resources"), "Resource")) {
    const uidText = text(r, "UID");
    const name = text(r, "Name");
    if (uidText === "0" || text(r, "IsNull") === "1" || !name) continue;
    if (text(r, "Type") && text(r, "Type") !== "1") {
      skippedRes++;
      continue;
    }
    const id = `msp-r${uidText}`;
    // StandardRate saatliktir; günlük ücrete çevrilir
    const hourly = Number(text(r, "StandardRate")) || 0;
    resources.push({
      id,
      name,
      maxUnits: Math.max(1, Math.round((Number(text(r, "MaxUnits") || 1) || 1) * 100)),
      rate: Math.round(hourly * hoursPerDay * 100) / 100,
    });
    resOf.set(uidText, id);
  }
  const taskByUid = new Map(rawTasks.map((t, i) => [text(t, "UID"), tasks[i]]));
  for (const a of children(child(root, "Assignments"), "Assignment")) {
    const task = taskByUid.get(text(a, "TaskUID"));
    const resourceId = resOf.get(text(a, "ResourceUID"));
    if (!task || !resourceId) continue;
    const units = Math.max(1, Math.round((Number(text(a, "Units") || 1) || 1) * 100));
    const list: Assignment[] = (task.assignments ??= []);
    if (!list.some((x) => x.resourceId === resourceId)) list.push({ resourceId, units });
  }
  if (skippedRes) warnings.push(`${skippedRes} malzeme/maliyet kaynağı desteklenmiyor, alınmadı.`);
  if (manual) warnings.push(`${manual} elle zamanlanan görev, başlangıç tarihi kısıtıyla alındı.`);
  if (percentLags) warnings.push(`${percentLags} yüzdeli gecikme desteklenmiyor, 0 alındı.`);

  return {
    project: {
      name: text(root, "Title") || text(root, "Name").replace(/\.xml$/i, "") || "MS Project",
      start,
      tasks: normalizeOutline(tasks),
      holidays: readHolidays(root),
      resources,
      workdays: readWorkdays(root),
    },
    warnings,
  };
}

function projectCalendar(root: Element): Element | undefined {
  const calendars = children(child(root, "Calendars"), "Calendar");
  const projectCalUid = text(root, "CalendarUID");
  return (
    calendars.find((c) => text(c, "UID") === projectCalUid) ??
    calendars.find((c) => text(c, "IsBaseCalendar") === "1") ??
    calendars[0]
  );
}

/** Proje takviminin çalışılan hafta günleri (DayType 1 = pazar … 7 = cumartesi); bulunamazsa pazartesi–cuma */
function readWorkdays(root: Element): number[] {
  const cal = projectCalendar(root);
  if (!cal) return [...DEFAULT_WORKDAYS];
  const days: number[] = [];
  let seen = false;
  for (const wd of children(child(cal, "WeekDays"), "WeekDay")) {
    const type = Number(text(wd, "DayType"));
    if (!(type >= 1 && type <= 7) || child(wd, "TimePeriod")) continue;
    seen = true;
    if (text(wd, "DayWorking") === "1") days.push(type - 1);
  }
  return seen ? normalizeWorkdays(days) : [...DEFAULT_WORKDAYS];
}

/** Proje takvimindeki çalışılmayan istisna günleri */
function readHolidays(root: Element): Holiday[] {
  const cal = projectCalendar(root);
  if (!cal) return [];
  const result = new Map<string, string>();
  const addRange = (from: string, to: string, name: string) => {
    if (!isValidDate(from) || !isValidDate(to)) return;
    // Uzun aralıklar (ör. yıllarca süren yanlış istisna) için sınır
    for (let d = from, n = 0; d <= to && n < 366; d = addDays(d, 1), n++) result.set(d, name || "Tatil");
  };
  // MS Project 2007+: <Exceptions>
  for (const ex of children(child(cal, "Exceptions"), "Exception")) {
    if (text(ex, "DayWorking") === "1") continue;
    const tp = child(ex, "TimePeriod");
    if (tp) addRange(dateOf(text(tp, "FromDate")), dateOf(text(tp, "ToDate")), text(ex, "Name"));
  }
  // Eski biçim: <WeekDays><WeekDay><DayType>0</DayType> ile tarih aralığı
  for (const wd of children(child(cal, "WeekDays"), "WeekDay")) {
    if (text(wd, "DayType") !== "0" || text(wd, "DayWorking") === "1") continue;
    const tp = child(wd, "TimePeriod");
    if (tp) addRange(dateOf(text(tp, "FromDate")), dateOf(text(tp, "ToDate")), "Tatil");
  }
  return [...result].map(([date, name]) => ({ date, name })).sort((a, b) => a.date.localeCompare(b.date));
}

const money = (n: number) => (Math.round(n * 100) / 100).toString();

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Projeyi MS Project XML olarak yazar (8 saatlik gün, 08:00–17:00). */
export function toMspXml(project: Project, schedule: Schedule): string {
  const uid = new Map(project.tasks.map((t, i) => [t.id, i + 1]));
  const wbs = wbsCodes(project.tasks);
  const hours = (days: number) => `PT${days * 8}H0M0S`;
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  out.push(`<Project xmlns="${NS}">`);
  out.push(`  <Name>${esc(project.name)}.xml</Name>`);
  out.push(`  <Title>${esc(project.name)}</Title>`);
  out.push(`  <ScheduleFromStart>1</ScheduleFromStart>`);
  out.push(`  <StartDate>${schedule.calendar.base}T08:00:00</StartDate>`);
  out.push(`  <FinishDate>${schedule.finishDate}T17:00:00</FinishDate>`);
  out.push(`  <MinutesPerDay>480</MinutesPerDay>`);
  const workdays = normalizeWorkdays(project.workdays);
  out.push(`  <MinutesPerWeek>${480 * workdays.length}</MinutesPerWeek>`);
  out.push(`  <DaysPerMonth>20</DaysPerMonth>`);
  out.push(`  <DurationFormat>7</DurationFormat>`);
  out.push(`  <CalendarUID>1</CalendarUID>`);
  out.push(`  <Calendars>`);
  out.push(`    <Calendar>`);
  out.push(`      <UID>1</UID>`);
  out.push(`      <Name>Standart</Name>`);
  out.push(`      <IsBaseCalendar>1</IsBaseCalendar>`);
  out.push(`      <WeekDays>`);
  for (let day = 1; day <= 7; day++) {
    // DayType 1 = pazar … 7 = cumartesi
    const working = workdays.includes(day - 1);
    out.push(`        <WeekDay><DayType>${day}</DayType><DayWorking>${working ? 1 : 0}</DayWorking>`);
    if (working) {
      out.push(`          <WorkingTimes>`);
      out.push(`            <WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime>`);
      out.push(`            <WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime>`);
      out.push(`          </WorkingTimes>`);
    }
    out.push(`        </WeekDay>`);
  }
  out.push(`      </WeekDays>`);
  // Yarım günler (arife) iş günüdür; çalışılmayan istisna olarak yazılmaz
  const offDays = project.holidays.filter((h) => !h.halfDay);
  if (offDays.length) {
    out.push(`      <Exceptions>`);
    for (const h of offDays) {
      out.push(`        <Exception>`);
      out.push(`          <EnteredByOccurrences>0</EnteredByOccurrences>`);
      out.push(`          <TimePeriod><FromDate>${h.date}T00:00:00</FromDate><ToDate>${h.date}T23:59:00</ToDate></TimePeriod>`);
      out.push(`          <Occurrences>1</Occurrences>`);
      out.push(`          <Name>${esc(h.name)}</Name>`);
      out.push(`          <Type>1</Type>`);
      out.push(`          <DayWorking>0</DayWorking>`);
      out.push(`        </Exception>`);
    }
    out.push(`      </Exceptions>`);
  }
  out.push(`    </Calendar>`);
  out.push(`  </Calendars>`);
  out.push(`  <Tasks>`);
  project.tasks.forEach((t, i) => {
    const s = schedule.rows[i];
    const days = s.isSummary ? s.duration : t.duration;
    out.push(`    <Task>`);
    out.push(`      <UID>${i + 1}</UID>`);
    out.push(`      <ID>${i + 1}</ID>`);
    out.push(`      <Name>${esc(t.name)}</Name>`);
    out.push(`      <Manual>0</Manual>`);
    out.push(`      <WBS>${wbs[i]}</WBS>`);
    out.push(`      <OutlineNumber>${wbs[i]}</OutlineNumber>`);
    out.push(`      <OutlineLevel>${t.outline + 1}</OutlineLevel>`);
    const startTime = s.atDayEnd ? "17:00:00" : "08:00:00";
    const finishTime = s.isMilestone ? startTime : "17:00:00";
    out.push(`      <Start>${s.startDate}T${startTime}</Start>`);
    out.push(`      <Finish>${s.finishDate}T${finishTime}</Finish>`);
    out.push(`      <Duration>${hours(days)}</Duration>`);
    out.push(`      <DurationFormat>7</DurationFormat>`);
    out.push(`      <Milestone>${s.isMilestone ? 1 : 0}</Milestone>`);
    out.push(`      <Summary>${s.isSummary ? 1 : 0}</Summary>`);
    out.push(`      <Critical>${s.critical ? 1 : 0}</Critical>`);
    out.push(`      <PercentComplete>${s.isSummary ? 0 : t.percent}</PercentComplete>`);
    out.push(`      <TotalSlack>${s.slack * 480 * 10}</TotalSlack>`);
    if (t.startNoEarlierThan && !s.isSummary) {
      out.push(`      <ConstraintType>${SNET}</ConstraintType>`);
      out.push(`      <ConstraintDate>${t.startNoEarlierThan}T08:00:00</ConstraintDate>`);
    } else {
      out.push(`      <ConstraintType>0</ConstraintType>`);
    }
    for (const p of t.predecessors) {
      const pu = uid.get(p.taskId);
      if (!pu) continue;
      out.push(`      <PredecessorLink>`);
      out.push(`        <PredecessorUID>${pu}</PredecessorUID>`);
      out.push(`        <Type>${TYPE_TO_MSP[p.type]}</Type>`);
      out.push(`        <CrossProject>0</CrossProject>`);
      out.push(`        <LinkLag>${p.lag * 480 * 10}</LinkLag>`);
      out.push(`        <LagFormat>7</LagFormat>`);
      out.push(`      </PredecessorLink>`);
    }
    out.push(`    </Task>`);
  });
  out.push(`  </Tasks>`);
  const resUid = new Map(project.resources.map((r, i) => [r.id, i + 1]));
  if (project.resources.length) {
    out.push(`  <Resources>`);
    project.resources.forEach((r, i) => {
      out.push(`    <Resource>`);
      out.push(`      <UID>${i + 1}</UID>`);
      out.push(`      <ID>${i + 1}</ID>`);
      out.push(`      <Name>${esc(r.name)}</Name>`);
      out.push(`      <Type>1</Type>`);
      out.push(`      <MaxUnits>${(r.maxUnits / 100).toFixed(2)}</MaxUnits>`);
      // Ücret saatlik yazılır, MS Project'te günlük gösterilir (StandardRateFormat 3 = gün)
      out.push(`      <StandardRate>${money(r.rate / 8)}</StandardRate>`);
      out.push(`      <StandardRateFormat>3</StandardRateFormat>`);
      out.push(`      <CalendarUID>1</CalendarUID>`);
      out.push(`    </Resource>`);
    });
    out.push(`  </Resources>`);
  }
  const assignments: string[] = [];
  let auid = 0;
  project.tasks.forEach((t, i) => {
    const s = schedule.rows[i];
    if (s.isSummary) return;
    for (const a of t.assignments ?? []) {
      const ru = resUid.get(a.resourceId);
      if (!ru) continue;
      const rate = project.resources[ru - 1].rate;
      const mins = Math.round((t.duration * 480 * a.units) / 100);
      assignments.push(`    <Assignment>`);
      assignments.push(`      <UID>${++auid}</UID>`);
      assignments.push(`      <TaskUID>${i + 1}</TaskUID>`);
      assignments.push(`      <ResourceUID>${ru}</ResourceUID>`);
      // Öğe sırası MS Project şemasındaki gibidir
      assignments.push(`      <Cost>${money((rate * t.duration * a.units) / 100)}</Cost>`);
      assignments.push(`      <Finish>${s.finishDate}T17:00:00</Finish>`);
      assignments.push(`      <Start>${s.startDate}T08:00:00</Start>`);
      assignments.push(`      <Units>${(a.units / 100).toFixed(2)}</Units>`);
      assignments.push(`      <Work>PT${Math.floor(mins / 60)}H${mins % 60}M0S</Work>`);
      assignments.push(`    </Assignment>`);
    }
  });
  if (assignments.length) out.push(`  <Assignments>`, ...assignments, `  </Assignments>`);
  out.push(`</Project>`);
  return out.join("\n");
}
