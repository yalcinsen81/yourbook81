import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OnboardingFlow, buildOnboardingSteps } from "./OnboardingFlow";

describe("buildOnboardingSteps", () => {
  it("dil seçilmediyse yalnızca dil ve süre adımları olur", () => {
    expect(buildOnboardingSteps([]).map((s) => s.kind)).toEqual(["langs", "minutes"]);
  });
  it("seçilen HER dil için bir seviye adımı üretir", () => {
    const steps = buildOnboardingSteps(["Almanca", "İngilizce"]);
    expect(steps.map((s) => s.kind)).toEqual(["langs", "level", "level", "minutes"]);
    expect(steps.filter((s) => s.kind === "level").map((s) => (s as { lang: string }).lang)).toEqual(["Almanca", "İngilizce"]);
  });
});

describe("OnboardingFlow", () => {
  beforeEach(() => localStorage.clear());

  it("dil seçmeden devam edilemez", () => {
    render(<OnboardingFlow onDone={() => {}} />);
    expect((screen.getByRole("button", { name: "Devam" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("iki dil için iki seviye sorusu sorar, sonra süreyi ve sonucu kaydeder", () => {
    let done = 0;
    let codes: string[] = [];
    render(<OnboardingFlow displayName="Ayşe" onDone={(c) => { done++; codes = c; }} />);
    fireEvent.click(screen.getByRole("button", { name: /Almanca/ }));
    fireEvent.click(screen.getByRole("button", { name: /İngilizce/ }));
    fireEvent.click(screen.getByRole("button", { name: "Devam" }));
    expect(screen.getByText(/Almanca seviyen ne\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /B1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Devam" }));
    expect(screen.getByText(/İngilizce seviyen ne\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Devam" }));
    expect(screen.getByText("Günde kaç dakika?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /15 dk/ }));
    fireEvent.click(screen.getByRole("button", { name: /Ayşe için kapağı aç/ }));
    expect(done).toBe(1);
    expect(codes).toEqual(["de", "en"]);
    const saved = JSON.parse(localStorage.getItem("yourbook_onboarding_v1")!);
    expect(saved.langs).toEqual(["Almanca", "İngilizce"]);
    expect(saved.levels).toEqual({ Almanca: "B1" });
    expect(saved.minutes).toBe(15);
  });

  it("geri düğmesi önceki adıma döner", () => {
    render(<OnboardingFlow onDone={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Almanca/ }));
    fireEvent.click(screen.getByRole("button", { name: "Devam" }));
    fireEvent.click(screen.getByRole("button", { name: "geri" }));
    expect(screen.getByText("Hangi dilleri öğreniyorsun?")).toBeTruthy();
  });
});
