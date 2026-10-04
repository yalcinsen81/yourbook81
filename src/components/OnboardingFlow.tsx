import { useState } from "react";
import { motion } from "framer-motion";

type Props = { displayName?: string; onDone: () => void };
const LANGS = ["Almanca", "İngilizce", "İspanyolca", "İtalyanca", "Fransızca"];
const LEVELS = ["A1", "A2", "B1", "B2", "C1"];
const MINUTES = [5, 10, 15, 20];

export function OnboardingFlow({ displayName, onDone }: Props) {
  const [step, setStep] = useState(0);
  const [langs, setLangs] = useState<string[]>([]);
  const [levels, setLevels] = useState<Record<string, string>>({});
  const [minutes, setMinutes] = useState(10);
  const levelLanguage = langs[Math.max(0, step - 1)];
  const totalSteps = Math.max(3, langs.length + 2);
  const finish = () => {
    localStorage.setItem("yourbook_onboarding_v1", JSON.stringify({ langs, levels, minutes, completedAt: Date.now() }));
    onDone();
  };
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-label="Defter kurulumu">
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22 }} className="card-token w-full max-w-[520px] bg-[var(--paper)] p-6 text-[var(--ink)]">
      <div className="mb-5 flex items-center justify-between"><span className="font-mono text-xs">{Math.min(step + 1, totalSteps)}/{totalSteps}</span><button className="min-h-11 rounded-[var(--radius-pill)] px-3 font-sans text-sm" onClick={finish}>Atla</button></div>
      {step === 0 && <><h2 className="font-serif text-2xl">Hangi dilleri öğreniyorsun?</h2><div className="mt-5 grid-cols-2 gap-2">{LANGS.map((lang) => <button key={lang} className={`min-h-11 rounded-[var(--radius-md)] border-2 px-3 text-left font-sans ${langs.includes(lang) ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]" : "border-[var(--ink)]"}`} onClick={() => setLangs((v) => v.includes(lang) ? v.filter((x) => x !== lang) : [...v, lang])}>{lang}</button>)}</div></>}
      {step === 1 && <><h2 className="font-serif text-2xl">{levelLanguage} seviyen ne?</h2><div className="mt-5 grid-cols-5 gap-2">{LEVELS.map((item) => <button key={item} className={`min-h-11 rounded-[var(--radius-md)] border-2 font-mono ${levels[levelLanguage] === item ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]" : "border-[var(--ink)]"}`} onClick={() => setLevels((current) => ({ ...current, [levelLanguage]: item }))}>{item}</button>)}</div></>}
      {step === 2 && <><h2 className="font-serif text-2xl">Günde kaç dakika?</h2><div className="mt-5 grid-cols-4 gap-2">{MINUTES.map((item) => <button key={item} className={`min-h-11 rounded-[var(--radius-md)] border-2 font-mono ${minutes === item ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]" : "border-[var(--ink)]"}`} onClick={() => setMinutes(item)}>{item} dk</button>)}</div></>}
      <button className="mt-7 min-h-11 w-full rounded-[var(--radius-md)] border-2 border-[var(--ink)] bg-[var(--accent)] px-4 font-sans font-semibold shadow-[var(--shadow-card)]" onClick={() => step < totalSteps - 1 ? setStep(step + 1) : finish()}>{step < totalSteps - 1 ? "Devam" : `${displayName || "Defterin"} için kapağı aç`}</button>
    </motion.div>
  </div>;
}
