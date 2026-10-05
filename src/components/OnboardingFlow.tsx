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

export type OnboardingStep = { kind: "langs" } | { kind: "level"; lang: string } | { kind: "minutes" };

/** Adım sırası: diller → seçilen HER dil için seviye → günlük süre. */
export function buildOnboardingSteps(langs: string[]): OnboardingStep[] {
  return [{ kind: "langs" }, ...langs.map((lang) => ({ kind: "level" as const, lang })), { kind: "minutes" }];
}

function Choice({ selected, onClick, children, mono = false }: { selected: boolean; onClick: () => void; children: React.ReactNode; mono?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`relative flex min-h-12 items-center justify-between gap-2 rounded-[var(--radius-md)] border px-4 text-start text-[15px] font-medium transition-colors ${mono ? "font-mono" : "font-geist"} ${
        selected
          ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--ink)] shadow-[0_0_0_1px_var(--accent)]"
          : "border-[var(--line-strong)] text-[var(--ink)] hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
      }`}
    >
      <span>{children}</span>
      <span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] leading-none ${selected ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--line-strong)] text-transparent"}`}>✓</span>
    </button>
  );
}

export function OnboardingFlow({ displayName, onDone }: Props) {
  const { t } = useT();
  const [step, setStep] = useState(0);
  const [langs, setLangs] = useState<string[]>([]);
  const [levels, setLevels] = useState<Record<string, string>>({});
  const [minutes, setMinutes] = useState(10);

  const steps = buildOnboardingSteps(langs);
  const current = steps[Math.min(step, steps.length - 1)];
  const isLast = step >= steps.length - 1;
  const canContinue = current.kind !== "langs" || langs.length > 0;
  const langLabel = (id: string) => t(LANGS.find((l) => l.id === id)?.key ?? "");

  const finish = () => {
    try {
      localStorage.setItem("yourbook_onboarding_v1", JSON.stringify({ langs, levels, minutes, completedAt: Date.now() }));
    } catch { /* depolama kapalıysa sessizce geç */ }
    onDone();
  };
  const next = () => { if (!canContinue) return; if (isLast) finish(); else setStep(step + 1); };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label={t("onb.aria")}>
      <motion.div
        key="onb-card"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-[480px] rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--paper)] p-6 text-[var(--ink)] shadow-[var(--shadow-soft)] sm:p-7"
      >
        <div className="mb-6 flex items-center gap-4">
          <div className="flex flex-1 items-center gap-1.5" aria-label={`${step + 1}/${steps.length}`}>
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? "bg-[var(--accent)]" : "bg-[color-mix(in_srgb,var(--ink)_12%,transparent)]"}`} />
            ))}
          </div>
          <button type="button" onClick={finish} className="rounded-[var(--radius-pill)] px-2 py-1 font-geist text-sm text-[var(--ink-soft)] hover:text-[var(--ink)]">{t("onb.skip")}</button>
        </div>

        {current.kind === "langs" && (
          <>
            <h2 className="font-gelica text-[26px] font-semibold leading-tight">{t("onb.which_langs")}</h2>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {LANGS.map(({ id, key }) => (
                <Choice key={id} selected={langs.includes(id)} onClick={() => setLangs((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]))}>{t(key)}</Choice>
              ))}
            </div>
          </>
        )}

        {current.kind === "level" && (
          <>
            <h2 className="font-gelica text-[26px] font-semibold leading-tight">{t("onb.level_q", { lang: langLabel(current.lang) })}</h2>
            <div className="mt-5 grid grid-cols-5 gap-2.5">
              {LEVELS.map((item) => (
                <Choice key={item} mono selected={levels[current.lang] === item} onClick={() => setLevels((c) => ({ ...c, [current.lang]: item }))}>{item}</Choice>
              ))}
            </div>
          </>
        )}

        {current.kind === "minutes" && (
          <>
            <h2 className="font-gelica text-[26px] font-semibold leading-tight">{t("onb.minutes_q")}</h2>
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {MINUTES.map((item) => (
                <Choice key={item} selected={minutes === item} onClick={() => setMinutes(item)}>{t("onb.minutes_unit", { n: item })}</Choice>
              ))}
            </div>
          </>
        )}

        <div className="mt-7 flex items-center gap-3">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className="min-h-12 rounded-[var(--radius-md)] border border-[var(--line-strong)] px-5 font-geist text-[15px] font-medium hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]">{t("onb.back")}</button>
          )}
          <button
            type="button"
            onClick={next}
            disabled={!canContinue}
            className="btn-pill-orange min-h-12 flex-1 justify-center !rounded-[var(--radius-md)] text-[15px] font-semibold disabled:cursor-not-allowed disabled:!border-transparent disabled:!bg-[color-mix(in_srgb,var(--ink)_10%,transparent)]"
          >
            {isLast ? t("onb.open_cover", { name: displayName || t("onb.default_name") }) : t("onb.next")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
