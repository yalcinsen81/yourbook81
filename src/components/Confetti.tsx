import { motion } from "framer-motion";
import { useMemo } from "react";

interface ConfettiProps {
  /** 0..1 arası tetik değeri; değiştiğinde patlama çalışır */
  trigger: number;
  particleCount?: number;
}

const COLORS = [
  "var(--accent)",
  "#fbbf24",
  "#f97316",
  "#ef4444",
  "#10b981",
  "#3b82f6",
  "var(--ink)",
];

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  distance: number;
  color: string;
  size: number;
  duration: number;
  delay: number;
}

/** "Öğrendim" aksiyonu sonrası neşeli konfeti. */
export function Confetti({ trigger, particleCount = 24 }: ConfettiProps) {
  const particles = useMemo<Particle[]>(() => {
    if (trigger <= 0) return [];
    return Array.from({ length: particleCount }, (_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 60 + Math.random() * 120;
      return {
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        angle,
        distance,
        color: COLORS[i % COLORS.length],
        size: 5 + Math.random() * 7,
        duration: 0.8 + Math.random() * 0.7,
        delay: Math.random() * 0.15,
      };
    });
  }, [trigger, particleCount]);

  if (trigger <= 0 || particles.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      {particles.map((p) => (
        <motion.span
          key={trigger + "-" + p.id}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
          animate={{
            opacity: 0,
            x: Math.cos(p.angle) * p.distance,
            y: Math.sin(p.angle) * p.distance,
            rotate: Math.random() * 360 - 180,
          }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.id % 2 === 0 ? "50%" : "2px",
          }}
        />
      ))}
    </div>
  );
}
