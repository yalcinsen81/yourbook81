import { motion } from "framer-motion";
import { spaceTopicIcon, DDownload as Download, DUser as User } from "./icons/doodle";
import type { CraftSpace } from "../lib/spaces";
import type { AppUser } from "../lib/supabase";
import type { SuperrTheme } from "../lib/themes";
import { playPopSound } from "../lib/sound";
import { useT } from "../i18n/I18nProvider";

interface MobileHeaderProps {
  onOpenMenu: () => void;
  onOpenAuth: () => void;
  currentUser: AppUser | null;
  activeSpace: CraftSpace;
  onSwitchSpace: (spaceId: string) => void;
  spaces: CraftSpace[];
  theme: SuperrTheme;
  themes: SuperrTheme[];
  onSelectTheme: (id: string) => void;
  onOpenInstall?: () => void;
  /** v-mobile: hizli masa degistirici gosterilsin mi (yalniz ilgili masa ekraninda) */
  showDeskSwitcher?: boolean;
}

export function MobileHeader({
  onOpenMenu,
  onOpenAuth,
  currentUser,
  activeSpace,
  onSwitchSpace,
  spaces,
  theme,
  themes,
  onSelectTheme,
  onOpenInstall,
  showDeskSwitcher = false,
}: MobileHeaderProps) {
  const { t } = useT();
  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-3.5 py-2.5 bg-[var(--paper)] border-b border-[var(--line)] shadow-xs">
      {/* Sol: Menü Çekmecesi Düğmesi & Logo */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            playPopSound();
            onOpenMenu();
          }}
          className="p-1.5 rounded-[8px] border border-[var(--line-strong)] bg-[var(--app-bg)] text-[var(--ink)] hover:bg-[var(--paper)] shadow-sm flex items-center justify-center"
          title={t("tip.open_menu")}
        >
          {/* Organik El Çizimi Hamburger İkonu */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>

        {/* Marka: LTR icerik -> RTL sayfada bidi izolasyonu sart (yoksa "bookyour" olur) */}
        <span dir="ltr" className="inline-flex items-baseline">
         <span className="font-gelica text-[18px] font-semibold text-[var(--ink)] leading-none">your</span>
         <span className="font-gelica text-[18px] font-semibold text-[var(--accent)] leading-none">book</span>
        </span>
      </div>

      {/* v-mobile: hizli masa degistirici SADECE ilgili masa ekranindayken gorunur. */}
      {/* (Global header'da yer kaplamaz; dil masasi disinda gosterilmez.) */}
      {showDeskSwitcher && (
        <div className="flex items-center gap-1 bg-[var(--app-bg)] p-0.5 rounded-[20px] border border-[var(--line)]">
          {spaces
            .filter((s) => Boolean(s.languageCode) || s.id === "space-de" || s.id === "space-en")
            .map((sp) => {
              const isDE = sp.languageCode === "de" || sp.id === "space-de";
              const isEN = sp.languageCode === "en" || sp.id === "space-en";
              const tag = isDE ? "DE" : isEN ? "EN" : (sp.targetLang || sp.icon || "").toString().slice(0, 3);
              const isActive = sp.id === activeSpace.id;
              return (
                <button
                  key={sp.id}
                  onClick={() => { playPopSound(); onSwitchSpace(sp.id); }}
                  className={"flex items-center gap-1.5 px-2.5 py-0.5 rounded-[16px] text-[11px] font-geist font-semibold transition-all " + (isActive ? "bg-[var(--ink)] text-[var(--app-bg)] shadow-xs" : "text-[var(--ink-soft)] hover:text-[var(--ink)]")}
                >
                  {(() => { const LangIcon = spaceTopicIcon(sp.targetLang); return <LangIcon size={12} className={isActive ? "text-[var(--accent)]" : ""} />; })()}
                  <span>{tag}</span>
                </button>
              );
            })}
        </div>
      )}

      {/* Sağ: Hızlı Tema Butonu + Yükle Butonu + Kullanıcı Kimlik Düğmesi */}
      <div className="flex items-center gap-1.5">
        {onOpenInstall && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              playPopSound();
              onOpenInstall();
            }}
            className="w-7 h-7 rounded-full border border-[var(--line-strong)] bg-[var(--app-bg)] flex items-center justify-center text-xs shadow-xs text-[var(--accent)]"
            title={t("cust.pwa.title")}
          >
            <Download size={13} />
          </motion.button>
        )}

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            playPopSound();
            const idx = themes.findIndex((t) => t.id === theme.id);
            const nextIdx = (idx + 1) % themes.length;
            onSelectTheme(themes[nextIdx].id);
          }}
          className="w-7 h-7 rounded-full border border-[var(--line-strong)] bg-[var(--app-bg)] flex items-center justify-center shadow-xs"
          title={t("mobile.theme_switch").replace("{name}", t(theme.nameKey))}
        >
          {/* v-mobile: tema rengini GORUNUR goster. Ikon bos gelirse daire bos kalmasin. */}
          <span
            className="block h-3.5 w-3.5 rounded-full border border-[color-mix(in_srgb,var(--ink)_45%,transparent)]"
            style={{ background: theme.accent }}
            aria-hidden="true"
          />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            playPopSound();
            onOpenAuth();
          }}
          className="flex items-center gap-1.5 p-0.5 rounded-full border border-[var(--line-strong)] bg-[var(--app-bg)] shadow-xs"
          title={t("tip.identity")}
        >
          <span className="w-6 h-6 rounded-full border border-[var(--line)] bg-[var(--accent)] text-white flex items-center justify-center font-geist text-[11px] font-bold">
            {currentUser ? currentUser.avatarLetter : <User size={12} />}
          </span>
        </motion.button>
      </div>
    </header>
  );
}
