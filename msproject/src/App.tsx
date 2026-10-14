import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type UIEvent } from "react";
import { addDays, diffDays, formatShort, isValidDate, nextWorkday, parseDate } from "./model/calendar";
import { ancestorsOf, blockIndexes, cloneRows, dropAncestorLinks, indent, insertRows, isSummaryAt, move, moveBlockTo, normalizeOutline, outdent, subtreeEnd, wbsCodes } from "./model/outline";
import { formatPredecessors, parsePredecessors } from "./model/predecessors";
import { emptyProject, sampleProject } from "./model/sample";
import { wouldCreateCycle } from "./model/schedule";
import { parseMspXml, toMspXml } from "./model/mspXml";
import { needsUpgradeBackup, newId, normalizeCurrency, sanitizeProject } from "./model/storage";
import type { Project, Task } from "./model/types";
import { CalendarDialog } from "./components/CalendarDialog";
import { Gantt } from "./components/Gantt";
import { TaskGrid, type GridRow } from "./components/TaskGrid";
import { ROW_H, type Density } from "./components/layout";
import { todayIso, useProject } from "./useProject";
import { fileLinkSupported, useFileLink } from "./useFileLink";
import { Icon, type IconName } from "./components/icons";
import { ResourceView } from "./components/ResourceView";
import { ChartsView } from "./components/ChartsView";
import { assignFromText, formatAssignments, overallocatedTasks, progressCurves, projectWeight, resourceUsage, taskCost } from "./model/resources";
import { cycleError, issueText, progressWarnings, withPercent } from "./model/ops";
import { baselineVariance, getBaseline } from "./model/baseline";
import { TaskInfoDialog } from "./components/TaskInfoDialog";
import { BaselineDialog } from "./components/BaselineDialog";
import { LevelingDialog } from "./components/LevelingDialog";
import { normalizeWorkdays } from "./model/calendar";
import { ProjectSetupDialog } from "./components/ProjectSetupDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { DateInput } from "./components/DateInput";
import { formatMoney, formatNumber, invalidDateMessage, msgText, parseDateLocal, setCurrency, t, weekStartDay, type MessageKey, type Msg } from "./i18n";
import { parsePercentCell } from "./model/cellInput";
import { useLocale } from "./i18n/react";
import { holidayLabel } from "./model/holidays";
import { parseDuration } from "./model/duration";
import { anchoredScroll, clampPpd, fitPpd, MAX_PPD, scaleFor, ZOOM_STEP } from "./model/timescale";
import { addBackup, addTemplate, loadSettings, loadSplitRatio, loadView, saveDensity, saveHiddenColumns, saveSplitRatio, saveView, takeSnapshot, viewKey } from "./settings";
import { downloadBlob, fileNameFor } from "./download";
import { addRecent, loadRecents, removeRecent, type RecentFile } from "./handleStore";
import { HelpDialog, type HelpTopic } from "./components/HelpDialog";
import { RecoveryDialog } from "./components/RecoveryDialog";
import { PromptDialog } from "./components/PromptDialog";
import { FilterBar } from "./components/FilterBar";
import { useOverflow } from "./components/useOverflow";
import { Menu, MenuItem } from "./components/Menu";
import { DEFAULT_HIDDEN, gridWidthFor } from "./components/TaskGrid";
import { applyTemplate, projectToTemplate } from "./model/templates";
import { DEFAULT_VIEW, isViewActive, visibleOrder, type ViewOptions } from "./model/view";
import { allWarnings } from "./model/validation";
import { exposure, parseEstimate, riskLevel, risksByTask } from "./model/risks";
import { serializeProject } from "./useFileLink";

// Raporlar, Gantt dışa aktarma ve içe aktarma ayrı parçada yüklenir (ilk açılış hafif kalsın; çevrimdışı önbellekte de vardır)
const ReportsView = lazy(() => import("./components/ReportsView").then((m) => ({ default: m.ReportsView })));
const GanttExportDialog = lazy(() => import("./components/GanttExportDialog").then((m) => ({ default: m.GanttExportDialog })));
const RisksView = lazy(() => import("./components/RisksView").then((m) => ({ default: m.RisksView })));
const ImportDialog = lazy(() => import("./components/ImportDialog").then((m) => ({ default: m.ImportDialog })));

type View = "gantt" | "resources" | "charts" | "risks" | "reports";

