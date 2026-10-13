import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type UIEvent } from "react";
import { addDays, diffDays, formatShort, isValidDate, nextWorkday, parseDate } from "./model/calendar";
import { ancestorsOf, indent, isSummaryAt, move, normalizeOutline, outdent, subtreeEnd, wbsCodes } from "./model/outline";
import { formatPredecessors, parsePredecessors } from "./model/predecessors";
import { emptyProject, sampleProject } from "./model/sample";
import { wouldCreateCycle } from "./model/schedule";
import { parseMspXml, toMspXml } from "./model/mspXml";
import { newId, normalizeCurrency, sanitizeProject } from "./model/storage";
import type { Project, Task } from "./model/types";
import { CalendarDialog } from "./components/CalendarDialog";
import { Gantt } from "./components/Gantt";
import { TaskGrid, GRID_WIDTH, type GridRow } from "./components/TaskGrid";
import { ROW_H } from "./components/layout";
import { todayIso, useProject } from "./useProject";
import { fileLinkSupported, useFileLink } from "./useFileLink";
import { Icon, type IconName } from "./components/icons";
import { ResourceView } from "./components/ResourceView";
import { ChartsView } from "./components/ChartsView";
import { assignFromText, formatAssignments, overallocatedTasks, progressCurves, projectWeight, resourceUsage, taskCost } from "./model/resources";
import { progressWarnings } from "./model/ops";
import { normalizeWorkdays } from "./model/calendar";
import { ProjectSetupDialog } from "./components/ProjectSetupDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { DateInput } from "./components/DateInput";
import { formatMoney, formatNumber, setCurrency, t, weekStartDay, type MessageKey } from "./i18n";
import { useLocale } from "./i18n/react";
import { holidayLabel } from "./model/holidays";
import { parseDuration } from "./model/duration";
import { anchoredScroll, clampPpd, fitPpd, MAX_PPD, scaleFor, ZOOM_STEP } from "./model/timescale";
import { loadView, saveView, viewKey } from "./settings";

type View = "gantt" | "resources" | "charts";

