import { motion } from "framer-motion";
import {
  DBook as BookOpen,
  DBriefcase as Briefcase,
  DCalendarDays as CalendarDays,
  DFolder as FolderKanban,
  DLayers as Layers,
} from "./icons/doodle";
import type { NavView } from "./SuperrSidebar";
import { playPopSound, playPaperRustle } from "../lib/sound";
import { useT } from "../i18n/I18nProvider";

interface MobileBottomNavProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
}

export function MobileBottomNav({
  currentView,
  onSelectView,
}: MobileBottomNavProps) {
  const { t } = useT();
  const tabs = [
    { id: "hero" as NavView, label: t("sidebar.item.cover_short"), icon: BookOpen },
    { id: "cards" as NavView, label: t("hero.tab.desks"), icon: Layers },
    { id: "daily" as NavView, label: t("sidebar.item.agenda_short"), icon: CalendarDays },
    { id: "work" as NavView, label: t("notes.tag_work"), icon: Briefcase },
    { id: "collections" as NavView, label: t("vol.archive_suffix"), icon: FolderKanban },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 start-0 end-0 z-40 bg-[var(--paper)] border-t-2 border-[var(--ink)] px-2 py-1 flex items-center justify-around shadow-lg">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentView === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => {
              if (currentView !== tab.id) {
                playPaperRustle();
                playPopSound();
                onSelectView(tab.id);
              }
            }}
            className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 rounded-[12px] h-[52px] w-[19%] max-w-[74px] transition-all ${isActive
                ? "text-[var(--app-bg)]"
                : "text-[var(--ink)] opacity-70 hover:opacity-100"
              }`}
          >
            {isActive && (
              <motion.div
                layoutId="mobile-nav-pill"
                transition={{ type: "spring", stiffness: 450, damping: 30 }}
                className="absolute inset-0 bg-[var(--ink)] rounded-[12px] -z-10 shadow-xs"
              />
            )}
            <Icon size={15} />
            <span className="block w-full max-w-full truncate whitespace-nowrap text-center font-gelica text-[9px] font-semibold lowercase leading-none tracking-tight">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
