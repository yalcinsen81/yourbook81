import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "../i18n";
import { fold } from "../model/view";

export interface PaletteCommand {
  id: string;
  label: string;
  /** Kısayol ipucu (ör. Ctrl+F2) */
  hint?: string;
  /** Grup adı (ör. Görev, Görünüm) */
  group: string;
  disabled?: boolean;
  run: () => void;
}

export interface PaletteTask {
  id: string;
  row: number;
  name: string;
  /** Özet adları ("Kaba inşaat › Temel") */
  path: string;
}

interface Props {
  commands: PaletteCommand[];
  tasks: PaletteTask[];
  /** "tasks": yalnızca göreve git (Ctrl+G) */
  mode: "all" | "tasks";
  onGoTo: (id: string) => void;
  onClose: () => void;
}

type Item = { kind: "cmd"; cmd: PaletteCommand } | { kind: "task"; task: PaletteTask };

const MAX_TASKS = 30;

/**
 * Komut paleti (Ctrl+K): komut ara ve çalıştır, ya da göreve git (satır no ya da ad).
 * ↑/↓ seçer, Enter çalıştırır, Esc kapatır. Ctrl+G yalnızca görevleri listeler.
 */
export function CommandPalette({ commands, tasks, mode, onGoTo, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<Item[]>(() => {
    const q = fold(query.trim());
    const num = /^#?(\d+)$/.exec(q);
    const taskHits = tasks
      .filter((x) => !q || (num ? String(x.row).startsWith(num[1]) : fold(`${x.name} ${x.path}`).includes(q)))
      .slice(0, MAX_TASKS)
      .map((task) => ({ kind: "task" as const, task }));
    if (mode === "tasks") return taskHits;
    const cmdHits = commands.filter((c) => !q || fold(`${c.label} ${c.group}`).includes(q)).map((cmd) => ({ kind: "cmd" as const, cmd }));
    // Sayı yazılınca önce görevler, yoksa önce komutlar
    return num ? [...taskHits, ...cmdHits] : [...cmdHits, ...(q ? taskHits : [])];
  }, [commands, tasks, query, mode]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const runItem = (it: Item | undefined) => {
    if (!it) return;
    if (it.kind === "cmd") {
      if (it.cmd.disabled) return;
      onClose();
      it.cmd.run();
    } else {
      onClose();
      onGoTo(it.task.id);
    }
  };

  let lastGroup = "";
  return (
    <div className="modal-backdrop palette-backdrop" onMouseDown={onClose}>
      <div className="palette" role="dialog" aria-modal="true" aria-label={mode === "tasks" ? t("palette.goTitle") : t("palette.title")} onMouseDown={(e) => e.stopPropagation()}>
        <input
          className="palette-input"
          autoFocus
          value={query}
          placeholder={mode === "tasks" ? t("palette.goPlaceholder") : t("palette.placeholder")}
          aria-label={mode === "tasks" ? t("palette.goTitle") : t("palette.title")}
          aria-controls="palette-list"
          aria-activedescendant={items.length ? `palette-${active}` : undefined}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              runItem(items[active]);
            }
          }}
        />
        <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {items.length === 0 && <div className="palette-empty">{t("palette.empty")}</div>}
          {items.map((it, i) => {
            const group = it.kind === "cmd" ? it.cmd.group : t("palette.tasks");
            const head = group !== lastGroup;
            lastGroup = group;
            const disabled = it.kind === "cmd" && it.cmd.disabled;
            return (
              <div key={it.kind === "cmd" ? `c-${it.cmd.id}` : `t-${it.task.id}`}>
                {head && <div className="palette-group">{group}</div>}
                <div
                  id={`palette-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={i === active}
                  aria-disabled={disabled || undefined}
                  className={`palette-item ${i === active ? "active" : ""} ${disabled ? "disabled" : ""}`}
                  onMouseMove={() => i !== active && setActive(i)}
                  onClick={() => runItem(it)}
                >
                  {it.kind === "cmd" ? (
                    <>
                      <span>{it.cmd.label}</span>
                      {it.cmd.hint && <kbd className="menu-hint">{it.cmd.hint}</kbd>}
                    </>
                  ) : (
                    <>
                      <span className="palette-row">{it.task.row}</span>
                      <span className="palette-name">{it.task.name || t("common.unnamed")}</span>
                      {it.task.path && <small className="palette-path">{it.task.path}</small>}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="palette-foot">{t("palette.foot")}</div>
      </div>
    </div>
  );
}
