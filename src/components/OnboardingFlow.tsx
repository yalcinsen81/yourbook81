import { useState } from "react";
import { motion } from "framer-motion";
import { useT } from "../i18n/I18nProvider";

type Props = { displayName?: string; onDone: () => void };
// Kayıtlı değerler (Türkçe adlar) korunur; yalnızca görünen etiket çevrilir.
const LANGS: Array<{ id: string; key: string }> = [
  { id: "Almanca", key: "onb.lang_de" },
  { id: "İngilizce", key: "onb.lang_en" },
  { id: "İspanyolca", key: "onb.lang_es" },
  { id: "İtalyanca", key: "onb.lang_it" },
  { id: "Fransızca", key: "onb.lang_fr" },
];
const LEVELS = ["A1", "A2", "B1", "B2", "C1"];
const MINUTES = [5, 10, 15, 20];

export function OnboardingFlow({ displayName, onDone }: Props) {
  const { t } = useT();
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
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-label={t("onb.aria")}>
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22 }} className="card-token w-full max-w-[520px] bg-[var(--paper)] p-6 text-[var(--ink)]">
      <div className="mb-5 flex items-center justify-between"><span className="font-mono text-xs">{Math.min(step + 1, totalSteps)}/{totalSteps}</span><button className="min-h-11 rounded-[var(--radius-pill)] px-3 font-sans text-sm" onClick={finish}>{t("onb.skip")}</button></div>
      {step === 0 && <><h2 className="font-serif text-2xl">{t("onb.which_langs")}</h2><div className="mt-5 grid-cols-2 gap-2">{LANGS.map(({ id: lang, key: langKey }) => <button key={lang} className={`min-h-11 rounded-[var(--radius-md)] border px-3 text-left font-sans ${langs.includes(lang) ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]" : "border-[var(--line-strong)]"}`} onClick={() => setLangs((v) => v.includes(lang) ? v.filter((x) => x !== lang) : [...v, lang])}>{t(langKey)}</button>)}</div></>}
      {step === 1 && <><h2 className="font-serif text-2xl">{t("onb.level_q", { lang: t(LANGS.find((l) => l.id === levelLanguage)?.key ?? "") })}</h2><div className="mt-5 grid-cols-5 gap-2">{LEVELS.map((item) => <button key={item} className={`min-h-11 rounded-[var(--radius-md)] border font-mono ${levels[levelLanguage] === item ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]" : "border-[var(--line-strong)]"}`} onClick={() => setLevels((current) => ({ ...current, [levelLanguage]: item }))}>{item}</button>)}</div></>}
      {step === 2 && <><h2 className="font-serif text-2xl">{t("onb.minutes_q")}</h2><div className="mt-5 grid-cols-4 gap-2">{MINUTES.map((item) => <button key={item} className={`min-h-11 rounded-[var(--radius-md)] border font-mono ${minutes === item ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]" : "border-[var(--line-strong)]"}`} onClick={() => setMinutes(item)}>{t("onb.minutes_unit", { n: item })}</button>)}</div></>}
      <button className="mt-7 min-h-11 w-full rounded-[var(--radius-md)] border border-[var(--line-strong)] bg-[var(--accent)] px-4 font-sans font-semibold shadow-[var(--shadow-card)]" onClick={() => step < totalSteps - 1 ? setStep(step + 1) : finish()}>{step < totalSteps - 1 ? t("onb.next") : t("onb.open_cover", { name: displayName || t("onb.default_name") })}</button>
    </motion.div>
  </div>;
}
