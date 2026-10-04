import { motion } from "framer-motion";

interface AnimatedCheckProps {
  checked: boolean;
  size?: number;
  className?: string;
  /** Yazma hızı (ms). Varsayılan 250ms — "elle işaretleniyor" hissi. */
  duration?: number;
}

/**
 * Kalemle çizilmiş tik işareti animasyonu.
 * SVG stroke-dashoffset ile soldan sağa "çizilerek" belirir.
 * prefers-reduced-motion durumunda MotionConfig/useReducedMotion devreye girer.
 */
export function AnimatedCheck({ checked, size = 18, className = "", duration = 0.25 }: AnimatedCheckProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <motion.path
        d="M5 12.5 L10 17.5 L19 7"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
        transition={{ duration, ease: [0.34, 1.56, 0.64, 1] }}
      />
    </svg>
  );
}

/**
 * Metnin üzerine soldan sağa çizilen üstü çizili (strikethrough) efekt.
 * Ayrı bir overlay katmanı olarak çizilir; metnin kendisini bozmaz.
 */
export function AnimatedStrike({ active, duration = 0.25 }: { active: boolean; duration?: number }) {
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-1/2 h-[1.5px] w-full origin-left bg-current"
      initial={false}
      animate={{ scaleX: active ? 1 : 0, opacity: active ? 0.75 : 0 }}
      transition={{ duration, ease: [0.2, 0, 0, 1] }}
    />
  );
}
