import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type UIEvent } from "react";
import { addDays, diffDays, formatShort, isValidDate, nextWorkday, parseDate } from "./model/calendar";
import { ancestorsOf, indent, isSummaryAt, move, normalizeOutline, outdent, subtreeEnd, wbsCodes } from "./model/outline";
import { formatPredecessors, parsePredecessors } from "./model/predecessors";
import { emptyProject, sampleProject } from "./model/sample";
import { wouldCreateCycle } from "./model/schedule";
import { parseMspXml, toMspXml } from "./model/mspXml";
import { newId, sanitizeProject } from "./model/storage";
import type { Project, Task } from "./model/types";
import { CalendarDialog } from "./components/CalendarDialog";
import { Gantt } from "./components/Gantt";
import { TaskGrid, GRID_WIDTH, type GridRow } from "./components/TaskGrid";
import { PX_PER_DAY, type Zoom } from "./components/layout";
import { todayIso, useProject } from "./useProject";
import { fileLinkSupported, useFileLink } from "./useFileLink";
import { Icon, type IconName } from "./components/icons";

export default function App() {
  const { project, schedule, update, undo, redo, canUndo, canRedo } = useProject();
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState<Zoom>("day");
  const [gridWidth, setGridWidth] = useState(Math.min(GRID_WIDTH, 700));
  const [message, setMessage] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [linkMenu, setLinkMenu] = useState(false);
  const [theme, setTheme] = useTheme();
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
    },
    [update],
  );
  const fileLink = useFileLink(project, replaceProject, flash);

  // Görünür satırlar: kapalı özetlerin altları gizlenir
  const rows: GridRow[] = useMemo(() => {
    const wbs = wbsCodes(project.tasks);
    const anc = ancestorsOf(project.tasks);
    return project.tasks
      .map((task, i) => ({
        task,
        sched: schedule.rows[i],
        wbs: wbs[i],
        predText: formatPredecessors(task.predecessors, project.tasks),
        collapsed: collapsed.has(task.id),
      }))
      .filter((r) => !(anc.get(r.task.id) ?? []).some((a) => collapsed.has(a)));
  }, [project.tasks, schedule, collapsed]);

  const cycle = useMemo(() => new Set(schedule.cycle), [schedule.cycle]);
  const holidayMap = useMemo(() => new Map(project.holidays.map((h) => [h.date, h.name])), [project.holidays]);

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

  // Zaman çizelgesi: proje başlangıcından önceki pazartesi, bitişten 3 hafta sonrası
  const timeline = useMemo(() => {
    const first = parseDate(project.start).getUTCDay();
    const start = addDays(project.start, -((first + 6) % 7) - 7);
    const lastDate = [schedule.finishDate, today].sort()[1];
    const days = Math.max(diffDays(start, lastDate) + 28, 70);
    return { start, days };
  }, [project.start, schedule.finishDate, today]);

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
          name: milestone ? "Yeni kilometre taşı" : "Yeni görev",
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
      // Yeni satırın adını hemen düzenlemeye aç
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLInputElement>(`[data-row][data-col="name"][aria-label^="Satır ${visibleRow + 1} "]`);
        el?.focus();
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
      flash("Bağlamak için en az iki görev seçin (Ctrl veya Shift ile).");
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
    if (skipped) flash(`${skipped} bağ döngü oluşturacağı için eklenmedi.`);
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
    const m = /^\s*(\d+)\s*(g|gün|gun|d)?\s*$/i.exec(text);
    if (!m) {
      flash("Süre iş günü olarak girilir: ör. 5 ya da 5g.");
      return false;
    }
    patchTask(id, { duration: Math.min(10_000, Number(m[1])) });
    return true;
  };

  const onStart = (id: string, iso: string) => {
    if (!iso) {
      patchTask(id, { startNoEarlierThan: undefined });
      return true;
    }
    if (!isValidDate(iso)) return false;
    patchTask(id, { startNoEarlierThan: iso });
    return true;
  };

  const onPredecessors = (id: string, text: string) => {
    const { predecessors, errors } = parsePredecessors(text, project.tasks, id);
    if (errors.length) {
      flash(`Anlaşılamayan öncül: ${errors.join(", ")}. Örnek: 2 · 3SS · 4FS+2g`);
      return false;
    }
    const base: Project = {
      ...project,
      tasks: project.tasks.map((t) => (t.id === id ? { ...t, predecessors: [] } : t)),
    };
    for (const pr of predecessors) {
      if (wouldCreateCycle(base, id, pr.taskId)) {
        const row = project.tasks.findIndex((t) => t.id === pr.taskId) + 1;
        flash(`${row}. satır öncül olamaz: döngü ya da özet–alt görev bağı oluşur.`);
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

  // --- Dosya ---
  const download = (content: string, type: string, ext: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = `${safeFileName(project.name) || "proje"}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // İndirme başlamadan bağlantı iptal edilmesin
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
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
      flash([`"${opened.name}" açıldı (${opened.tasks.length} görev).`, ...warnings].join(" "));
    } catch (e) {
      flash(
        isXml
          ? `MS Project dosyası okunamadı${e instanceof Error && e.message ? `: ${e.message}` : "."} MS Project'te "XML Biçimi" ile kaydedin.`
          : "Dosya okunamadı: geçerli bir proje dosyası değil.",
      );
    }
  };

  const newProject = (sample: boolean) => {
    if (!window.confirm(sample ? "Örnek proje yüklensin mi? Mevcut proje değiştirilir (Geri Al ile dönebilirsiniz)." : "Yeni boş proje açılsın mı? (Geri Al ile dönebilirsiniz)")) return;
    const start = nextWorkday(today);
    update(() => (sample ? sampleProject(start) : emptyProject(start)));
    setSelection(new Set());
    setCollapsed(new Set());
  };

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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelected, insertTask, linkSelected, redo, shiftOutline, undo]);

  // --- Kaydırma eşitleme ---
  const syncing = useRef(false);
  const syncScroll = (source: "grid" | "gantt") => (e: UIEvent<HTMLDivElement>) => {
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

  const scrollToDate = (iso: string) => {
    const el = ganttRef.current;
    if (!el) return;
    const ppd = PX_PER_DAY[zoom];
    el.scrollLeft = Math.max(0, diffDays(timeline.start, iso) * ppd - 80);
  };

  useEffect(() => {
    scrollToDate(project.start);
    // İlk açılışta, ölçek ya da proje başlangıcı değişince (ör. dosya açılınca)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, project.start]);

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
  // Süreye göre ağırlıklı tamamlanma (kilometre taşları sayılmaz)
  const progress = useMemo(() => {
    let total = 0;
    let done = 0;
    project.tasks.forEach((t, i) => {
      if (schedule.rows[i].isSummary || t.duration === 0) return;
      total += t.duration;
      done += (t.duration * t.percent) / 100;
    });
    return total ? Math.round((done / total) * 100) : 0;
  }, [project.tasks, schedule]);
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
            aria-label="Proje adı"
            onChange={(e) => {
              const name = e.target.value;
              update((p) => ({ ...p, name }));
            }}
          />
          <label className="project-start">
            Başlangıç
            <input
              type="date"
              value={project.start}
              onChange={(e) => {
                const start = e.target.value;
                if (isValidDate(start)) update((p) => ({ ...p, start }));
              }}
            />
          </label>
        </div>
        <div className="stats" aria-label="Proje özeti">
          <div className="stat">
            <span className="stat-label">Bitiş</span>
            <span className="stat-value">{formatShort(schedule.finishDate)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Süre</span>
            <span className="stat-value">{schedule.finish} iş günü</span>
          </div>
          <div className="stat">
            <span className="stat-label">İlerleme</span>
            <span className="stat-value">
              <span className="meter" aria-hidden>
                <span style={{ width: `${progress}%` }} />
              </span>
              %{progress}
            </span>
          </div>
          <div className="stat crit">
            <span className="stat-label">Kritik</span>
            <span className="stat-value">{criticalCount} görev</span>
          </div>
        </div>
        <button
          className={`chip ${fileLink.fileName ? "linked" : ""}`}
          onClick={() => setLinkMenu((v) => !v)}
          disabled={!fileLinkSupported}
          title={
            fileLinkSupported
              ? "Projeyi diskteki bir dosyaya bağla: Claude (MCP) aynı dosyayı düzenleyebilir"
              : "Dosyaya bağlama Chrome ve Edge'de çalışır"
          }
          aria-expanded={linkMenu}
        >
          <Icon name="plug" size={16} />
          {fileLink.fileName ?? "Dosyaya bağla"}
        </button>
        {linkMenu && (
          <div className="menu" role="menu" onMouseLeave={() => setLinkMenu(false)}>
            <button role="menuitem" onClick={() => { setLinkMenu(false); void fileLink.linkExisting(); }}>
              Var olan dosyayı aç ve bağla
            </button>
            <button role="menuitem" onClick={() => { setLinkMenu(false); void fileLink.linkNew(); }}>
              Bu projeyi yeni dosyaya kaydet ve bağla
            </button>
            {fileLink.fileName && (
              <button role="menuitem" onClick={() => { setLinkMenu(false); fileLink.unlink(); }}>
                Bağlantıyı kaldır
              </button>
            )}
          </div>
        )}
        <button
          className="icon-btn"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? "Açık tema" : "Koyu tema"}
          aria-label={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>
      </header>

      <nav className="toolbar" aria-label="Araç çubuğu">
        <div className="tgroup">
          <ToolButton icon="plus" label="Görev" primary onClick={() => insertTask()} title="Seçili satırın altına görev ekle (Insert)" />
          <ToolButton icon="milestone" label="Kilometre taşı" onClick={() => insertTask(true)} title="Kilometre taşı ekle (süre 0)" />
          <ToolButton icon="trash" onClick={deleteSelected} disabled={!hasSel} title="Seçili görevleri sil (Delete)" />
        </div>
        <div className="tgroup">
          <ToolButton icon="outdent" onClick={() => shiftOutline(-1)} disabled={!hasSel} title="Girintiyi azalt (Alt+Shift+←)" />
          <ToolButton icon="indent" onClick={() => shiftOutline(1)} disabled={!hasSel} title="Girintile: özet görev oluşturur (Alt+Shift+→)" />
          <ToolButton icon="up" onClick={() => moveSelected(-1)} disabled={primary < 0} title="Yukarı taşı" />
          <ToolButton icon="down" onClick={() => moveSelected(1)} disabled={primary < 0} title="Aşağı taşı" />
        </div>
        <div className="tgroup">
          <ToolButton icon="link" label="Bağla" onClick={linkSelected} disabled={selection.size < 2} title="Seçili görevleri sırayla Bitiş-Başlangıç bağla (Ctrl+F2)" />
          <ToolButton icon="unlink" onClick={unlinkSelected} disabled={!hasSel} title="Seçili görevlerin bağlarını kaldır" />
        </div>
        <div className="tgroup">
          <ToolButton icon="undo" onClick={undo} disabled={!canUndo} title="Geri al (Ctrl+Z)" />
          <ToolButton icon="redo" onClick={redo} disabled={!canRedo} title="Yinele (Ctrl+Y)" />
        </div>
        <div className="tgroup">
          <ToolButton icon="file" onClick={() => newProject(false)} title="Yeni boş proje" />
          <ToolButton icon="open" label="Aç" onClick={() => fileRef.current?.click()} title="Proje dosyası aç: .json ya da MS Project'ten XML olarak kaydedilmiş .xml" />
          <ToolButton icon="share" label="MS Project" onClick={exportMsp} title="MS Project'te açılabilen XML dosyası indir" />
          <ToolButton icon="download" onClick={exportJson} title="Projeyi JSON olarak indir" />
          <ToolButton icon="sparkle" onClick={() => newProject(true)} title="Örnek konut inşaatı projesi" />
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
          <ToolButton icon="calendar" label="Takvim" onClick={() => setCalendarOpen(true)} title="Tatil günlerini düzenle" />
          <ToolButton icon="target" label="Bugün" onClick={() => scrollToDate(today)} title="Gantt'ı bugüne kaydır" />
          <div className="segmented" role="radiogroup" aria-label="Zaman ölçeği">
            {(["day", "week", "month"] as Zoom[]).map((z) => (
              <button key={z} role="radio" aria-checked={zoom === z} className={zoom === z ? "on" : ""} onClick={() => setZoom(z)}>
                {{ day: "Gün", week: "Hafta", month: "Ay" }[z]}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="workspace">
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
            onAddAtEnd={() => insertTask(false, true)}
          />
        </div>
        <div className="splitter" onMouseDown={startResize} role="separator" aria-orientation="vertical" aria-label="Tablo genişliği" />
        <Gantt
          rows={rows}
          timelineStart={timeline.start}
          days={timeline.days}
          zoom={zoom}
          today={today}
          selection={selection}
          scrollRef={ganttRef}
          onScroll={syncScroll("gantt")}
          onSelect={onSelect}
          holidays={holidayMap}
          onDragTask={onDragTask}
        />
      </main>

      {calendarOpen && (
        <CalendarDialog
          holidays={project.holidays}
          projectStart={project.start}
          onSave={(holidays) => update((p) => ({ ...p, holidays }))}
          onClose={() => setCalendarOpen(false)}
        />
      )}

      <footer className="statusbar">
        <span>{leafCount} görev</span>
        <span className="legend">
          <i className="sw normal" /> Normal <i className="sw critical" /> Kritik yol <i className="sw summary" /> Özet
          <i className="sw ms" /> Kilometre taşı
        </span>
        {schedule.cycle.length > 0 && <span className="warn">Döngüsel bağ var: işaretli satırları kontrol edin</span>}
        <span className="spacer" />
        <span>{fileLink.fileName ? `Kayıt: ${fileLink.fileName} + tarayıcı` : "Kayıt: tarayıcıda otomatik"}</span>
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
