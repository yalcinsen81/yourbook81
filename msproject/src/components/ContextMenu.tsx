import { useLayoutEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./icons";
import { Menu, MenuItem } from "./Menu";

export type MenuEntry = { label: string; hint?: string; icon?: IconName; disabled?: boolean; run: () => void; sep?: false } | { sep: true };

interface Props {
  x: number;
  y: number;
  label: string;
  items: MenuEntry[];
  onClose: () => void;
}

/** Sağ tık menüsü: imlecin yanında açılır, ekrandan taşarsa içeri kayar */
export function ContextMenu({ x, y, label, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)),
    });
  }, [x, y]);
  return (
    <div ref={ref} className="context-menu" style={pos} onContextMenu={(e) => e.preventDefault()}>
      <Menu label={label} onClose={onClose}>
        {items.map((m, i) =>
          m.sep ? (
            <div key={`s${i}`} className="menu-sep" role="separator" />
          ) : (
            <MenuItem
              key={m.label}
              hint={m.hint}
              disabled={m.disabled}
              onClick={() => {
                onClose();
                m.run();
              }}
            >
              <span className="menu-icon">{m.icon && <Icon name={m.icon} size={15} />}</span>
              {m.label}
            </MenuItem>
          ),
        )}
      </Menu>
    </div>
  );
}
