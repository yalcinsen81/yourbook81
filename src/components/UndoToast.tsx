import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface UndoToastData {
  id: number;
  message: string;
  onUndo: () => void;
}

interface UndoToastProps {
  toast: UndoToastData | null;
  onDone: () => void;
}

export function UndoToast({ toast, onDone }: UndoToastProps) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, 5000);
    return () => clearTimeout(t);
  }, [toast?.id, onDone]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 26 }}
          className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[999] lg:bottom-6"
        >
          <div className="flex items-center gap-3 px-5 py-3 bg-[var(--paper)] border border-[var(--line-strong)] rounded-[16px] shadow-superrCard">
            <span className="font-gelica text-sm text-[var(--ink)]">
              {toast.message}
            </span>
            <button
              onClick={() => {
                toast.onUndo();
                onDone();
              }}
              className="font-handwritten text-[15px] font-bold text-[var(--accent)] hover:underline"
            >
              geri al
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
