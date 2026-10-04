import { useState, useMemo, useCallback } from "react";

// Superr Tema Sistemi: Defter tasarım bütünlüğü korunur,
// sadece kağıt / mürekkep / vurgu renkleri değişir.

export interface SuperrTheme {
  id: string;
  name: string;
  nameKey: string;
  icon: string;
  description: string;
  descKey: string;
  appBg: string;        // ana tuval kağıdı
  sidebarBg: string;    // sol menü kağıdı
  panelBg: string;      // kart & başlık paneli
  deskBg: string;       // masa zemini
  accent: string;       // vurgu (turuncu karşılığı)
  ink: string;          // ana metin mürekkebi
  inkSoft: string;      // ikincil metin
  border: string;       // çizgi rengi
  paper?: string; paperSecondary?: string; shadowColor?: string; accentInk?: string; success?: string; danger?: string; warning?: string; articleMasc?: string; articleFem?: string; articleNeut?: string; grainOpacity?: string; overlay?: string;
}

export const SUPERR_THEMES: SuperrTheme[] = [
  {
    id: "theme-cream",
    nameKey: "theme.cream.name",
    descKey: "theme.cream.desc",
    name: "krem portakal",
    icon: "",
    description: "Klasik yourbook kağıdı & turuncu mürekkep",
    appBg: "#faf7f2",        // Ferah, temiz sıcak krem defter kağıdı
    sidebarBg: "#f3ece2",    // Hafif tonlu sol defter kenarı
    panelBg: "#ffffff",      // Pırıl pırıl, tertemiz beyaz defter kartı
    deskBg: "#f5eee4",       // Ahşap çalışma masası
    accent: "#ff6f1e", accentInk: "#1A1408",       // Canlı defter turuncusu
    ink: "#1c1917",          // Koyu kakao/kömür mürekkep
    inkSoft: "#78716c",      // İkincil yumuşak mürekkep
    border: "#1c1917",
  },
  {
    id: "theme-mint",
    nameKey: "theme.mint.name",
    descKey: "theme.mint.desc",
    name: "nane yeşili",
    icon: "",
    description: "Sakin ders kağıdı, taze nane vurgusu",
    appBg: "#f4faf6",
    sidebarBg: "#e7f3ea",
    panelBg: "#ffffff",
    deskBg: "#edf7ef",
    accent: "#1F7A47", accentInk: "#FFFFFF",
    ink: "#132a1c",
    inkSoft: "#5c7564",
    border: "#132a1c",
  },
  {
    id: "theme-ocean",
    nameKey: "theme.ocean.name",
    descKey: "theme.ocean.desc",
    name: "okyanus defteri",
    icon: "",
    description: "Mavi çizgili defter kağıdı & deniz mavisi",
    appBg: "#f3f8fc",
    sidebarBg: "#e3eef7",
    panelBg: "#ffffff",
    deskBg: "#eaf2f9",
    accent: "#1A6FA8", accentInk: "#FFFFFF",
    ink: "#0e2233",
    inkSoft: "#587084",
    border: "#0e2233",
  },
  { id: "theme-night", nameKey: "theme.night.name", descKey: "theme.night.desc", name: "gece defteri", icon: "", description: "Derin gece mavisi, kömür kâğıt, kehribar ışık", appBg: "#10121A", sidebarBg: "#161924", panelBg: "#161924", paper: "#1D2130", deskBg: "#10121A", accent: "#F2B35A", ink: "#F3ECDD", inkSoft: "#A8A39A", border: "#383E58", paperSecondary: "#242940", shadowColor: "#07080D", accentInk: "#1A1408", success: "#7FD1A8", danger: "#F28C8C", warning: "#F2D16B", articleMasc: "#7FA8FF", articleFem: "#FF8FB5", articleNeut: "#7FD1A8", grainOpacity: "0.06", overlay: "rgba(7,8,13,0.7)" },
];

const STORAGE_KEY_THEME = "superr_theme_v1";

export function useTheme() {
  const [themeId, setThemeId] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_THEME) || SUPERR_THEMES[0].id;
    } catch {
      return SUPERR_THEMES[0].id;
    }
  });

  // v-perf: her render'da yeni referans -> gereksiz render. useMemo ile sabitle.
  const theme = useMemo(
    () => SUPERR_THEMES.find((t) => t.id === themeId) || SUPERR_THEMES[0],
    [themeId]
  );

  // v-perf: useCallback ile sabitle (her render'da yeni fonksiyon uretilmesin).
  const switchTheme = useCallback((id: string) => {
    setThemeId(id);
    try {
      localStorage.setItem(STORAGE_KEY_THEME, id);
    } catch {}
  }, []);

  return useMemo(
    () => ({ theme, themeId, switchTheme, themes: SUPERR_THEMES }),
    [theme, themeId, switchTheme]
  );
}