export default function App() {
  const { project, schedule, update, undo, redo, canUndo, canRedo } = useProject();
  // Dil ya da tarih biçimi değişince yeniden çizilir; metin üreten useMemo'lar buna bağlıdır
  const loc = useLocale();
  // Para birimi proje ayarıdır; biçimleyiciler her çizimde güncel projeninkini kullanır
  setCurrency(project.currency);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [ppd, setPpd] = useState(26);
  const [ganttWidth, setGanttWidth] = useState(900);
  /** Proje bütünüyle değişti (dosya açıldı, yeni proje): kayıtlı Gantt görünümü geri yüklenir */
  const [loadToken, setLoadToken] = useState(0);
  const [gridWidth, setGridWidth] = useState(() => Math.min(GRID_WIDTH, Math.max(700, Math.round(window.innerWidth * 0.56))));
  const [message, setMessage] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [linkMenu, setLinkMenu] = useState(false);
  const [view, setView] = useState<View>("gantt");
  const [pickedResource, setPickedResource] = useState<string | null>(null);
  const [theme, setTheme] = useTheme();
  const install = useInstallPrompt();
  const gridRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const today = todayIso();

  const flashTimer = useRef<number | undefined>(undefined);
  const flash = useCallback((text: string) => {
    setMessage(text);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setMessage(null), 4000);
  }, []);

  const replaceProject = useCallback(
    (p: Project) => {
      update(() => p);
      setSelection(new Set());
      setLoadToken((n) => n + 1);
    },
    [update],
  );
  const fileLink = useFileLink(project, replaceProject, flash);

  const usage = useMemo(() => resourceUsage(project, schedule), [project, schedule]);
  const overTasks = useMemo(() => overallocatedTasks(usage), [usage]);
  // İlerleme, S eğrisi ve uyarılar tek ağırlıkla (proje ayarı, varsayılan maliyet)
  const curves = useMemo(() => progressCurves(project, schedule, today), [project, schedule, today]);
  const warnings = useMemo(() => progressWarnings(curves, projectWeight(project)), [curves, project]);
  const noCostRows = useMemo(() => new Set(curves.weight === "cost" ? curves.zeroCostRows : []), [curves]);

  // Görünür satırlar: kapalı özetlerin altları gizlenir
  const rows: GridRow[] = useMemo(() => {
    const wbs = wbsCodes(project.tasks);
    const anc = ancestorsOf(project.tasks);
    // Özet görevin maliyeti alt görevlerinin toplamı
    const leafCost = project.tasks.map((task, i) => (schedule.rows[i].isSummary ? 0 : taskCost(task, project)));
    const cost = project.tasks.map((_, i) =>
      schedule.rows[i].isSummary ? leafCost.slice(i + 1, subtreeEnd(project.tasks, i)).reduce((a, b) => a + b, 0) : leafCost[i],
    );
    return project.tasks
      .map((task, i) => ({
        task,
        sched: schedule.rows[i],
        wbs: wbs[i],
        predText: formatPredecessors(task.predecessors, project.tasks),
        resText: schedule.rows[i].isSummary ? "" : formatAssignments(task.assignments, project.resources),
        overallocated: overTasks.has(task.id),
        noCost: noCostRows.has(i + 1),
        cost: cost[i],
        collapsed: collapsed.has(task.id),
      }))
      .filter((r) => !(anc.get(r.task.id) ?? []).some((a) => collapsed.has(a)));
    // loc: öncül metnindeki gecikme birimi (g / d) dile bağlı
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, schedule, collapsed, overTasks, noCostRows, loc]);

  const cycle = useMemo(() => new Set(schedule.cycle), [schedule.cycle]);
  // Hazır tatillerin adı seçili dilde; kullanıcının girdiği ad olduğu gibi
  const holidayMap = useMemo(
    () => new Map(project.holidays.map((h) => [h.date, { name: holidayLabel(h), halfDay: !!h.halfDay }])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.holidays, loc],
  );
  const workdays = useMemo(() => normalizeWorkdays(project.workdays), [project.workdays]);

  // Gantt'ta sürükleme: taşıma "şundan önce başlamasın" kısıtı koyar (MS Project gibi), sağ uç süreyi değiştirir
  const onDragTask = useCallback(
    (id: string, mode: "move" | "resize", days: number) => {
      const r = schedule.byId.get(id);
      if (!r) return;
      const cal = schedule.calendar;
      if (mode === "move") {
        const start = cal.nextWorkday(addDays(r.startDate, days));
        update((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === id ? { ...t, startNoEarlierThan: start } : t)) }));
      } else {
        const finish = cal.prevWorkday(addDays(r.finishDate, days));
        const duration = Math.max(1, cal.workdaysBetween(r.startDate, finish));
        update((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === id ? { ...t, duration } : t)) }));
      }
    },
    [schedule, update],
  );

  // Zaman çizelgesi: proje başlangıcından önceki hafta başı (bir hafta pay), bitişten 4 hafta sonrası;
  // uzaklaştırınca görünür alanı dolduracak kadar uzar
  const timeline = useMemo(() => {
    const first = parseDate(project.start).getUTCDay();
    const start = addDays(project.start, -((first - weekStartDay() + 7) % 7) - 7);
    const lastDate = [schedule.finishDate, today].sort()[1];
    const days = Math.max(diffDays(start, lastDate) + 28, 70, Math.ceil(ganttWidth / ppd) + 7);
    return { start, days };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.start, schedule.finishDate, today, ganttWidth, ppd, loc]);

  // --- Seçim ---
  const selectedIndexes = useMemo(
    () => project.tasks.map((t, i) => (selection.has(t.id) ? i : -1)).filter((i) => i >= 0),
    [project.tasks, selection],
  );
  const primary = selectedIndexes[0] ?? -1;

  const onSelect = useCallback(
    (id: string, e: MouseEvent) => {
      if (e.shiftKey && anchor) {
        const ids = rows.map((r) => r.task.id);
        const [a, b] = [ids.indexOf(anchor), ids.indexOf(id)].sort((x, y) => x - y);
        if (a >= 0) {
          setSelection(new Set(ids.slice(a, b + 1)));
          return;
        }
      }
      if (e.ctrlKey || e.metaKey) {
        setSelection((s) => {
          const n = new Set(s);
          if (n.has(id)) n.delete(id);
          else n.add(id);
          return n;
        });
      } else if (!selection.has(id) || selection.size > 1) {
        setSelection(new Set([id]));
      }
      setAnchor(id);
    },
    [anchor, rows, selection],
  );

  // --- Görev işlemleri ---
  const patchTask = useCallback(
    (id: string, patch: Partial<Task>) =>
      update((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
    [update],
  );

  const insertTask = useCallback(
    (milestone = false, atEnd = false) => {
      const id = newId();
      let visibleRow = 0;
      update((p) => {
        const at = atEnd || primary < 0 ? p.tasks.length : primary + 1;
        // Yeni görev üstündeki satırın düzeyine girer; üstteki özetse onun ilk alt görevi olur
        const outline = at > 0 ? p.tasks[at - 1].outline + (isSummaryAt(p.tasks, at - 1) ? 1 : 0) : 0;
        const task: Task = {
          id,
          name: milestone ? t("default.milestone") : t("default.task"),
          duration: milestone ? 0 : 1,
          outline,
          percent: 0,
          predecessors: [],
        };
        visibleRow = at;
        return { ...p, tasks: normalizeOutline([...p.tasks.slice(0, at), task, ...p.tasks.slice(at)]) };
      });
      setSelection(new Set([id]));
      setAnchor(id);
      // Yeni satırın adını hemen düzenlemeye aç (satır görünür alana kaydırılınca çizilir)
      requestAnimationFrame(() => {
        const grid = gridRef.current;
        if (grid) {
          const y = visibleRow * ROW_H;
          if (y < grid.scrollTop || y > grid.scrollTop + grid.clientHeight - 2 * ROW_H) grid.scrollTop = Math.max(0, y - grid.clientHeight / 2);
        }
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`input[data-row="${visibleRow}"][data-col="name"]`)?.focus());
      });
    },
    [primary, update],
  );

  const deleteSelected = useCallback(() => {
    if (!selection.size) return;
    update((p) => {
      // Özet silinirse alt görevleri de silinir (MS Project gibi)
      const doomed = new Set<string>();
      p.tasks.forEach((t, i) => {
        if (selection.has(t.id)) for (let j = i; j < subtreeEnd(p.tasks, i); j++) doomed.add(p.tasks[j].id);
      });
      const tasks = p.tasks
        .filter((t) => !doomed.has(t.id))
        .map((t) => ({ ...t, predecessors: t.predecessors.filter((pr) => !doomed.has(pr.taskId)) }));
      return { ...p, tasks: normalizeOutline(tasks) };
    });
    setSelection(new Set());
  }, [selection, update]);

  const shiftOutline = useCallback(
    (dir: 1 | -1) => {
      if (!selectedIndexes.length) return;
      update((p) => {
        let tasks = p.tasks;
        const order = dir === 1 ? selectedIndexes : [...selectedIndexes].reverse();
        for (const id of order.map((i) => p.tasks[i].id)) {
          const idx = tasks.findIndex((t) => t.id === id);
          tasks = dir === 1 ? indent(tasks, idx) : outdent(tasks, idx);
        }
        // Görev kendi özetine bağlı kaldıysa bağı kopar (döngü olur)
        const anc = ancestorsOf(tasks);
        tasks = tasks.map((t) => {
          const mine = new Set(anc.get(t.id));
          const kept = t.predecessors.filter((pr) => !mine.has(pr.taskId) && !(anc.get(pr.taskId) ?? []).includes(t.id));
          return kept.length === t.predecessors.length ? t : { ...t, predecessors: kept };
        });
        return { ...p, tasks };
      });
    },
    [selectedIndexes, update],
  );

  const moveSelected = useCallback(
    (dir: -1 | 1) => {
      if (primary < 0) return;
      update((p) => ({ ...p, tasks: move(p.tasks, primary, dir) }));
    },
    [primary, update],
  );

  const linkSelected = useCallback(() => {
    if (selectedIndexes.length < 2) {
      flash(t("msg.linkNeedTwo"));
      return;
    }
    let skipped = 0;
    update((p) => {
      let next = p;
      for (let k = 1; k < selectedIndexes.length; k++) {
        const pred = p.tasks[selectedIndexes[k - 1]].id;
        const succ = p.tasks[selectedIndexes[k]].id;
        const succTask = next.tasks.find((t) => t.id === succ)!;
        if (succTask.predecessors.some((x) => x.taskId === pred)) continue;
        if (wouldCreateCycle(next, succ, pred)) {
          skipped++;
          continue;
        }
        next = {
          ...next,
          tasks: next.tasks.map((t) =>
            t.id === succ ? { ...t, predecessors: [...t.predecessors, { taskId: pred, type: "FS", lag: 0 }] } : t,
          ),
        };
      }
      return next;
    });
    if (skipped) flash(t("msg.linksSkipped", { n: skipped }));
  }, [flash, selectedIndexes, update]);

  const unlinkSelected = useCallback(() => {
    if (!selection.size) return;
    update((p) => ({
      ...p,
      tasks: p.tasks.map((t) => {
        if (selection.has(t.id)) {
          // Seçimdeki görevlerin seçimdeki öncüllerini kaldır; tek görev seçiliyse tüm öncüllerini
          const preds = selection.size === 1 ? [] : t.predecessors.filter((pr) => !selection.has(pr.taskId));
          return preds.length === t.predecessors.length ? t : { ...t, predecessors: preds };
        }
        return t;
      }),
    }));
  }, [selection, update]);

  // --- Hücre düzenleme ---
  const onDuration = (id: string, text: string) => {
    // 5, 5g, 5d (iş günü) · 2w (hafta) · 4h (saat, güne yukarı yuvarlanır)
    const parsed = parseDuration(text, workdays.length);
    if (!parsed) {
      flash(t("err.duration"));
      return false;
    }
    if (parsed.hours !== undefined) flash(t("msg.hoursRounded", { hours: formatNumber(parsed.hours), days: String(parsed.days) }));
    patchTask(id, { duration: Math.min(10_000, parsed.days) });
    return true;
  };

  const onStart = (id: string, iso: string) => {
    if (!iso) {
      patchTask(id, { constraint: undefined });
      return true;
    }
    if (!isValidDate(iso)) return false;
    patchTask(id, { constraint: { type: "SNET", date: iso } });
    return true;
  };

  const onPredecessors = (id: string, text: string) => {
    const { predecessors, errors } = parsePredecessors(text, project.tasks, id);
    if (errors.length) {
      flash(t("err.predecessor", { parts: errors.join(", ") }));
      return false;
    }
    const base: Project = {
      ...project,
      tasks: project.tasks.map((t) => (t.id === id ? { ...t, predecessors: [] } : t)),
    };
    for (const pr of predecessors) {
      if (wouldCreateCycle(base, id, pr.taskId)) {
        const row = project.tasks.findIndex((t) => t.id === pr.taskId) + 1;
        flash(t("err.cycleRow", { row: String(row) }));
        return false;
      }
    }
    patchTask(id, { predecessors });
    return true;
  };

  const onPercent = (id: string, text: string) => {
    const m = /^\s*(\d+)\s*%?\s*$/.exec(text);
    if (!m) return false;
    patchTask(id, { percent: Math.min(100, Number(m[1])) });
    return true;
  };

  const onResources = (id: string, text: string) => {
    const result = assignFromText(project, id, text);
    if (result.errors.length) {
      flash(t("err.resource", { parts: result.errors.join(", ") }));
      return false;
    }
    update(() => result.project);
    if (result.created.length) {
      flash(t("msg.resourcesCreated", { names: result.created.map((r) => r.name).join(", ") }));
    }
    return true;
  };

  // --- Dosya ---
  const downloadAs = (content: string, type: string, fileName: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // İndirme başlamadan bağlantı iptal edilmesin
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const download = (content: string, type: string, ext: string) =>
    downloadAs(content, type, `${safeFileName(project.name) || t("default.fileName")}.${ext}`);
  const exportJson = () => download(JSON.stringify(project, null, 2), "application/json", "json");
  const exportMsp = () => download(toMspXml(project, schedule), "application/xml", "xml");

  const openFile = async (file: File) => {
    const content = await file.text();
    const isXml = /\.xml$/i.test(file.name) || content.trimStart().startsWith("<");
    try {
      let parsed: Project | null;
      let warnings: string[] = [];
      if (isXml) {
        ({ project: parsed, warnings } = parseMspXml(content));
        parsed = sanitizeProject(parsed);
      } else {
        parsed = sanitizeProject(JSON.parse(content));
      }
      if (!parsed) throw new Error();
      const opened = parsed;
      update(() => opened);
      setSelection(new Set());
      setCollapsed(new Set());
      setLoadToken((n) => n + 1);
      flash([t("msg.opened", { name: opened.name, n: opened.tasks.length }), ...warnings].join(" "));
    } catch (e) {
      flash(
        isXml
          ? t("msg.xmlFailed", { detail: e instanceof Error && e.message ? `: ${e.message}` : "." })
          : t("msg.fileInvalid"),
      );
    }
  };

  const newProject = (sample: boolean) => {
    // Boş proje: takvim (çalışma günleri, tatiller) ve ilerleme ağırlığı kullanıcıya sorulur
    if (!sample) {
      setSetupOpen(true);
      return;
    }
    if (!window.confirm(t("msg.confirmSample"))) return;
    update(() => sampleProject(nextWorkday(today)));
    setSelection(new Set());
    setCollapsed(new Set());
    setLoadToken((n) => n + 1);
  };

  // --- Kaydırma eşitleme ---
  const syncing = useRef(false);
  const syncScroll = (source: "grid" | "gantt") => (e: UIEvent<HTMLDivElement>) => {
    if (source === "gantt") rememberView();
    if (syncing.current) {
      syncing.current = false;
      return;
    }
    const other = source === "grid" ? ganttRef.current : gridRef.current;
    if (other && other.scrollTop !== e.currentTarget.scrollTop) {
      syncing.current = true;
      other.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // --- Gantt yakınlaştırma ---
  // Uzaklaştırma sınırı: proje görünür alana sığar; yakınlaştırma sınırı günde 40 piksel
  const projectDays = diffDays(project.start, schedule.finishDate) + 1;
  const minPpd = fitPpd(ganttWidth, projectDays);
  const ppdRef = useRef(ppd);
  ppdRef.current = ppd;
  const pendingLeft = useRef<number | null>(null);

  useEffect(() => {
    const el = ganttRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setGanttWidth(el.clientWidth || 900));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Yeni ölçek; `anchorX` (görünümün solundan piksel) altındaki tarih yerinde kalır */
  const zoomTo = useCallback(
    (next: number, anchorX?: number) => {
      const el = ganttRef.current;
      const clamped = clampPpd(next, minPpd);
      const old = ppdRef.current;
      if (!el || Math.abs(clamped - old) < 1e-6) return;
      const x = anchorX ?? el.clientWidth / 2;
      pendingLeft.current = anchoredScroll(el.scrollLeft, x, old, clamped);
      setPpd(clamped);
    },
    [minPpd],
  );

  // Ölçek değişince kaydırma, yeni genişlik çizildikten sonra uygulanır (titreme olmasın)
  useLayoutEffect(() => {
    const el = ganttRef.current;
    if (el && pendingLeft.current !== null) {
      el.scrollLeft = pendingLeft.current;
      pendingLeft.current = null;
    }
  }, [ppd]);

  const scrollToDate = useCallback(
    (iso: string, at = 80) => {
      const el = ganttRef.current;
      if (!el) return;
      el.scrollLeft = Math.max(0, diffDays(timeline.start, iso) * ppdRef.current - at);
    },
    [timeline.start],
  );

  const fitProject = useCallback(() => {
    const next = fitPpd(ganttRef.current?.clientWidth ?? ganttWidth, projectDays);
    pendingLeft.current = Math.max(0, (diffDays(timeline.start, project.start) - 7) * next);
    setPpd(next);
  }, [ganttWidth, project.start, projectDays, timeline.start]);

  const goToSelected = useCallback(() => {
    if (primary < 0) return;
    const id = project.tasks[primary].id;
    const r = schedule.byId.get(id);
    const index = rows.findIndex((row) => row.task.id === id);
    const el = ganttRef.current;
    if (!r || !el) return;
    scrollToDate(r.startDate);
    if (index >= 0) el.scrollTop = Math.max(0, index * ROW_H - el.clientHeight / 3);
  }, [primary, project.tasks, rows, schedule.byId, scrollToDate]);

  // Görünüm (ölçek, sol kenardaki tarih, dikey kaydırma) projeye göre bu bilgisayarda saklanır
  const key = viewKey(project.name, project.start);
  const keyRef = useRef(key);
  keyRef.current = key;
  const saveTimer = useRef<number | undefined>(undefined);
  const rememberView = useCallback(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const el = ganttRef.current;
      if (!el) return;
      const day = Math.round(el.scrollLeft / ppdRef.current);
      saveView(keyRef.current, { ppd: ppdRef.current, date: addDays(timeline.start, day), scrollTop: el.scrollTop });
    }, 300);
  }, [timeline.start]);
  useEffect(() => rememberView(), [ppd, rememberView]);

  useLayoutEffect(() => {
    // Açılışta ve proje bütünüyle değişince: kayıtlı görünüm, yoksa günlük ölçekte proje başı
    const saved = loadView(key);
    const el = ganttRef.current;
    if (saved && Number.isFinite(saved.ppd) && saved.ppd > 0) {
      const next = Math.min(MAX_PPD, saved.ppd);
      pendingLeft.current = Math.max(0, diffDays(timeline.start, saved.date) * next);
      setPpd(next);
      if (next === ppdRef.current && el) {
        el.scrollLeft = pendingLeft.current;
        pendingLeft.current = null;
      }
      if (el) el.scrollTop = saved.scrollTop || 0;
    } else {
      pendingLeft.current = Math.max(0, diffDays(timeline.start, project.start) * 26 - 80);
      setPpd(26);
      if (ppdRef.current === 26 && el) {
        el.scrollLeft = pendingLeft.current;
        pendingLeft.current = null;
      }
    }
    // Yalnızca proje yüklenince
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadToken]);

  // --- Klavye kısayolları (MS Project'tekilere yakın) ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const editing = (e.target as HTMLElement).tagName === "INPUT";
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey && !editing) {
        e.preventDefault();
        undo();
      } else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) && !editing) {
        e.preventDefault();
        redo();
      } else if (view !== "gantt") {
        // Görev kısayolları yalnızca Gantt görünümünde
      } else if (e.altKey && e.shiftKey && e.key === "ArrowRight") {
        e.preventDefault();
        shiftOutline(1);
      } else if (e.altKey && e.shiftKey && e.key === "ArrowLeft") {
        e.preventDefault();
        shiftOutline(-1);
      } else if (e.key === "Insert") {
        e.preventDefault();
        insertTask();
      } else if (e.key === "Delete" && !editing) {
        e.preventDefault();
        deleteSelected();
      } else if (mod && e.key === "F2") {
        e.preventDefault();
        linkSelected();
      } else if (mod && (e.key === "+" || e.key === "=" || e.code === "NumpadAdd")) {
        // Tarayıcının sayfa yakınlaştırması yerine Gantt yakınlaştırması
        e.preventDefault();
        zoomTo(ppdRef.current * ZOOM_STEP);
      } else if (mod && (e.key === "-" || e.code === "NumpadSubtract")) {
        e.preventDefault();
        zoomTo(ppdRef.current / ZOOM_STEP);
      } else if (mod && (e.key === "0" || e.code === "Numpad0")) {
        e.preventDefault();
        fitProject();
      } else if (e.key === "Home" && !editing) {
        e.preventDefault();
        scrollToDate(project.start);
      } else if (e.key === "End" && !editing) {
        e.preventDefault();
        scrollToDate(schedule.finishDate, (ganttRef.current?.clientWidth ?? 600) - 120);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected, fitProject, insertTask, linkSelected, project.start, redo, schedule.finishDate, scrollToDate, shiftOutline, undo, view, zoomTo]);

  // --- Bölücü sürükleme ---
  const startResize = (e: MouseEvent) => {
    const startX = e.clientX;
    const startW = gridWidth;
    const onMove = (ev: globalThis.MouseEvent) =>
      setGridWidth(Math.max(200, Math.min(GRID_WIDTH + 2, startW + ev.clientX - startX, window.innerWidth - 120)));
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const leafCount = schedule.rows.filter((r) => !r.isSummary).length;
  const progress = Math.round(curves.earnedPercent);
  const totalCost = usage.reduce((s, u) => s + u.cost, 0);
  const criticalCount = schedule.rows.filter((r) => !r.isSummary && r.critical).length;
  const hasSel = selection.size > 0;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" aria-hidden>
          <Icon name="milestone" size={16} />
        </div>
        <div className="title-block">
          <input
            className="project-name"
            value={project.name}
            aria-label={t("app.projectName")}
            title={project.name}
            onChange={(e) => {
              const name = e.target.value;
              update((p) => ({ ...p, name }));
            }}
          />
          <label className="project-start">
            {t("app.start")}
            <DateInput
              value={project.start}
              ariaLabel={t("app.start")}
              onChange={(start) => {
                if (isValidDate(start) && start !== project.start) update((p) => ({ ...p, start }));
              }}
            />
          </label>
        </div>
        <div className="stats">
          <div className="stat">
            <span className="stat-label">{t("stat.finish")}</span>
            <span className="stat-value">{formatShort(schedule.finishDate)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">{t("stat.duration")}</span>
            <span className="stat-value">{t("unit.workdays", { n: schedule.finish })}</span>
          </div>
          <div className="stat" title={t("stat.progressTitle", { weight: t(`weight.${curves.weight}`) })}>
            <span className="stat-label">{t("stat.progress")}</span>
            <span className="stat-value">
              <span className="meter" aria-hidden>
                <span style={{ width: `${progress}%` }} />
              </span>
              {pct(progress)}
            </span>
          </div>
          {totalCost > 0 && (
            <div className="stat">
              <span className="stat-label">{t("stat.cost")}</span>
              <span className="stat-value">{formatMoney(totalCost)}</span>
            </div>
          )}
          <div className="stat crit">
            <span className="stat-label">{t("stat.critical")}</span>
            <span className="stat-value">{t("unit.tasks", { n: criticalCount })}</span>
          </div>
          {warnings.length > 0 && (
            <div className="stat info" title={warnings.join("\n")} role="note">
              <span className="stat-label">{t("stat.info")}</span>
              <span className="stat-value">
                <Icon name="info" size={14} />
                {curves.weightFallback ? t("stat.weightFallbackShort") : t("stat.noCostShort", { n: curves.zeroCostRows.length })}
              </span>
            </div>
          )}
        </div>
        {install.available && (
          <button className="chip install" onClick={install.prompt} title={t("install.title")}>
            <Icon name="download" size={16} />
            {t("install.button")}
          </button>
        )}
        {fileLink.pendingName && !fileLink.fileName && (
          <button className="chip reconnect" onClick={() => void fileLink.reconnect()} title={t("link.reconnectTitle")}>
            <Icon name="plug" size={16} />
            {t("link.reconnect", { name: fileLink.pendingName })}
          </button>
        )}
        <button
          className={`chip ${fileLink.fileName ? "linked" : ""}`}
          onClick={() => setLinkMenu((v) => !v)}
          disabled={!fileLinkSupported}
          title={
            fileLinkSupported ? t("link.title") : t("link.unsupported")
          }
          aria-expanded={linkMenu}
        >
          <Icon name="plug" size={16} />
          {fileLink.fileName ?? t("link.button")}
        </button>
        {linkMenu && (
          <div className="menu" role="menu" onMouseLeave={() => setLinkMenu(false)}>
            <button role="menuitem" onClick={() => { setLinkMenu(false); void fileLink.linkExisting(); }}>
              {t("link.openExisting")}
            </button>
            <button role="menuitem" onClick={() => { setLinkMenu(false); void fileLink.linkNew(); }}>
              {t("link.saveNew")}
            </button>
            {fileLink.fileName && (
              <button role="menuitem" onClick={() => { setLinkMenu(false); fileLink.unlink(); }}>
                {t("link.unlink")}
              </button>
            )}
          </div>
        )}
        <button className="icon-btn" onClick={() => setSettingsOpen(true)} title={t("settings.button")} aria-label={t("settings.title")}>
          <Icon name="gear" />
        </button>
        <button
          className="icon-btn"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? t("theme.light") : t("theme.dark")}
          aria-label={theme === "dark" ? t("theme.toLight") : t("theme.toDark")}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>
      </header>

      <nav className="toolbar" aria-label={t("toolbar.aria")}>
        <div className="tgroup">
          <ToolButton icon="plus" label={t("tb.task")} primary onClick={() => insertTask()} title={t("tb.taskTitle")} />
          <ToolButton icon="milestone" label={t("tb.milestone")} onClick={() => insertTask(true)} title={t("tb.milestoneTitle")} />
          <ToolButton icon="trash" onClick={deleteSelected} disabled={!hasSel} title={t("tb.delete")} />
        </div>
        <div className="tgroup">
          <ToolButton icon="outdent" onClick={() => shiftOutline(-1)} disabled={!hasSel} title={t("tb.outdent")} />
          <ToolButton icon="indent" onClick={() => shiftOutline(1)} disabled={!hasSel} title={t("tb.indent")} />
          <ToolButton icon="up" onClick={() => moveSelected(-1)} disabled={primary < 0} title={t("tb.up")} />
          <ToolButton icon="down" onClick={() => moveSelected(1)} disabled={primary < 0} title={t("tb.down")} />
        </div>
        <div className="tgroup">
          <ToolButton icon="link" label={t("tb.link")} onClick={linkSelected} disabled={selection.size < 2} title={t("tb.linkTitle")} />
          <ToolButton icon="unlink" onClick={unlinkSelected} disabled={!hasSel} title={t("tb.unlink")} />
        </div>
        <div className="tgroup">
          <ToolButton icon="undo" onClick={undo} disabled={!canUndo} title={t("tb.undo")} />
          <ToolButton icon="redo" onClick={redo} disabled={!canRedo} title={t("tb.redo")} />
        </div>
        <div className="tgroup">
          <ToolButton icon="file" onClick={() => newProject(false)} title={t("setup.buttonTitle")} />
          <ToolButton icon="open" label={t("tb.open")} onClick={() => fileRef.current?.click()} title={t("tb.openTitle")} />
          <ToolButton icon="share" label={t("tb.msp")} onClick={exportMsp} title={t("tb.mspTitle")} />
          <ToolButton icon="download" onClick={exportJson} title={t("tb.json")} />
          <ToolButton icon="sparkle" onClick={() => newProject(true)} title={t("tb.sample")} />
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json,application/xml,text/xml,.xml"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void openFile(f);
              e.target.value = "";
            }}
          />
        </div>
        <div className="toolbar-end">
          <div className="segmented views" role="tablist" aria-label={t("view.label")}>
            {(
              [
                ["gantt", "gantt", "view.gantt"],
                ["resources", "users", "view.resources"],
                ["charts", "chart", "view.charts"],
              ] as [View, IconName, MessageKey][]
            ).map(([v, icon, label]) => (
              <button key={v} role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
                <Icon name={icon} size={15} />
                {t(label)}
                {v === "resources" && usage.some((u) => u.overDays.length) && <i className="dot-alert" aria-label={t("view.overAlert")} />}
              </button>
            ))}
          </div>
          {view === "gantt" && (
            <div className="tgroup zoombar" role="toolbar" aria-label={t("zoom.label")}>
              <ToolButton icon="zoomOut" onClick={() => zoomTo(ppd / ZOOM_STEP)} disabled={ppd <= minPpd + 1e-6} title={t("zoom.out")} />
              <span className="zoom-level" title={t("zoom.hint")}>
                {t("zoom.level", { scale: t(`zoom.scale.${scaleFor(ppd)}`), px: formatNumber(ppd, ppd < 10 ? 1 : 0) })}
              </span>
              <ToolButton icon="zoomIn" onClick={() => zoomTo(ppd * ZOOM_STEP)} disabled={ppd >= MAX_PPD - 1e-6} title={t("zoom.in")} />
              <ToolButton icon="fit" label={t("zoom.fitShort")} onClick={fitProject} title={t("zoom.fit")} />
              <ToolButton icon="target" label={t("tb.today")} onClick={() => scrollToDate(today, (ganttRef.current?.clientWidth ?? 600) / 2)} title={t("tb.todayTitle")} />
              <ToolButton icon="crosshair" onClick={goToSelected} disabled={primary < 0} title={t("zoom.selected")} />
            </div>
          )}
          <ToolButton icon="calendar" label={t("tb.calendar")} onClick={() => setCalendarOpen(true)} title={t("calendar.buttonTitle")} />
        </div>
      </nav>

      {view === "resources" && (
        <ResourceView
          project={project}
          schedule={schedule}
          usage={usage}
          selected={pickedResource}
          onSelect={setPickedResource}
          update={update}
          flash={flash}
        />
      )}
      {view === "charts" && (
        <ChartsView
          project={project}
          schedule={schedule}
          usage={usage}
          today={today}
          curves={curves}
          warnings={warnings}
          onWeight={(progressWeight) => update((p) => ({ ...p, progressWeight }))}
          onPickResource={(id) => {
            setPickedResource(id);
            setView("resources");
          }}
        />
      )}
      <main className="workspace" hidden={view !== "gantt"}>
        <div style={{ width: gridWidth, flex: "none", display: "flex" }}>
          <TaskGrid
            rows={rows}
            selection={selection}
            cycle={cycle}
            scrollRef={gridRef}
            onScroll={syncScroll("grid")}
            onSelect={onSelect}
            onToggle={(id) =>
              setCollapsed((s) => {
                const n = new Set(s);
                if (n.has(id)) n.delete(id);
                else n.add(id);
                return n;
              })
            }
            onName={(id, name) => patchTask(id, { name })}
            onDuration={onDuration}
            onStart={onStart}
            onPredecessors={onPredecessors}
            onPercent={onPercent}
            onResources={onResources}
            onAddAtEnd={() => insertTask(false, true)}
          />
        </div>
        <div className="splitter" onMouseDown={startResize} role="separator" aria-orientation="vertical" aria-label={t("app.splitter")} />
        <Gantt
          rows={rows}
          timelineStart={timeline.start}
          days={timeline.days}
          ppd={ppd}
          onZoom={zoomTo}
          today={today}
          selection={selection}
          scrollRef={ganttRef}
          onScroll={syncScroll("gantt")}
          onSelect={onSelect}
          holidays={holidayMap}
          workdays={workdays}
          onDragTask={onDragTask}
        />
      </main>

      {calendarOpen && (
        <CalendarDialog
          holidays={project.holidays}
          workdays={workdays}
          projectStart={project.start}
          onSave={(holidays, days) => update((p) => ({ ...p, holidays, workdays: days }))}
          onClose={() => setCalendarOpen(false)}
        />
      )}
      {setupOpen && (
        <ProjectSetupDialog
          today={today}
          onClose={() => setSetupOpen(false)}
          onCreate={(setup) => {
            update(() => emptyProject(setup.start, setup));
            setSelection(new Set());
            setCollapsed(new Set());
            setSetupOpen(false);
            setLoadToken((n) => n + 1);
          }}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          currency={project.currency ?? "TRY"}
          onCurrency={(code) => update((p) => ({ ...p, currency: code.trim() ? normalizeCurrency(code) : code }))}
          download={(content, fileName) => downloadAs(content, "application/json", fileName)}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <footer className="statusbar">
        <span>{t("unit.tasks", { n: leafCount })}</span>
        <span className="legend">
          <i className="sw normal" /> {t("legend.normal")} <i className="sw critical" /> {t("legend.critical")} <i className="sw summary" />{" "}
          {t("legend.summary")} <i className="sw ms" /> {t("legend.milestone")} <i className="sw over">!</i> {t("legend.over")}
        </span>
        {schedule.cycle.length > 0 && <span className="warn">{t("warn.cycleStatus")}</span>}
        <span className="spacer" />
        <span className="save-state" title={fileLink.fileName ?? undefined}>
          {fileLink.fileName ? t("status.saveFile", { name: fileLink.fileName }) : t("status.saveBrowser")}
        </span>
      </footer>
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
    </div>
  );
}

