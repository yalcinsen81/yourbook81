import { t as tx } from "../i18n";
import { addDays, DEFAULT_WORKDAYS, isValidDate, normalizeWorkdays } from "./calendar";
import { tagBuiltinHolidays, type Holiday } from "./holidays";
import { normalizeOutline, wbsCodes } from "./outline";
import { taskCost } from "./costs";
import { safeUrl } from "./storage";
import type { Assignment, Baseline, ConstraintType, CostAccrual, LinkType, Predecessor, Project, Resource, Schedule, Task } from "./types";

// Microsoft Project XML biçimi (Dosya > Farklı Kaydet > XML). .mpp ikili biçimi tarayıcıda okunamaz;
// MS Project'te "XML Biçimi (*.xml)" olarak kaydedilen dosya buraya açılır, buradan kaydedilen dosya MS Project'te açılır.

const NS = "http://schemas.microsoft.com/project";
// MS Project bağ tipi kodları
const TYPE_FROM_MSP: Record<string, LinkType> = { "0": "FF", "1": "FS", "2": "SF", "3": "SS" };
const TYPE_TO_MSP: Record<LinkType, number> = { FF: 0, FS: 1, SF: 2, SS: 3 };
// ConstraintType kodları (0 = en kısa sürede … 7 = şu tarihten geç bitmesin)
const CONSTRAINT_CODES: ConstraintType[] = ["ASAP", "ALAP", "MSO", "MFO", "SNET", "SNLT", "FNET", "FNLT"];
// FixedCostAccrual: 1 = başta, 2 = eşit, 3 = sonda
const ACCRUAL_TO_MSP: Record<CostAccrual, number> = { start: 1, prorated: 2, end: 3 };
const ACCRUAL_FROM_MSP: Record<string, CostAccrual> = { "1": "start", "3": "end" };

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
    throw new Error(tx("err.notMspXml"));
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
  // Referans planlar (MS Project Baseline 0–2), MSP UID'sine göre
  const baselineRows: Record<number, Record<string, Baseline["tasks"][string]>> = {};
  const tasks: Task[] = rawTasks.map((t) => {
    const milestone = text(t, "Milestone") === "1";
    const duration = milestone ? 0 : toDays(text(t, "Duration"));
    let constraint: Task["constraint"];
    const constraintDate = dateOf(text(t, "ConstraintDate"));
    const ctype = CONSTRAINT_CODES[Number(text(t, "ConstraintType") || 0)] ?? "ASAP";
    if (ctype === "ALAP") constraint = { type: "ALAP" };
    else if (ctype !== "ASAP" && isValidDate(constraintDate)) constraint = { type: ctype, date: constraintDate };
    // Elle zamanlanan görev: MS Project'teki tarihi korunsun diye başlangıç kısıtı olur
    if (text(t, "Manual") === "1" && isValidDate(dateOf(text(t, "Start")))) {
      constraint = { type: "SNET", date: dateOf(text(t, "Start")) };
      manual++;
    }
    const extra: Partial<Task> = {};
    const deadline = dateOf(text(t, "Deadline"));
    if (isValidDate(deadline)) extra.deadline = deadline;
    const actualStart = dateOf(text(t, "ActualStart"));
    const actualFinish = dateOf(text(t, "ActualFinish"));
    if (isValidDate(actualStart)) {
      extra.actualStart = actualStart;
      if (isValidDate(actualFinish)) extra.actualFinish = actualFinish;
    }
    const fixedCost = Number(text(t, "FixedCost")) || 0;
    if (fixedCost > 0) extra.fixedCost = fixedCost;
    const actualCost = Number(text(t, "ActualCost"));
    if (text(t, "ActualCost") && actualCost > 0) extra.actualCost = actualCost;
    const notes = text(t, "Notes").trim();
    if (notes) extra.notes = notes.slice(0, 20_000);
    const url = safeUrl(text(t, "HyperlinkAddress"));
    if (url) {
      const title = text(t, "Hyperlink").trim();
      extra.links = [title && title !== url ? { url, title } : { url }];
    }
    const accrual = ACCRUAL_FROM_MSP[text(t, "FixedCostAccrual")];
    if (accrual) extra.costAccrual = accrual;
    for (const b of children(t, "Baseline")) {
      const n = Number(text(b, "Number"));
      const bs = dateOf(text(b, "Start"));
      const bf = dateOf(text(b, "Finish"));
      if (!(n >= 0 && n < 3) || !isValidDate(bs) || !isValidDate(bf)) continue;
      const uid = text(t, "UID");
      const entry = (baselineRows[n] ??= {});
      entry[uid] = { start: bs, finish: bf, duration: toDays(text(b, "Duration")), cost: Number(text(b, "Cost")) || 0 };
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
      ...(constraint ? { constraint } : {}),
      ...extra,
      predecessors,
    };
  });

  // Kaynaklar: iş (Type 1) ve malzeme (Type 0); maliyet kaynakları (Type 2) atlanır
  const resources: Resource[] = [];
  const resOf = new Map<string, string>();
  let skippedRes = 0;
  for (const r of children(child(root, "Resources"), "Resource")) {
    const uidText = text(r, "UID");
    const name = text(r, "Name");
    if (uidText === "0" || text(r, "IsNull") === "1" || !name) continue;
    const type = text(r, "Type") || "1";
    if (type !== "1" && type !== "0") {
      skippedRes++;
      continue;
    }
    const id = `msp-r${uidText}`;
    const standard = Number(text(r, "StandardRate")) || 0;
    const perUse = Number(text(r, "CostPerUse")) || 0;
    if (type === "0") {
      // Malzeme: StandardRate birim fiyattır
      const label = text(r, "MaterialLabel");
      resources.push({ id, name, maxUnits: 100, rate: standard, type: "material", ...(label ? { unitLabel: label } : {}) });
    } else if (!standard && perUse) {
      resources.push({ id, name, maxUnits: Math.max(1, Math.round((Number(text(r, "MaxUnits") || 1) || 1) * 100)), rate: perUse, rateType: "use" });
    } else {
      // StandardRate saatliktir; günlük ücrete çevrilir
      resources.push({
        id,
        name,
        maxUnits: Math.max(1, Math.round((Number(text(r, "MaxUnits") || 1) || 1) * 100)),
        rate: Math.round(standard * hoursPerDay * 100) / 100,
      });
    }
    resOf.set(uidText, id);
  }
  const taskByUid = new Map(rawTasks.map((t, i) => [text(t, "UID"), tasks[i]]));
  for (const a of children(child(root, "Assignments"), "Assignment")) {
    const task = taskByUid.get(text(a, "TaskUID"));
    const resourceId = resOf.get(text(a, "ResourceUID"));
    if (!task || !resourceId) continue;
    const material = resources.find((r) => r.id === resourceId)?.type === "material";
    const raw = Number(text(a, "Units") || 1) || 1;
    const units = material ? Math.round(raw * 100) / 100 : Math.max(1, Math.round(raw * 100));
    const list: Assignment[] = (task.assignments ??= []);
    if (!list.some((x) => x.resourceId === resourceId)) list.push({ resourceId, units });
  }
  if (skippedRes) warnings.push(tx("xml.skippedResources", { n: skippedRes }));
  if (manual) warnings.push(tx("xml.manualTasks", { n: manual }));
  if (percentLags) warnings.push(tx("xml.percentLags", { n: percentLags }));

  const uidToId = new Map(rawTasks.map((t, i) => [text(t, "UID"), tasks[i].id]));
  const baselines: Baseline[] = Object.entries(baselineRows).map(([n, rows]) => {
    const entries = Object.entries(rows).flatMap(([uid, v]) => (uidToId.has(uid) ? [[uidToId.get(uid)!, v] as const] : []));
    return {
      index: Number(n),
      name: `${tx("baseline.default")} ${Number(n) + 1}`,
      savedAt: "",
      finish: entries.reduce((m, [, v]) => (v.finish > m ? v.finish : m), ""),
      tasks: Object.fromEntries(entries),
    };
  });
  return {
    project: {
      name: text(root, "Title") || text(root, "Name").replace(/\.xml$/i, "") || "MS Project",
      start,
      tasks: normalizeOutline(tasks),
      holidays: tagBuiltinHolidays(readHolidays(root)),
      resources,
      workdays: readWorkdays(root),
      ...(baselines.length ? { baselines } : {}),
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
  out.push(`      <Name>${tx("xml.calendarName")}</Name>`);
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
    out.push(`      <PercentComplete>${s.isSummary ? s.percent : t.percent}</PercentComplete>`);
    if (!s.isSummary && t.actualStart) {
      out.push(`      <ActualStart>${t.actualStart}T08:00:00</ActualStart>`);
      if (t.actualFinish) out.push(`      <ActualFinish>${t.actualFinish}T17:00:00</ActualFinish>`);
    }
    if (!s.isSummary) {
      out.push(`      <Cost>${money(taskCost(t, project))}</Cost>`);
      if (t.fixedCost) out.push(`      <FixedCost>${money(t.fixedCost)}</FixedCost>`);
      out.push(`      <FixedCostAccrual>${ACCRUAL_TO_MSP[t.costAccrual ?? "prorated"]}</FixedCostAccrual>`);
      if (t.actualCost !== undefined) out.push(`      <ActualCost>${money(t.actualCost)}</ActualCost>`);
    }
    out.push(`      <TotalSlack>${Math.round(s.slack * 480 * 10)}</TotalSlack>`);
    const c = s.isSummary ? undefined : t.constraint;
    out.push(`      <ConstraintType>${CONSTRAINT_CODES.indexOf(c?.type ?? "ASAP")}</ConstraintType>`);
    if (c?.date) {
      const finishType = c.type === "MFO" || c.type === "FNET" || c.type === "FNLT";
      out.push(`      <ConstraintDate>${c.date}T${finishType ? "17:00:00" : "08:00:00"}</ConstraintDate>`);
    }
    if (t.deadline) out.push(`      <Deadline>${t.deadline}T17:00:00</Deadline>`);
    // MS Project görev başına tek köprü tutar; ilk bağlantı yazılır
    const link = t.links?.[0];
    if (link) {
      out.push(`      <Hyperlink>${esc(link.title ?? link.url)}</Hyperlink>`);
      out.push(`      <HyperlinkAddress>${esc(link.url)}</HyperlinkAddress>`);
    }
    if (t.notes) out.push(`      <Notes>${esc(t.notes)}</Notes>`);
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
    for (const b of project.baselines ?? []) {
      const row = b.tasks[t.id];
      if (!row) continue;
      out.push(`      <Baseline>`);
      out.push(`        <Number>${b.index}</Number>`);
      out.push(`        <Start>${row.start}T08:00:00</Start>`);
      out.push(`        <Finish>${row.finish}T17:00:00</Finish>`);
      out.push(`        <Duration>${hours(row.duration)}</Duration>`);
      out.push(`        <Cost>${money(row.cost)}</Cost>`);
      out.push(`      </Baseline>`);
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
      if (r.type === "material") {
        // Malzeme: StandardRate birim fiyat, atamadaki Units miktar
        out.push(`      <Type>0</Type>`);
        if (r.unitLabel) out.push(`      <MaterialLabel>${esc(r.unitLabel)}</MaterialLabel>`);
        out.push(`      <StandardRate>${money(r.rate)}</StandardRate>`);
      } else {
        out.push(`      <Type>1</Type>`);
        out.push(`      <MaxUnits>${(r.maxUnits / 100).toFixed(2)}</MaxUnits>`);
        if (r.rateType === "use") {
          out.push(`      <StandardRate>0</StandardRate>`);
          out.push(`      <CostPerUse>${money(r.rate)}</CostPerUse>`);
        } else {
          // Ücret saatlik yazılır; MS Project'te günlük ya da saatlik gösterilir (StandardRateFormat 2 = saat, 3 = gün)
          const hourly = r.rateType === "hour" ? r.rate : r.rate / 8;
          out.push(`      <StandardRate>${money(hourly)}</StandardRate>`);
          out.push(`      <StandardRateFormat>${r.rateType === "hour" ? 2 : 3}</StandardRateFormat>`);
        }
      }
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
      const res = project.resources[ru - 1];
      const material = res.type === "material";
      const mins = Math.round((t.duration * 480 * a.units) / 100);
      const cost = material ? a.units * res.rate : res.rateType === "use" ? res.rate : ((res.rateType === "hour" ? res.rate * 8 : res.rate) * t.duration * a.units) / 100;
      assignments.push(`    <Assignment>`);
      assignments.push(`      <UID>${++auid}</UID>`);
      assignments.push(`      <TaskUID>${i + 1}</TaskUID>`);
      assignments.push(`      <ResourceUID>${ru}</ResourceUID>`);
      // Öğe sırası MS Project şemasındaki gibidir
      assignments.push(`      <Cost>${money(cost)}</Cost>`);
      assignments.push(`      <Finish>${s.finishDate}T17:00:00</Finish>`);
      assignments.push(`      <Start>${s.startDate}T08:00:00</Start>`);
      if (material) {
        assignments.push(`      <Units>${a.units}</Units>`);
      } else {
        assignments.push(`      <Units>${(a.units / 100).toFixed(2)}</Units>`);
        assignments.push(`      <Work>PT${Math.floor(mins / 60)}H${mins % 60}M0S</Work>`);
      }
      assignments.push(`    </Assignment>`);
    }
  });
  if (assignments.length) out.push(`  <Assignments>`, ...assignments, `  </Assignments>`);
  out.push(`</Project>`);
  return out.join("\n");
}
