import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "../i18n/I18nProvider";
import { DBook as BookOpen, DCalendar as Calendar, DDownload as Download, DLayers as Layers, DNote as StickyNote, DPlus as Plus, DSearch as Search, DUpload as Upload } from "./icons/doodle";
import { playPopSound } from "../lib/sound";
import { downloadBackup, pickBackupFile, restoreBackup } from "../lib/backup";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (mode: any, spaceId?: string) => void;
  onQuickAdd: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onQuickAdd,
}: CommandPaletteProps) {
  const { t } = useT();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [isOpen]);

  const commands = [
    {
      id: "hero",
      title: t("sidebar.item.cover"),
      keywords: ["ana sayfa", "hero", "giriş", "başlangıç", "kapak"],
      icon: BookOpen,
      shortcut: "Alt + 1",
      action: () => onNavigate("hero"),
    },
    {
      id: "cards-de",
      title: t("cp.german"),
      keywords: ["almanca", "german", "deutsch", "kelime", "masası", "kart", "srs", "de"],
      icon: Layers,
      shortcut: "Alt + 6",
      action: () => onNavigate("cards", "space-de"),
    },
    {
      id: "cards-en",
      title: t("cp.english"),
      keywords: ["ingilizce", "english", "kelime", "masası", "kart", "srs", "en"],
      icon: Layers,
      shortcut: "Alt + 7",
      action: () => onNavigate("cards", "space-en"),
    },
    {
      id: "notes",
      title: t("cp.notes"),
      keywords: ["notlar", "arşiv", "kategori", "not", "ihale", "kişisel"],
      icon: StickyNote,
      shortcut: "Alt + 3",
      action: () => onNavigate("notes"),
    },
    {
      id: "daily",
      title: t("cp.journal"),
      keywords: ["günlük", "görev", "today", "bugün", "journal", "todo"],
      icon: Calendar,
      shortcut: "Alt + 4",
      action: () => onNavigate("daily"),
    },
    {
      id: "work",
      title: t("cp.work"),
      keywords: ["iş", "proje", "network", "rehber", "kişiler", "fikirler", "aksiyonlar"],
      icon: StickyNote,
      shortcut: "Alt + 5",
      action: () => onNavigate("work"),
    },
    {
      id: "calendar",
      title: t("cp.calendar"),
      keywords: ["takvim", "ajanda", "saat", "alarm", "etkinlik", "plan"],
      icon: Calendar,
      shortcut: "",
      action: () => onNavigate("calendar"),
    },
    {
      id: "collections",
      title: t("cp.collections"),
      keywords: ["koleksiyon", "tüm", "arşiv", "sayfalar", "kartlar"],
      icon: Layers,
      shortcut: "Alt + 2",
      action: () => onNavigate("collections"),
    },
    {
      id: "youtube",
      title: t("cp.youtube"),
      keywords: ["youtube", "video", "ders", "izle", "bağlantı", "link"],
      icon: Layers,
      shortcut: "",
      action: () => onNavigate("youtube"),
    },
    {
      id: "add",
      title: t("cp.quick_add"),
      keywords: ["yeni", "ekle", "kart", "not", "kelime", "oluştur"],
      icon: Plus,
      shortcut: "Alt + N",
      action: onQuickAdd,
    },
    {
      id: "export",
      title: t("cp.backup"),
      keywords: ["yedek", "dışa aktar", "export", "indir", "backup", "kaydet"],
      icon: Download,
      shortcut: "",
      action: () => downloadBackup(),
    },
    {
      id: "import",
      title: t("cp.restore"),
      keywords: ["geri yükle", "içe aktar", "import", "restore", "yükle"],
      icon: Upload,
      shortcut: "",
      action: async () => {
        const backup = await pickBackupFile();
        if (!backup) return;
        const result = restoreBackup(backup);
        if (result.restoredKeys.length > 0) window.location.reload();
      },
    },
  ];

  const normalizedQuery = query.trim().toLowerCase();
  const scored = commands
    .map((cmd) => {
      if (!normalizedQuery) return { cmd, score: 0 };
      const title = cmd.title.toLowerCase();
      const keywords = cmd.keywords || [];

      let score = 0;
      if (title.startsWith(normalizedQuery)) score += 100;
      else if (title.includes(normalizedQuery)) score += 50;

      for (const kw of keywords) {
        if (kw === normalizedQuery) score += 90;
        else if (kw.startsWith(normalizedQuery)) score += 70;
        else if (kw.includes(normalizedQuery)) score += 30;
      }

      return { cmd, score };
    })
    .filter((item) => !normalizedQuery || item.score > 0)
    .sort((a, b) => b.score - a.score);

  const filtered = scored.map((s) => s.cmd);

  // Seçili sonucu çalıştır: önce paleti kapat, sonra (DOM temizlendikten sonra) eylemi uygula.
  const runCommand = (cmd: (typeof filtered)[number] | undefined) => {
    if (!cmd) return;
    playPopSound();
    onClose();
    setTimeout(() => {
      cmd.action();
    }, 16);
  };

  // Klavye navigasyonu: â†‘/â†“ ile gezin, Enter ile seç, Esc ile kapat.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (filtered.length ? (prev + 1) % filtered.length : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) =>
          filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0,
        );
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        runCommand(filtered[activeIndex]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, filtered, activeIndex]);

  // Filtre daralınca aktif index'i geçerli aralığa sabitle.
  useEffect(() => {
    setActiveIndex((prev) => (prev >= filtered.length ? 0 : prev));
  }, [filtered.length]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          data-qa-modal="command-palette"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-[10px] border border-[#e5e5e5] bg-[#fffdf8] shadow-lg"
          >
            <div className="flex items-center gap-3 border-b border-[#e5e5e5] px-4 py-3">
              <Search size={15} className="text-[#8c8c8c]" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                placeholder={t("archive.search_ph")}
                autoFocus
                className="w-full font-sans text-xs text-[#0a0a0a] placeholder:text-[#8c8c8c] bg-transparent outline-none"
              />
              <span className="font-mono text-[10px] text-[#8c8c8c]">ESC</span>
            </div>

            <div className="max-h-72 overflow-y-auto p-2 space-y-1">
              {filtered.map((cmd, index) => {
                const Icon = cmd.icon;
                const isActive = index === activeIndex;
                return (
                  <button
                    key={cmd.id}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => runCommand(cmd)}
                    className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-xs transition-colors ${
                      isActive ? "bg-[#1e2942] text-[#fffdf8]" : "text-[#0a0a0a] hover:bg-[#1e2942] hover:text-[#fffdf8]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon size={14} />
                      <span>{cmd.title}</span>
                    </div>
                    <span className="font-mono text-[10px] opacity-60">{cmd.shortcut}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