const TR_ASCII: Record<string, string> = { ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I", ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U" };

/** Dosya adı: Türkçe harfler ASCII'ye çevrilir (bazı tarayıcılar ASCII olmayan adı "download" yapıyor) */
function safeFileName(name: string): string {
  return name
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => TR_ASCII[c])
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Yüzde: TR "%45", EN "45%" */
function pct(n: number): string {
  return t("common.percent", { v: formatNumber(n) });
}

function ToolButton(props: {
  icon: IconName;
  label?: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      className={`tbtn ${props.primary ? "primary" : ""} ${props.label ? "" : "icon-only"}`}
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      aria-label={props.label ? undefined : props.title}
    >
      <Icon name={props.icon} size={17} />
      {props.label && <span>{props.label}</span>}
    </button>
  );
}

type Theme = "light" | "dark";

/** Tema: kayıtlı seçim, yoksa sistem ayarı */
function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("msproject.theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // depolama kapalı
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("msproject.theme", theme);
    } catch {
      // depolama kapalı
    }
  }, [theme]);
  return [theme, setTheme];
}

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Tarayıcının "uygulamayı yükle" önerisi (Chrome / Edge); yüklüyse ya da desteklenmiyorsa düğme çıkmaz */
function useInstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const prompt = useCallback(async () => {
    if (!event) return;
    await event.prompt();
    await event.userChoice.catch(() => undefined);
    setEvent(null);
  }, [event]);
  return { available: !!event, prompt };
}
