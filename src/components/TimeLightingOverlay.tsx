import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getCurrentTimePeriod,
  isTimeLightingEnabled,
  TIME_PERIOD_META,
  TimeLightingPeriod,
} from "../lib/notebookConfig";

export function TimeLightingOverlay() {
  const [enabled, setEnabled] = useState(isTimeLightingEnabled);
  const [period, setPeriod] = useState<TimeLightingPeriod>(getCurrentTimePeriod);

  useEffect(() => {
    const refresh = () => {
      setEnabled(isTimeLightingEnabled());
      setPeriod(getCurrentTimePeriod());
    };

    window.addEventListener("notebook-config-changed", refresh);
    // Her 10 dakikada bir saati kontrol et
    const interval = window.setInterval(refresh, 600000);

    return () => {
      window.removeEventListener("notebook-config-changed", refresh);
      window.clearInterval(interval);
    };
  }, []);

  if (!enabled) return null;

  const meta = TIME_PERIOD_META[period];
  if (!meta || meta.overlayStyle === "transparent") return null;

  return (
    <AnimatePresence>
      <motion.div
        key={period}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-30"
        style={{
          background: meta.overlayStyle,
        }}
      />
    </AnimatePresence>
  );
}
