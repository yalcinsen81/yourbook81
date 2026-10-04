import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
  /** İçerik genişse tooltip max genişliği */
  maxWidth?: number;
}

/** Unicode makaleleri açıklayan küçük, gecikmeli araç ipucu. */
export function Tooltip({ label, children, side = "top", maxWidth = 180 }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!hovered) {
      setOpen(false);
      return;
    }
    const t = setTimeout(() => setOpen(true), 350);
    return () => clearTimeout(t);
  }, [hovered]);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => {
        setHovered(true);
        setOpen(true);
      }}
      onTouchEnd={() => setHovered(false)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: side === "top" ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: side === "top" ? 4 : -4 }}
            transition={{ duration: 0.12 }}
            className={`pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 ${side === "top" ? "bottom-full mb-2" : "top-full mt-2"
              }`}
          >
            <div
              style={{ maxWidth }}
              className="rounded-[16px] border border-[var(--line-strong)] bg-[var(--paper)] px-3 py-1.5 text-center font-geist text-[11px] font-semibold lowercase text-[var(--ink)] shadow-superrButton"
            >
              {label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