export default function App() {
  const { project, schedule, update, undo, redo, canUndo, canRedo, startedCorrupt } = useProject();
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
  // Tablo / Gantt ayırıcısı: çalışma alanına oran olarak hatırlanır (varsayılan %50, çift tıkla sıfırlanır)
  const [splitRatio, setSplitRatio] = useState(loadSplitRatio);
  const [splitDragging, setSplitDragging] = useState(false);
  const workspaceRef = useRef<HTMLElement>(null);
  // Bildirim metni işlev olarak saklanır; dil değişince yeni dilde yeniden üretilir
  const [message, setMessage] = useState<Msg | null>(null);
  const [messageKind, setMessageKind] = useState<"info" | "error">("info");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [linkMenu, setLinkMenu] = useState(false);
  const [view, setView] = useState<View>("gantt");
  const [pickedResource, setPickedResource] = useState<string | null>(null);
  const [infoId, setInfoId] = useState<string | null>(null);
  const [baselineOpen, setBaselineOpen] = useState(false);
  const [levelOpen, setLevelOpen] = useState(false);
  const [help, setHelp] = useState<HelpTopic | null>(null);
  const [gexportOpen, setGexportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  // Kurtarma penceresi; bozuk dosya / kayıt açılırken hata açıklamasıyla
  const [recovery, setRecovery] = useState<{ problem?: { name: string; detail: string } } | null>(() =>
    startedCorrupt ? { problem: { name: t("recovery.browserStore"), detail: "" } } : null,
  );
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [fileMenu, setFileMenu] = useState(false);
  const [moreMenu, setMoreMenu] = useState(false);
  // Satır yoğunluğu değişince tablo ve Gantt yeni ROW_H ile yeniden çizilir
  const [density, setDensityState] = useState<Density>(() => (ROW_H === 36 ? "comfortable" : "compact"));
  const toolbarRef = useRef<HTMLElement>(null);
  const [recents, setRecents] = useState<RecentFile[]>([]);
  const [setupTemplate, setSetupTemplate] = useState("");
  const [viewOpts, setViewOpts] = useState<Omit<ViewOptions, "today">>(DEFAULT_VIEW);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => new Set(loadSettings().hiddenColumns ?? DEFAULT_HIDDEN));
  const searchRef = useRef<HTMLInputElement>(null);
  // Gantt'ta gösterilen referans plan (-1 = yok); proje açılınca ilk referans plan seçilir
  const [shownBaseline, setShownBaseline] = useState(() => project.baselines?.[0]?.index ?? -1);
  // Kopyalanan satırlar (alt ağaçlarıyla, uygulama içi pano)
  const clipboard = useRef<Task[]>([]);
  const [theme, setTheme] = useTheme();
  const install = useInstallPrompt();
  const gridRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const today = todayIso();

  const flashTimer = useRef<number | undefined>(undefined);
  const flash = useCallback((text: Msg, kind: "info" | "error" = "info") => {
    // İşlev, React'te güncelleyici sayılmasın diye sarılır
    setMessage(() => text);
    setMessageKind(kind);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setMessage(null), kind === "error" ? 6000 : 4000);
  }, []);
  /** Geçersiz giriş ve başarısız işlem: sol kenarı kiremit çizgili bildirim */
  const flashError = useCallback((text: Msg) => flash(text, "error"), [flash]);

  // Proje bütünüyle değişmeden önce mevcut hali kurtarma noktası olur (yanlışlıkla başka dosya açılsa da geri dönülür)
  const projectRef = useRef(project);
  projectRef.current = project;
  const snapshotNow = useCallback(() => {
    const cur = projectRef.current;
    takeSnapshot(cur.name, cur.tasks.length, serializeProject(cur), new Date(), true);
  }, []);
  const replaceProject = useCallback(
    (p: Project) => {
      snapshotNow();
      update(() => p);
      setSelection(new Set());
      setLoadToken((n) => n + 1);
    },
    [snapshotNow, update],
  );
  const onInvalidFile = useCallback((name: string, detail: string) => setRecovery({ problem: { name, detail } }), []);
  const fileLink = useFileLink(project, replaceProject, flash, onInvalidFile);

  // Son dosyalar: bağlanan dosya listeye girer (tutamacıyla); liste açılışta okunur
  useEffect(() => {
    void loadRecents().then(setRecents);
  }, []);
  useEffect(() => {
    if (!fileLink.handle || !fileLink.fileName) return;
    const cur = projectRef.current;
    void addRecent({ name: fileLink.fileName, at: new Date().toISOString(), projectName: cur.name, text: serializeProject(cur), handle: fileLink.handle }).then(setRecents);
  }, [fileLink.handle, fileLink.fileName]);

  // Otomatik kurtarma noktası: değişiklikten 2 sn sonra, en çok dakikada bir (son 8)
  useEffect(() => {
    const timer = window.setTimeout(() => takeSnapshot(project.name, project.tasks.length, serializeProject(project)), 2000);
    return () => window.clearTimeout(timer);
  }, [project]);

  const usage = useMemo(() => resourceUsage(project, schedule), [project, schedule]);
  const overTasks = useMemo(() => overallocatedTasks(usage), [usage]);
  // İlerleme, S eğrisi ve uyarılar tek ağırlıkla (proje ayarı, varsayılan maliyet)
  const curves = useMemo(() => progressCurves(project, schedule, today), [project, schedule, today]);
  const warnings = useMemo(() => progressWarnings(curves, projectWeight(project)), [curves, project, loc]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sekme başlığı dile ve proje adına uyar
  useEffect(() => {
    const app = t("app.title");
    document.title = project.name.trim() ? `${project.name.trim()} · ${app}` : app;
  }, [project.name, loc]);
  const noCostRows = useMemo(() => new Set(curves.weight === "cost" ? curves.zeroCostRows : []), [curves]);

  // Referans plan sapması (gösterilen referans plana göre)
  const baseline = shownBaseline >= 0 ? getBaseline(project, shownBaseline) : undefined;
  const variance = useMemo(
    () => (baseline ? baselineVariance(project, schedule, baseline.index) : new Map<string, { finish: number }>()),
    [baseline, project, schedule],
  );

  const taskWarns = useMemo(() => allWarnings(project, schedule, today), [project, schedule, today, loc]); // eslint-disable-line react-hooks/exhaustive-deps
  const lateCount = useMemo(() => [...taskWarns.values()].filter((w) => w.some((x) => x.kind === "late")).length, [taskWarns]);
  const viewActive = isViewActive(viewOpts);

  // Görünür satırlar: arama / süzgeç / sıralama, sonra kapalı özetlerin altları gizlenir
  const rows: GridRow[] = useMemo(() => {
    const wbs = wbsCodes(project.tasks);
    const anc = ancestorsOf(project.tasks);
    // Özet görevin maliyeti alt görevlerinin toplamı
    const leafCost = project.tasks.map((task, i) => (schedule.rows[i].isSummary ? 0 : taskCost(task, project)));
    const cost = project.tasks.map((_, i) =>
      schedule.rows[i].isSummary ? leafCost.slice(i + 1, subtreeEnd(project.tasks, i)).reduce((a, b) => a + b, 0) : leafCost[i],
    );
    const issues = new Map<string, string[]>();
    for (const is of schedule.issues) issues.set(is.taskId, [...(issues.get(is.taskId) ?? []), issueText(project, schedule, is)]);
    const byTask = risksByTask(project);
    const levels = ["low", "medium", "high", "critical"];
    const riskInfo = (id: string) => {
      const list = byTask.get(id);
      if (!list?.length) return undefined;
      const level = levels[Math.max(...list.map((r) => levels.indexOf(riskLevel(exposure(r)))))];
      return { text: list.map((r) => `${r.id} ${r.title}`), level };
    };
    const order = viewActive ? visibleOrder(project, schedule, { ...viewOpts, today }, cost, wbs) : project.tasks.map((_, i) => i);
    return order
      .map((i) => ({
        task: project.tasks[i],
        sched: schedule.rows[i],
        wbs: wbs[i],
        predText: formatPredecessors(project.tasks[i].predecessors, project.tasks),
        resText: schedule.rows[i].isSummary ? "" : formatAssignments(project.tasks[i].assignments, project.resources),
        overallocated: overTasks.has(project.tasks[i].id),
        noCost: noCostRows.has(i + 1),
        cost: cost[i],
        collapsed: collapsed.has(project.tasks[i].id),
        issues: issues.get(project.tasks[i].id) ?? [],
        variance: variance.get(project.tasks[i].id)?.finish,
        warnings: taskWarns.get(project.tasks[i].id) ?? [],
        risks: riskInfo(project.tasks[i].id),
      }))
      .filter((r) => !(anc.get(r.task.id) ?? []).some((a) => collapsed.has(a)));
    // loc: öncül metnindeki gecikme birimi (g / d) dile bağlı
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, schedule, collapsed, overTasks, noCostRows, variance, loc, taskWarns, viewActive, viewOpts, today]);

  const cycle = useMemo(() => new Set(schedule.cycle), [schedule.cycle]);
  // Hazır tatillerin adı seçili dilde; kullanıcının girdiği ad olduğu gibi
  const holidayMap = useMemo(
    () => new Map(project.holidays.map((h) => [h.date, { name: holidayLabel(h), halfDay: !!h.halfDay }])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.holidays, loc],
  );
  const workdays = useMemo(() => normalizeWorkdays(project.workdays), [project.workdays]);
  const blackoutUse = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of project.tasks) for (const id of x.blackouts ?? []) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [project.tasks]);
  // Başka proje açılınca ilk referans planı göster
  useEffect(() => {
    setShownBaseline(project.baselines?.[0]?.index ?? -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadToken]);

  // Gantt'ta sürükleme: taşıma "şundan önce başlamasın" kısıtı koyar (MS Project gibi), sağ uç süreyi değiştirir
  const onDragTask = useCallback(
    (id: string, mode: "move" | "resize", days: number) => {
      const r = schedule.byId.get(id);
      if (!r) return;
      const cal = schedule.calendar;
      if (mode === "move") {
        const start = cal.nextWorkday(addDays(r.startDate, days));
        update((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === id ? { ...t, constraint: { type: "SNET", date: start } } : t)) }));
      } else {
        // Yeni bitişe kadar görevin kendi takviminde (yarım gün, kaynak takvimi) kaç iş günü var
        const finish = cal.prevWorkday(addDays(r.finishDate, days));
        const duration = Math.max(1, Math.round(schedule.capacity(id, r.es, cal.toOffset(addDays(finish, 1)))));
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

  // Klavyeyle hücreye gelinince satır seçilir (seçimin içindeyse seçim korunur)
  const onFocusRow = useCallback(
    (id: string) => {
      setSelection((sel) => (sel.has(id) ? sel : new Set([id])));
      setAnchor((a) => (selection.has(id) ? a : id));
    },
    [selection],
  );
  // Shift+↑/↓: bağlantı noktasından yeni satıra kadar seçili
  const onExtend = useCallback(
    (id: string, dir: 1 | -1) => {
      const ids = rows.map((r) => r.task.id);
      const at = ids.indexOf(id) + dir;
      if (at < 0 || at >= ids.length) return;
      const from = ids.indexOf(anchor ?? id);
      const [a, b] = [from < 0 ? at - dir : from, at].sort((x, y) => x - y);
      setSelection(new Set(ids.slice(a, b + 1)));
      if (!anchor || from < 0) setAnchor(id);
    },
    [anchor, rows],
  );

  // --- Görev işlemleri ---
  // undefined değerli alan görevden silinir (dosyada boş alan kalmasın)
  const patchTask = useCallback(
    (id: string, patch: Partial<Task>) =>
      update((p) => ({
        ...p,
        tasks: p.tasks.map((t) => {
          if (t.id !== id) return t;
          const next = { ...t, ...patch } as Record<string, unknown>;
          for (const [k, v] of Object.entries(patch)) if (v === undefined) delete next[k];
          return next as unknown as Task;
        }),
      })),
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
        return { ...p, tasks: dropAncestorLinks(tasks) };
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

  // --- Kopyala / yapıştır / çoğalt / sürükle-bırak ---
  const copySelected = useCallback(() => {
    if (!selectedIndexes.length) return;
    clipboard.current = cloneRows(project.tasks, selectedIndexes, () => "");
    const n = blockIndexes(project.tasks, selectedIndexes).length;
    // Sistem panosuna da sekmeyle ayrılmış metin (Excel'e yapıştırılabilir)
    const text = blockIndexes(project.tasks, selectedIndexes)
      .map((i) => {
        const r = schedule.rows[i];
        return [project.tasks[i].name, r.duration, r.startDate, r.finishDate].join("\t");
      })
      .join("\n");
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    flash(() => t("msg.copied", { n }));
  }, [flash, project.tasks, schedule.rows, selectedIndexes]);

  const pasteRows = useCallback(
    (source: Task[]) => {
      if (!source.length) return;
      const fresh = cloneRows(source, source.flatMap((x, i) => (x.outline === 0 ? [i] : [])), newId);
      update((p) => {
        // Seçili satırın (alt ağacıyla) altına, onun düzeyinde; seçim yoksa sona
        const last = selectedIndexes[selectedIndexes.length - 1];
        const at = last === undefined ? p.tasks.length : subtreeEnd(p.tasks, last);
        const level = last === undefined ? 0 : p.tasks[last].outline;
        return { ...p, tasks: insertRows(p.tasks, at, fresh, level) };
      });
      setSelection(new Set(fresh.filter((x) => x.outline === 0).map((x) => x.id)));
    },
    [selectedIndexes, update],
  );

  const duplicateSelected = useCallback(() => {
    if (!selectedIndexes.length) return;
    pasteRows(cloneRows(project.tasks, selectedIndexes, () => ""));
  }, [pasteRows, project.tasks, selectedIndexes]);

  const onMoveRow = useCallback(
    (id: string, beforeId: string | null) =>
      update((p) => {
        const from = p.tasks.findIndex((x) => x.id === id);
        const to = beforeId === null ? p.tasks.length : p.tasks.findIndex((x) => x.id === beforeId);
        const tasks = moveBlockTo(p.tasks, from, to);
        if (tasks === p.tasks) {
          flashError(() => t("msg.cannotMoveInto"));
          return p;
        }
        return { ...p, tasks };
      }),
    [flash, update],
  );

  const linkSelected = useCallback(() => {
    if (selectedIndexes.length < 2) {
      flashError(() => t("msg.linkNeedTwo"));
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
    if (skipped) flash(() => t("msg.linksSkipped", { n: skipped }));
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
      const negative = /^\s*[-−]/.test(text);
      flashError(() => (negative ? t("valid.negativeDuration") : t("err.duration")));
      return false;
    }
    const hours = parsed.hours;
    if (hours !== undefined) flash(() => t("msg.hoursRounded", { hours: formatNumber(hours), days: String(parsed.days) }));
    patchTask(id, { duration: Math.min(10_000, parsed.days) });
    return true;
  };

  const onStart = (id: string, text: string) => {
    if (!text.trim()) {
      patchTask(id, { constraint: undefined });
      return true;
    }
    const iso = parseDateLocal(text);
    if (!iso) {
      flashError(invalidDateMessage);
      return false;
    }
    // Proje başlangıcından önceki tarih kısıt olamaz (görev zaten proje başında başlar)
    if (iso < project.start) {
      flashError(() => t("valid.startBeforeProject", { date: formatShort(iso), start: formatShort(project.start) }));
      return false;
    }
    patchTask(id, { constraint: { type: "SNET", date: iso } });
    return true;
  };

  const onPredecessors = (id: string, text: string) => {
    const { predecessors, errors } = parsePredecessors(text, project.tasks, id);
    if (errors.length) {
      flashError(() => t("err.predecessor", { parts: errors.join(", ") }));
      return false;
    }
    const base: Project = {
      ...project,
      tasks: project.tasks.map((t) => (t.id === id ? { ...t, predecessors: [] } : t)),
    };
    for (const pr of predecessors) {
      if (cycleError(base, id, pr.taskId)) {
        flashError(() => cycleError(base, id, pr.taskId) ?? "");
        return false;
      }
    }
    patchTask(id, { predecessors });
    return true;
  };

  const onPercent = (id: string, text: string) => {
    // "45", "%45", "45%"; gerçekleşen başlangıç/bitiş MS Project'teki gibi güncellenir
    const parsed = parsePercentCell(text);
    if (!parsed) {
      flashError(() => t("valid.percent"));
      return false;
    }
    const task = project.tasks.find((x) => x.id === id);
    if (!task) return false;
    if (parsed.clamped) flash(() => t("valid.percentClamped"));
    const next = withPercent(task, parsed.value, schedule);
    update((p) => ({ ...p, tasks: p.tasks.map((x) => (x.id === id ? next : x)) }));
    return true;
  };

  const onEstimate = (id: string, text: string) => {
    const e = parseEstimate(text);
    if (e === undefined) {
      flashError(() => t("err.estimate"));
      return false;
    }
    update((p) => ({
      ...p,
      tasks: p.tasks.map((x) => {
        if (x.id !== id) return x;
        const next = { ...x };
        if (e) next.estimate = e;
        else delete next.estimate;
        return next;
      }),
    }));
    return true;
  };

  const onResources = (id: string, text: string) => {
    const result = assignFromText(project, id, text);
    if (result.errors.length) {
      flashError(() => t("err.resource", { parts: result.errors.join(", ") }));
      return false;
    }
    update(() => result.project);
    if (result.created.length) {
      flash(() => t("msg.resourcesCreated", { names: result.created.map((r) => r.name).join(", ") }));
    }
    return true;
  };

  // --- Dosya ---
  const downloadAs = (content: string, type: string, fileName: string) => downloadBlob(new Blob([content], { type }), fileName);
  const download = (content: string, type: string, ext: string) => downloadAs(content, type, fileNameFor([project.name], ext));
  const exportJson = () => download(serializeProject(project), "application/json", "json");
  const exportMsp = () => download(toMspXml(project, schedule), "application/xml", "xml");

  const loadOpened = (opened: Project, fileName: string, warnings: string[] = []) => {
    snapshotNow();
    update(() => opened);
    setSelection(new Set());
    setCollapsed(new Set());
    setLoadToken((n) => n + 1);
    flash(() => [t("msg.opened", { name: opened.name, n: opened.tasks.length }), ...warnings].join(" "));
    void addRecent({ name: fileName, at: new Date().toISOString(), projectName: opened.name, text: serializeProject(opened) }).then(setRecents);
  };

  /** Metinden proje: MS Project XML ya da JSON; bozuksa kurtarma penceresi açılır */
  const openText = (content: string, fileName: string) => {
    const isXml = /\.xml$/i.test(fileName) || content.trimStart().startsWith("<");
    try {
      let parsed: Project | null;
      let warnings: string[] = [];
      if (isXml) {
        ({ project: parsed, warnings } = parseMspXml(content));
        parsed = sanitizeProject(parsed);
      } else {
        const raw = JSON.parse(content);
        parsed = sanitizeProject(raw);
        // Eski sürümlü dosyanın özgün metni yedeklenir (Kurtarma > yükseltme yedekleri)
        if (parsed && needsUpgradeBackup(raw)) addBackup(fileName, content);
      }
      if (!parsed) throw new Error(t("recovery.notProject"));
      loadOpened(parsed, fileName, warnings);
    } catch (e) {
      if (isXml) flashError(() => t("msg.xmlFailed", { detail: e instanceof Error && e.message ? `: ${e.message}` : "." }));
      else setRecovery({ problem: { name: fileName, detail: e instanceof Error ? e.message : String(e) } });
    }
  };

  const openFile = async (file: File) => openText(await file.text(), file.name);

  const openRecent = async (r: RecentFile, index: number) => {
    setFileMenu(false);
    // Tutamaç varsa dosyaya yeniden bağlanılır; izin yoksa ya da dosya silinmişse son kopya açılır
    if (r.handle && (await fileLink.openHandle(r.handle))) return;
    if (r.text) {
      openText(r.text, r.name);
      if (r.handle) flash(() => t("file.recentCopy", { name: r.name }));
    } else {
      setRecents(await removeRecent(index));
      flashError(() => t("file.recentMissing", { name: r.name }));
    }
  };

  const saveAs = () => {
    setFileMenu(false);
    if (fileLinkSupported) void fileLink.linkNew();
    else exportJson();
  };

  const newProject = (sample: boolean, template = "") => {
    setFileMenu(false);
    // Boş proje: takvim (çalışma günleri, tatiller) ve ilerleme ağırlığı kullanıcıya sorulur
    if (!sample) {
      setSetupTemplate(template);
      setSetupOpen(true);
      return;
    }
    if (!window.confirm(t("msg.confirmSample"))) return;
    snapshotNow();
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
      const tag = (e.target as HTMLElement).tagName;
      const editing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      const mod = e.ctrlKey || e.metaKey;
      // Açık pencere varsa kısayollar pencereye aittir
      if (document.querySelector(".modal-backdrop:not([hidden]), .print-overlay")) return;
      if (e.key === "F1" || (e.key === "?" && !editing)) {
        e.preventDefault();
        setHelp("keys");
      } else if (mod && (e.key.toLowerCase() === "f" || e.key.toLowerCase() === "k") && view === "gantt") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (mod && e.key.toLowerCase() === "p" && view === "gantt") {
        e.preventDefault();
        setGexportOpen(true);
      } else if (mod && e.key.toLowerCase() === "z" && !e.shiftKey && !editing) {
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
      } else if (mod && e.key.toLowerCase() === "c" && !editing && !window.getSelection()?.toString()) {
        e.preventDefault();
        copySelected();
      } else if (mod && e.key.toLowerCase() === "v" && !editing) {
        e.preventDefault();
        pasteRows(clipboard.current);
      } else if (mod && e.key.toLowerCase() === "d" && !editing) {
        e.preventDefault();
        duplicateSelected();
      } else if (e.shiftKey && e.key === "F2" && !editing) {
        e.preventDefault();
        if (primary >= 0) setInfoId(project.tasks[primary].id);
      } else if (e.key === "Insert") {
        e.preventDefault();
        insertTask();
      } else if (e.key === "Delete" && (!editing || mod)) {
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
  }, [copySelected, deleteSelected, duplicateSelected, fitProject, insertTask, linkSelected, pasteRows, primary, project.start, project.tasks, redo, schedule.finishDate, scrollToDate, shiftOutline, undo, view, zoomTo]);

  // --- Bölücü sürükleme ---
  // Tablo genişliği görünen sütunlardan fazla olamaz (sütun gizlenince Gantt genişler)
  const maxGridWidth = gridWidthFor(hiddenCols, !!baseline) + 2;
  const startResize = (e: MouseEvent) => {
    const box = workspaceRef.current?.getBoundingClientRect();
    if (!box) return;
    e.preventDefault();
    setSplitDragging(true);
    let last = splitRatio;
    const onMove = (ev: globalThis.MouseEvent) => {
      last = Math.max(0.15, Math.min(0.85, (ev.clientX - box.left) / box.width));
      setSplitRatio(last);
    };
    const onUp = () => {
      setSplitDragging(false);
      saveSplitRatio(last);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  const resetSplit = () => {
    setSplitRatio(0.5);
    saveSplitRatio(undefined);
  };

  const leafCount = schedule.rows.filter((r) => !r.isSummary).length;
  const progress = Math.round(curves.earnedPercent);
  const totalCost = curves.totalCost;
  const overCount = usage.filter((u) => u.overDays.length && u.resource.type !== "material").length;
  const criticalCount = schedule.rows.filter((r) => !r.isSummary && r.critical).length;
  const hasSel = selection.size > 0;

  // Araç çubuğu tek satır: sığmayanlar (düzey ≤ ovLevel) ve her zaman menüde duranlar (lv 0) "Diğer" menüsünde
  const ovLevel = useOverflow(toolbarRef, 6);
  type MoreItem = { lv: number; label: string; hint?: string; disabled?: boolean; run: () => void; sep?: false } | { lv: number; sep: true };
  const moreItems: MoreItem[] = [
    { lv: 6, label: t("tb.milestone"), run: () => insertTask(true) },
    { lv: 4, label: t("tb.copyShort"), hint: "Ctrl+C", disabled: !hasSel, run: copySelected },
    { lv: 4, label: t("tb.pasteShort"), hint: "Ctrl+V", disabled: !clipboard.current.length, run: () => pasteRows(clipboard.current) },
    { lv: 0, label: t("tb.duplicateShort"), hint: "Ctrl+D", disabled: !hasSel, run: duplicateSelected },
    { lv: 2, label: t("tb.outdentShort"), hint: "Alt+Shift+←", disabled: !hasSel, run: () => shiftOutline(-1) },
    { lv: 2, label: t("tb.indentShort"), hint: "Alt+Shift+→", disabled: !hasSel, run: () => shiftOutline(1) },
    { lv: 2, label: t("tb.up"), disabled: primary < 0, run: () => moveSelected(-1) },
    { lv: 2, label: t("tb.down"), disabled: primary < 0, run: () => moveSelected(1) },
    { lv: 5, label: t("tb.undoShort"), hint: "Ctrl+Z", disabled: !canUndo, run: undo },
    { lv: 5, label: t("tb.redoShort"), hint: "Ctrl+Y", disabled: !canRedo, run: redo },
    { lv: 0, sep: true },
    { lv: 1, label: t("tb.link"), hint: "Ctrl+F2", disabled: selection.size < 2, run: linkSelected },
    { lv: 0, label: t("tb.unlinkShort"), disabled: !hasSel, run: unlinkSelected },
    { lv: 0, label: t("tb.infoShort"), hint: "Shift+F2", disabled: primary < 0, run: () => primary >= 0 && setInfoId(project.tasks[primary].id) },
    { lv: 1, label: t("tb.baseline"), run: () => setBaselineOpen(true) },
    { lv: 1, label: t("tb.level"), run: () => setLevelOpen(true) },
    { lv: 0, sep: true },
    ...(view === "gantt"
      ? [
          { lv: 3, label: t("zoom.fitShort"), hint: "Ctrl+0", run: fitProject },
          { lv: 3, label: t("tb.today"), run: () => scrollToDate(today, (ganttRef.current?.clientWidth ?? 600) / 2) },
          { lv: 0, label: t("zoom.selected"), disabled: primary < 0, run: goToSelected },
        ]
      : []),
    { lv: 6, label: t("tb.calendar"), run: () => setCalendarOpen(true) },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" aria-hidden>
          <Icon name="brand" size={14} />
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
        <div className="tabs" role="tablist" aria-label={t("view.label")}>
          {(
            [
              ["gantt", "view.gantt"],
              ["resources", "view.resources"],
              ["charts", "view.charts"],
              ["risks", "view.risks"],
              ["reports", "view.reports"],
            ] as [View, MessageKey][]
          ).map(([v, label]) => (
            <button key={v} role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
              {t(label)}
              {v === "resources" && usage.some((u) => u.overDays.length) && <i className="dot-alert" aria-label={t("view.overAlert")} />}
            </button>
          ))}
        </div>
        <div className="top-end">
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
          <div className="menu-anchor">
            <button
              className={`chip file-badge ${fileLink.fileName ? "linked" : ""}`}
              onClick={() => setLinkMenu((v) => !v)}
              disabled={!fileLinkSupported}
              title={fileLinkSupported ? t("link.badgeTitle", { name: fileLink.fileName ?? t("link.notLinked") }) : t("link.unsupported")}
              aria-haspopup="true"
              aria-expanded={linkMenu}
            >
              <i className="file-dot" aria-hidden />
              <span>{fileLink.fileName ?? t("link.button")}</span>
            </button>
            {linkMenu && (
              <Menu label={t("link.title")} onClose={() => setLinkMenu(false)} className="link-menu">
                <MenuItem onClick={() => { setLinkMenu(false); void fileLink.linkExisting(); }}>{t("link.openExisting")}</MenuItem>
                <MenuItem onClick={() => { setLinkMenu(false); void fileLink.linkNew(); }}>{t("link.saveNew")}</MenuItem>
                {fileLink.fileName && <MenuItem onClick={() => { setLinkMenu(false); fileLink.unlink(); }}>{t("link.unlink")}</MenuItem>}
              </Menu>
            )}
          </div>
          <div className="menu-anchor">
            <button className="tbtn ghost" aria-haspopup="true" aria-expanded={fileMenu} onClick={() => setFileMenu((v) => !v)} title={t("file.menuTitle")}>
              <Icon name="file" size={16} />
              <span>{t("file.menu")}</span>
            </button>
            {fileMenu && (
              <Menu label={t("file.menu")} onClose={() => setFileMenu(false)} className="file-menu">
                <MenuItem onClick={() => newProject(false)}>{t("file.new")}</MenuItem>
                <MenuItem onClick={() => newProject(false, "b:konut")}>{t("file.fromTemplate")}</MenuItem>
                <MenuItem
                  onClick={() => {
                    setFileMenu(false);
                    fileRef.current?.click();
                  }}
                >
                  {t("file.open")}
                </MenuItem>
                {fileLinkSupported && (
                  <MenuItem
                    onClick={() => {
                      setFileMenu(false);
                      void fileLink.linkExisting();
                    }}
                  >
                    {t("link.openExisting")}
                  </MenuItem>
                )}
                <MenuItem onClick={saveAs}>{fileLinkSupported ? t("file.saveAs") : t("file.saveAsDownload")}</MenuItem>
                <MenuItem
                  onClick={() => {
                    setFileMenu(false);
                    setSaveTplOpen(true);
                  }}
                >
                  {t("file.saveTemplate")}
                </MenuItem>
                <div className="menu-sep" role="separator" />
                <div className="menu-label">{t("file.recent")}</div>
                {recents.length ? (
                  recents.map((r, i) => (
                    <MenuItem key={`${r.name}-${r.at}`} onClick={() => void openRecent(r, i)} title={`${r.projectName} · ${new Date(r.at).toLocaleString()}`}>
                      {r.name} <small>{r.projectName}</small>
                    </MenuItem>
                  ))
                ) : (
                  <div className="menu-empty">{t("file.noRecent")}</div>
                )}
                <div className="menu-sep" role="separator" />
                <MenuItem
                  onClick={() => {
                    setFileMenu(false);
                    setImportOpen(true);
                  }}
                >
                  {t("file.import")}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setFileMenu(false);
                    exportMsp();
                  }}
                >
                  {t("tb.mspTitle")}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setFileMenu(false);
                    exportJson();
                  }}
                >
                  {t("tb.json")}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setFileMenu(false);
                    setView("gantt");
                    setGexportOpen(true);
                  }}
                  hint="Ctrl+P"
                >
                  {t("file.ganttExport")}
                </MenuItem>
                <div className="menu-sep" role="separator" />
                <MenuItem
                  onClick={() => {
                    setFileMenu(false);
                    setRecovery({});
                  }}
                >
                  {t("file.recovery")}
                </MenuItem>
                <MenuItem onClick={() => newProject(true)}>{t("tb.sample")}</MenuItem>
              </Menu>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json,application/xml,text/xml,.xml,.bak"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void openFile(f);
                e.target.value = "";
              }}
            />
          </div>
          <button className="icon-btn" onClick={() => setHelp("keys")} title={t("help.button")} aria-label={t("help.title")}>
            <Icon name="help" size={16} />
          </button>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} title={t("settings.button")} aria-label={t("settings.title")}>
            <Icon name="gear" size={16} />
          </button>
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? t("theme.light") : t("theme.dark")}
            aria-label={theme === "dark" ? t("theme.toLight") : t("theme.toDark")}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
          </button>
        </div>
      </header>

      <div className="summary" role="group" aria-label={t("summary.aria")}>
        <span className="stat">
          <span className="stat-label">{t("stat.finish")}</span> <b className="stat-value">{formatShort(schedule.finishDate)}</b>
        </span>
        <span className="stat">
          <span className="stat-label">{t("stat.duration")}</span> <b className="stat-value">{t("unit.workdays", { n: schedule.finish })}</b>
        </span>
        <span className="stat" title={t("stat.progressTitle", { weight: t(`weight.${curves.weight}`) })}>
          <span className="stat-label">{t("stat.progress")}</span>
          <span className="meter" aria-hidden>
            <span style={{ width: `${progress}%` }} />
          </span>
          <b className="stat-value">{pct(progress)}</b>
        </span>
        {totalCost > 0 && (
          <span className="stat">
            <span className="stat-label">{t("stat.cost")}</span> <b className="stat-value">{formatMoney(totalCost)}</b>
          </span>
        )}
        <span className="stat crit">
          <span className="stat-label">{t("stat.critical")}</span> <b className="stat-value">{t("unit.tasks", { n: criticalCount })}</b>
        </span>
        {warnings.length > 0 && (
          <span className="stat info" title={warnings.join("\n")} role="note">
            <Icon name="info" size={14} />
            {curves.weightFallback ? t("stat.weightFallbackShort") : t("stat.noCostShort", { n: curves.zeroCostRows.length })}
          </span>
        )}
      </div>

      <nav className="toolbar" aria-label={t("toolbar.aria")} ref={toolbarRef}>
        <ToolButton icon="plus" label={t("tb.task")} primary onClick={() => insertTask()} title={t("tb.taskTitle")} />
        <ToolButton icon="milestone" label={t("tb.milestone")} outline onClick={() => insertTask(true)} title={t("tb.milestoneTitle")} ov={6} />
        <span className="tsep" />
        <ToolButton icon="trash" onClick={deleteSelected} disabled={!hasSel} title={t("tb.delete")} />
        <ToolButton icon="copy" onClick={copySelected} disabled={!hasSel} title={t("tb.copy")} ov={4} />
        <ToolButton icon="paste" onClick={() => pasteRows(clipboard.current)} disabled={!clipboard.current.length} title={t("tb.paste")} ov={4} />
        <ToolButton icon="outdent" onClick={() => shiftOutline(-1)} disabled={!hasSel} title={t("tb.outdent")} ov={2} />
        <ToolButton icon="indent" onClick={() => shiftOutline(1)} disabled={!hasSel} title={t("tb.indent")} ov={2} />
        <ToolButton icon="up" onClick={() => moveSelected(-1)} disabled={primary < 0} title={t("tb.up")} ov={2} />
        <ToolButton icon="down" onClick={() => moveSelected(1)} disabled={primary < 0} title={t("tb.down")} ov={2} />
        <ToolButton icon="undo" onClick={undo} disabled={!canUndo} title={t("tb.undo")} ov={5} />
        <ToolButton icon="redo" onClick={redo} disabled={!canRedo} title={t("tb.redo")} ov={5} />
        <span className="tsep" data-ov={1} />
        <ToolButton icon="link" label={t("tb.link")} ghost onClick={linkSelected} disabled={selection.size < 2} title={t("tb.linkTitle")} ov={1} />
        <ToolButton icon="flag" label={t("tb.baseline")} ghost onClick={() => setBaselineOpen(true)} title={t("tb.baselineTitle")} ov={1} />
        <ToolButton
          icon="level"
          label={t("tb.level")}
          ghost
          onClick={() => setLevelOpen(true)}
          title={overCount ? t("tb.levelTitleOver", { n: overCount }) : t("tb.levelTitle")}
          ov={1}
        />
        <div className="menu-anchor">
          <ToolButton icon="more" label={t("tb.more")} ghost onClick={() => setMoreMenu((v) => !v)} title={t("tb.moreTitle")} popup={moreMenu} />
          {moreMenu && (
            <Menu label={t("tb.moreTitle")} onClose={() => setMoreMenu(false)} className="more-menu">
              {moreItems
                .filter((m) => m.lv === 0 || m.lv <= ovLevel)
                .map((m, i) =>
                  m.sep ? (
                    <div key={`s${i}`} className="menu-sep" role="separator" />
                  ) : (
                    <MenuItem
                      key={m.label}
                      hint={m.hint}
                      disabled={m.disabled}
                      onClick={() => {
                        setMoreMenu(false);
                        m.run();
                      }}
                    >
                      {m.label}
                    </MenuItem>
                  ),
                )}
            </Menu>
          )}
        </div>
        <span className="spacer" />
        {view === "gantt" && (
          <>
            <FilterBar
              project={project}
              opts={viewOpts}
              onChange={setViewOpts}
              shown={rows.filter((r) => !r.sched.isSummary).length}
              total={leafCount}
              lateCount={lateCount}
              hidden={hiddenCols}
              onHidden={(h) => {
                setHiddenCols(h);
                saveHiddenColumns([...h]);
              }}
              searchRef={searchRef}
            />
            <span className="tsep" />
            <div className="zoombar" role="group" aria-label={t("zoom.label")}>
              <ToolButton icon="zoomOut" onClick={() => zoomTo(ppd / ZOOM_STEP)} disabled={ppd <= minPpd + 1e-6} title={t("zoom.out")} />
              <span className="zoom-level" title={t("zoom.hint")} data-ov={3}>
                {t("zoom.level", { scale: t(`zoom.scale.${scaleFor(ppd)}`), px: formatNumber(ppd, ppd < 10 ? 1 : 0) })}
              </span>
              <ToolButton icon="zoomIn" onClick={() => zoomTo(ppd * ZOOM_STEP)} disabled={ppd >= MAX_PPD - 1e-6} title={t("zoom.in")} />
              <ToolButton icon="fit" label={t("zoom.fitShort")} ghost onClick={fitProject} title={t("zoom.fit")} ov={3} />
              <ToolButton icon="target" label={t("tb.today")} ghost onClick={() => scrollToDate(today, (ganttRef.current?.clientWidth ?? 600) / 2)} title={t("tb.todayTitle")} ov={3} />
            </div>
          </>
        )}
        <ToolButton icon="calendar" label={t("tb.calendar")} ghost onClick={() => setCalendarOpen(true)} title={t("calendar.buttonTitle")} ov={6} />
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
      {view === "risks" && (
        <Suspense fallback={<div className="lazy-loading">{t("common.loading")}</div>}>
          <RisksView project={project} schedule={schedule} today={today} update={update} flash={flash} />
        </Suspense>
      )}
      {view === "reports" && (
        <Suspense fallback={<div className="lazy-loading">{t("common.loading")}</div>}>
        <ReportsView
          project={project}
          schedule={schedule}
          usage={usage}
          curves={curves}
          today={today}
          baselineIndex={baseline ? baseline.index : -1}
          onHelp={(topic) => setHelp(topic)}
          onOpenTask={setInfoId}
        />
        </Suspense>
      )}
      <main className="workspace" hidden={view !== "gantt"} ref={workspaceRef}>
        <div style={{ width: `min(${(splitRatio * 100).toFixed(2)}%, ${maxGridWidth}px)`, flex: "none", display: "flex", minWidth: 0 }}>
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
            onEstimate={onEstimate}
            onResources={onResources}
            onAddAtEnd={() => insertTask(false, true)}
            onInfo={setInfoId}
            onMoveRow={onMoveRow}
            showVariance={!!baseline}
            hidden={hiddenCols}
            dragDisabled={viewActive}
            onFocusRow={onFocusRow}
            onExtend={onExtend}
          />
        </div>
        <div
          className={`splitter ${splitDragging ? "dragging" : ""}`}
          onMouseDown={startResize}
          onDoubleClick={resetSplit}
          role="separator"
          aria-orientation="vertical"
          aria-label={t("app.splitter")}
          title={t("app.splitterTitle")}
        />
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
          baseline={baseline?.tasks}
          baselineName={baseline?.name}
          onInfo={setInfoId}
        />
        {project.tasks.length === 0 && (
          <div className="empty-state">
            <h2>{t("empty.title")}</h2>
            <p>{t("empty.body")}</p>
            <div className="empty-actions">
              <button className="tbtn primary" onClick={() => insertTask()}>
                <Icon name="plus" size={16} />
                <span>{t("empty.first")}</span>
              </button>
              <button className="tbtn outline" onClick={() => newProject(false, "b:konut")}>
                <Icon name="template" size={16} />
                <span>{t("empty.template")}</span>
              </button>
              <button className="tbtn outline" onClick={() => fileRef.current?.click()}>
                <Icon name="open" size={16} />
                <span>{t("empty.open")}</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {calendarOpen && (
        <CalendarDialog
          holidays={project.holidays}
          workdays={workdays}
          halfDayMode={project.halfDayMode ?? "full"}
          blackouts={project.blackouts ?? []}
          blackoutUse={blackoutUse}
          projectStart={project.start}
          finishYear={Number(schedule.finishDate.slice(0, 4))}
          onSave={(c) =>
            update((p) => {
              // Silinen dönemler görevlerden de kalkar
              const ids = new Set(c.blackouts.map((b) => b.id));
              const next: Project = {
                ...p,
                holidays: c.holidays,
                workdays: c.workdays,
                halfDayMode: c.halfDayMode,
                blackouts: c.blackouts,
                tasks: p.tasks.map((x) => {
                  if (!x.blackouts?.some((id) => !ids.has(id))) return x;
                  const kept = x.blackouts.filter((id) => ids.has(id));
                  const task: Task = { ...x, blackouts: kept };
                  if (!kept.length) delete task.blackouts;
                  return task;
                }),
              };
              if (c.halfDayMode === "full") delete next.halfDayMode;
              if (!c.blackouts.length) delete next.blackouts;
              return next;
            })
          }
          onClose={() => setCalendarOpen(false)}
        />
      )}
      {infoId && project.tasks.some((x) => x.id === infoId) && (
        <TaskInfoDialog
          project={project}
          schedule={schedule}
          taskId={infoId}
          issues={rows.find((r) => r.task.id === infoId)?.issues ?? schedule.issues.filter((x) => x.taskId === infoId).map((x) => issueText(project, schedule, x))}
          baseline={
            baseline?.tasks[infoId]
              ? { ...baseline.tasks[infoId], name: baseline.name, variance: baselineVariance(project, schedule, baseline.index).get(infoId) }
              : undefined
          }
          onSave={(task) => update((p) => ({ ...p, tasks: p.tasks.map((x) => (x.id === task.id ? task : x)) }))}
          onClose={() => setInfoId(null)}
        />
      )}
      {baselineOpen && (
        <BaselineDialog
          project={project}
          schedule={schedule}
          today={today}
          shown={baseline ? baseline.index : -1}
          onShow={setShownBaseline}
          update={update}
          onClose={() => setBaselineOpen(false)}
        />
      )}
      {levelOpen && (
        <LevelingDialog
          project={project}
          schedule={schedule}
          onApply={(next) => {
            update(() => next);
            flash(() => t("msg.leveled"));
          }}
          onClose={() => setLevelOpen(false)}
        />
      )}
      {setupOpen && (
        <ProjectSetupDialog
          today={today}
          initialTemplate={setupTemplate}
          onClose={() => setSetupOpen(false)}
          onCreate={(setup, template) => {
            snapshotNow();
            const base = emptyProject(setup.start, setup);
            update(() => (template ? applyTemplate(base, template) : base));
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
          density={density}
          onDensity={(d) => {
            saveDensity(d);
            setDensityState(d);
          }}
        />
      )}

      {help && <HelpDialog topic={help} onClose={() => setHelp(null)} />}
      {gexportOpen && (
        <Suspense fallback={null}>
        <GanttExportDialog
          project={project}
          schedule={schedule}
          today={today}
          baseline={baseline}
          visible={rows.map((r) => r.sched.row - 1)}
          flash={flash}
          onClose={() => setGexportOpen(false)}
        />
        </Suspense>
      )}
      {importOpen && (
        <Suspense fallback={null}>
        <ImportDialog
          project={project}
          onClose={() => setImportOpen(false)}
          onImport={(next, n) => {
            update(() => next);
            flash(() => t("import.done", { n }));
          }}
        />
        </Suspense>
      )}
      {recovery && (
        <RecoveryDialog
          problem={recovery.problem}
          onClose={() => setRecovery(null)}
          onRestore={(p, label) => {
            replaceProject(p);
            setCollapsed(new Set());
            flash(() => t("recovery.restored", { name: label }));
          }}
        />
      )}
      {saveTplOpen && (
        <PromptDialog
          title={t("tpl.saveTitle")}
          label={t("tpl.name")}
          note={t("tpl.saveNote")}
          initial={project.name}
          okLabel={t("common.save")}
          onClose={() => setSaveTplOpen(false)}
          onOk={(name) => {
            const ok = addTemplate(projectToTemplate(project, name, today));
            flash(() => (ok ? t("tpl.saved", { name }) : t("tpl.saveFailed")));
            setSaveTplOpen(false);
          }}
        />
      )}

      <footer className="statusbar">
        <span>{t("unit.tasks", { n: leafCount })}</span>
        <span className="legend">
          <i className="sw normal" /> {t("legend.normal")} <i className="sw critical" /> {t("legend.critical")} <i className="sw summary" />{" "}
          {t("legend.summary")} <i className="sw ms" /> {t("legend.milestone")} <i className="sw over">!</i> {t("legend.over")}
        </span>
        {schedule.cycle.length > 0 && (
          <span className="warn" title={schedule.cyclePath.map((id) => project.tasks.findIndex((x) => x.id === id) + 1).join(" → ")}>
            <Icon name="risk" size={14} />
            {t("warn.cycleStatus")}
          </span>
        )}
        {schedule.issues.length > 0 && (
          <span className="warn" title={schedule.issues.map((x) => issueText(project, schedule, x)).join("\n")}>
            <Icon name="risk" size={14} />
            {t("status.issues", { n: schedule.issues.length })}
          </span>
        )}
        {lateCount > 0 && (
          <button
            className="warn link-btn"
            onClick={() => {
              setView("gantt");
              setViewOpts({ ...viewOpts, filter: "late" });
            }}
            title={t("status.lateTitle")}
          >
            <Icon name="clock" size={14} />
            {t("status.late", { n: lateCount })}
          </button>
        )}
        <span className="spacer" />
        <span className="save-state" title={fileLink.fileName ?? undefined}>
          {fileLink.fileName ? t("status.saveFile", { name: fileLink.fileName }) : t("status.saveBrowser")}
        </span>
      </footer>
      {message && (
        <div className={`toast ${messageKind === "error" ? "error" : ""}`} role={messageKind === "error" ? "alert" : "status"}>
          {msgText(message)}
        </div>
      )}
    </div>
  );
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
  /** Çerçeveli ikincil düğme */
  outline?: boolean;
  /** Çerçevesiz düğme */
  ghost?: boolean;
  /** Sığmazsa "Diğer" menüsüne taşınma sırası (küçük önce) */
  ov?: number;
  /** Açılır menü düğmesi: açık mı */
  popup?: boolean;
}) {
  const kind = props.primary ? "primary" : props.outline ? "outline" : props.ghost ? "ghost" : "";
  return (
    <button
      className={`tbtn ${kind} ${props.label ? "" : "icon-only"}`}
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      aria-label={props.label ? undefined : props.title}
      data-ov={props.ov}
      aria-haspopup={props.popup === undefined ? undefined : "true"}
      aria-expanded={props.popup}
    >
      <Icon name={props.icon} size={16} />
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
