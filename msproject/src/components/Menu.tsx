import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

/** Açılır menü: dışarı tıklayınca ve Esc ile kapanır; ↑/↓ öğeler arasında gezer, ilk öğe odaklanır */
export function Menu({ label, onClose, children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const items = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
    items()[0]?.focus();
    const onDown = (e: MouseEvent) => {
      // Menüyü açan düğmeye tıklama düğmenin kendisinde ele alınır
      const opener = (e.target as HTMLElement).closest?.("[aria-haspopup]");
      if (!ref.current?.contains(e.target as Node) && !opener) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const list = items();
      if (!list.length) return;
      e.preventDefault();
      const at = list.indexOf(document.activeElement as HTMLElement);
      const next = e.key === "ArrowDown" ? (at + 1) % list.length : (at - 1 + list.length) % list.length;
      list[next].focus();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);
  return (
    <div ref={ref} className={`menu ${className ?? ""}`} role="menu" aria-label={label}>
      {children}
    </div>
  );
}

export function MenuItem(props: { onClick: () => void; children: ReactNode; hint?: string; disabled?: boolean; title?: string }) {
  return (
    <button role="menuitem" onClick={props.onClick} disabled={props.disabled} title={props.title}>
      <span>{props.children}</span>
      {props.hint && <kbd className="menu-hint">{props.hint}</kbd>}
    </button>
  );
}
