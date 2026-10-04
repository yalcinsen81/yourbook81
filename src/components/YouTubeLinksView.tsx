import { SketchClock, SketchCheckedBox, SketchBriefcase, SketchLaptop, SketchLightbulb, SketchClipboard } from "./icons/sketchIcons";
import { useT } from "../i18n/I18nProvider";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DCalendarDays as ListOrdered, DCheck as Check, DCheckCircle as CheckCircle2, DClock as Clock, DEye as Eye, DLink as ExternalLink, DPlay as Play, DPlus as Plus, DSearch as Search, DSparkles as Sparkles, DTag as Tag, DTopicAction, DTopicBiz, DTopicCode, DTopicEnglish, DTopicGerman, DTopicLife, DTrash as Trash2, DEdit as Pencil, DVideo as Video, DX as X } from "./icons/doodle";
import {
  type YouTubeVideoItem,
  type VideoCategory,
  type WatchStatus,
  VIDEO_CATEGORIES,
  extractYouTubeId,
  autoDetectCategory,
  fetchYouTubeMeta,
  SEED_YOUTUBE_VIDEOS,
} from "../lib/youtube";
import { playPopSound, playSuccessSound } from "../lib/sound";
import { getCardRotationStyle } from "../lib/paperStyles";
import { SketchEmptySearch, SketchEmptyVideo } from "./icons/EmptyStateIllustrations";

const CATEGORY_DOODLE_ICONS: Record<VideoCategory, React.ComponentType<{ size?: number; className?: string }>> = {
  german: DTopicGerman,
  english: DTopicEnglish,
  business: SketchBriefcase,
  tech: SketchLaptop,
  personal: SketchLightbulb,
};

const STORAGE_KEY_YOUTUBE = "superr_youtube_links_archive_v2";

export function YouTubeLinksView() {
  const { t } = useT();
  const [videos, setVideos] = useState<YouTubeVideoItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_YOUTUBE);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Boş/bozuk dizi geldiğinde seed'i kaybetme: arşiv bir kez boşalırsa
        // kullanıcı bir daha hiçbir videoyu göremez. Bu yüzden [] -> seed.
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return SEED_YOUTUBE_VIDEOS;
  });

  const [activeStatus, setActiveStatus] = useState<WatchStatus | "all">("all");
  const [activeCat, setActiveCat] = useState<VideoCategory | "all">("all");

  // Kategori adı: modül dizisindeki adı i18n ile çevir (render sırasında).
  const catLabel = (c: VideoCategory) => t(`yt.cat.${c}`);
  const [groupByTopic, setGroupByTopic] = useState(false);
  const [search, setSearch] = useState("");

  // Yeni Video Ekleme State'leri
  const [isAdding, setIsAdding] = useState(false);
  const [inputUrl, setInputUrl] = useState("");
  const [inputTitle, setInputTitle] = useState("");
  const [inputChannel, setInputChannel] = useState("");
  const [inputCategory, setInputCategory] = useState<VideoCategory>("german");
  const [inputNotes, setInputNotes] = useState("");
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);

  // Video Oynatıcı Modalı
  const [playingVideo, setPlayingVideo] = useState<YouTubeVideoItem | null>(null);

  // Yanlışlıkla silinen kaydı geri alabilmek için tampon (6 sn).
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lastDeleted, setLastDeleted] = useState<{ video: YouTubeVideoItem; index: number } | null>(
    null,
  );
  const undoTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current ?? undefined);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_YOUTUBE, JSON.stringify(videos));
    } catch {}
  }, [videos]);

  // Link yapıştırıldığında veya yazıldığında otomatik kategori ve başlık tahmini
  const handleUrlChange = (url: string) => {
    setInputUrl(url);
    const videoId = extractYouTubeId(url);
    if (videoId) {
      setAutoDetected(true);
      setInputCategory(autoDetectCategory(url + " " + inputTitle));
      processYouTubeText(url);
    }
  };

  // Panodaki metinden YouTube linkini çıkar (her türlü YouTube linkini yakalar)
  const extractUrlFromClipboard = (text: string): string | null => {
    if (!text) return null;
    const id = extractYouTubeId(text);
    return id ? text.trim() : null;
  };

  // Link (veya link içeren metin) işlenir: doldur + oEmbed ile başlık/kanal çek + sınıflandır
  const processYouTubeText = async (pasted: string) => {
    const clean = pasted.trim();
    const videoId = extractYouTubeId(clean);
    if (!videoId) return false;

    const cleanUrl = clean.startsWith("http") ? clean : `https://www.youtube.com/watch?v=${videoId}`;
    setInputUrl(cleanUrl);
    setAutoDetected(true);
    setInputCategory(autoDetectCategory(cleanUrl + " " + clean));

    setIsFetchingMeta(true);
    try {
      // v-fix: COK KATMANLI meta cekme.
      // Birincil: RESMI YouTube oEmbed API (author_name = kanal adi).
      // Yedekler: noembed.com, allorigins proxy. Biri calisirsa yeter.
      const meta = await fetchYouTubeMeta(videoId, cleanUrl);
      if (meta.title) {
        setInputTitle(meta.title);
        setInputCategory(autoDetectCategory(meta.title + " " + cleanUrl));
      }
      if (meta.channelName) setInputChannel(meta.channelName);
    } catch {
      // Offline / API hatası olursa kullanıcı manuel yazabilir
    } finally {
      setIsFetchingMeta(false);
    }
    return true;
  };

  // Manuel yapıştırma (Ctrl+V) anında: tarayıcının doğal yapıştırmasını engelleme, hemen işle
  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (pasted) {
      setTimeout(() => {
        processYouTubeText(pasted);
      }, 50);
    }
  };

  const urlInputRef = useRef<HTMLInputElement>(null);

  // Panodan oku, YouTube linki varsa otomatik doldur & sınıflandır
  const handleClipboardPaste = async (): Promise<boolean> => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip && extractUrlFromClipboard(clip)) {
        await processYouTubeText(clip);
        return true;
      }
    } catch {
      // Pano izni yoksa kullanıcı Ctrl+V ile yapıştırabilir
    }
    return false;
  };

  // "+ yeni link ekle" butonu: formu aç, inputa odaklan ve panodaki linki otomatik doldur
  const handleToggleAdd = async () => {
    playPopSound();
    const next = !isAdding;
    setIsAdding(next);
    if (next) {
      setAutoDetected(false);
      setTimeout(() => urlInputRef.current?.focus(), 350);
      // Form açılır açılmaz panoyu sessizce dene: link varsa otomatik doldur & sınıflandır
      await handleClipboardPaste();
    }
  };

  const [clipboardHint, setClipboardHint] = useState("");

  // Form içindeki "panodan yapıştır" butonu: pano izni yoksa kullanıcıya yol göster
  const handleClipboardPasteButton = async () => {
    playPopSound();
    const ok = await handleClipboardPaste();
    if (!ok) {
      setClipboardHint(t("yt.clipboard_fail"));
      setTimeout(() => setClipboardHint(""), 4000);
      urlInputRef.current?.focus();
    }
  };

  const handleTitleChange = (title: string) => {
    setInputTitle(title);
    const cat = autoDetectCategory(title + " " + inputUrl);
    setInputCategory(cat);
  };

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    const videoId = extractYouTubeId(inputUrl);
    // v-fix: kullanici dogrudan 'ekle'ye bassa bile baslik/kanal CEKILIR.
    // (Onceden sadece paste/change yolunda deneniyordu -> generic deger yaziliyordu.)
    let resolvedTitle = inputTitle.trim();
    let resolvedChannel = inputChannel.trim();
    if (videoId && (!resolvedTitle || !resolvedChannel)) {
      try {
        const meta = await fetchYouTubeMeta(videoId, inputUrl.trim());
        if (!resolvedTitle && meta.title) resolvedTitle = meta.title;
        if (!resolvedChannel && meta.channelName) resolvedChannel = meta.channelName;
      } catch { /* ag yoksa generic degere dusulur */ }
    }
    if (!videoId) {
      alert(t("yt.invalid_link"));
      return;
    }

    playSuccessSound();
    const newVideo: YouTubeVideoItem = {
      id: "yt-" + Date.now(),
      url: inputUrl.trim(),
      videoId,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      title: resolvedTitle || `YouTube Video (${videoId})`,
      channelName: resolvedChannel || t("yt.channel"),
      category: inputCategory,
      status: "to_watch",
      order: videos.length + 1,
      notes: inputNotes.trim(),
      tags: [`#${catLabel(inputCategory).split(" ")[0]}`],
      createdAt: Date.now(),
    };

    setVideos((prev) => [newVideo, ...prev]);
    setInputUrl("");
    setInputTitle("");
    setInputChannel("");
    setInputNotes("");
    setIsAdding(false);
  };

  const handleStatusChange = (id: string, newStatus: WatchStatus, e?: React.MouseEvent) => {
    e?.stopPropagation();
    playPopSound();
    setVideos((prev) =>
      prev.map((v) => (v.id === id ? { ...v, status: newStatus } : v))
    );
  };

  const handleDeleteVideo = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    playPopSound();
    // Silinen kaydı sakla: kullanıcı yanlışlıkla silerse geri alabilsin.
    const removed = videos.find((v) => v.id === id);
    setVideos((prev) => prev.filter((v) => v.id !== id));
    if (removed) {
      setLastDeleted({ video: removed, index: videos.findIndex((v) => v.id === id) });
      // Toast 6 sn görünür, sonra otomatik temizlenir.
      window.clearTimeout(undoTimerRef.current ?? undefined);
      undoTimerRef.current = window.setTimeout(() => setLastDeleted(null), 5000);
    }
  };

  // Silmeyi geri al: kaydı eski konumuna yerleştir.
  const handleUndoDelete = () => {
    if (!lastDeleted) return;
    const { video, index } = lastDeleted;
    setVideos((prev) => {
      if (prev.some((v) => v.id === video.id)) return prev;
      const next = [...prev];
      const at = index < 0 || index > next.length ? next.length : index;
      next.splice(at, 0, video);
      return next;
    });
    setLastDeleted(null);
    window.clearTimeout(undoTimerRef.current ?? undefined);
  };

  // Filtreleme
  const filteredVideos = videos
    .filter((v) => {
      if (activeStatus === "to_watch") return v.status !== "watched";
      if (activeStatus === "watched") return v.status === "watched";
      return true;
    })
    .filter((v) => (activeCat === "all" ? true : v.category === activeCat))
    .filter(
      (v) =>
        v.title.toLowerCase().includes(search.toLowerCase()) ||
        v.channelName.toLowerCase().includes(search.toLowerCase()) ||
        v.notes.toLowerCase().includes(search.toLowerCase())
    );
  return (
    <div
      data-lovable-target="youtube-links-view"
      data-lovable-name='Sayfa: "YouTube Arşivi & Dersler"'
      data-lovable-file="src/components/YouTubeLinksView.tsx"
      className="flex h-full w-full flex-col overflow-y-auto px-4 sm:px-10 py-4 sm:py-10 bg-[var(--app-bg)] text-[var(--ink)] select-none scrollbar-thin"
    >
      {/* Silme geri alma bildirimi */}
      {confirmDeleteId && <div role="dialog" aria-modal="true" aria-labelledby="youtube-delete-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="rounded-xl bg-[var(--paper)] p-5"><h2 id="youtube-delete-title">{t("yt.delete_title")}</h2><div className="mt-3 flex gap-2"><button type="button" onClick={() => setConfirmDeleteId(null)}>{t("act.cancel")}</button><button type="button" onClick={() => { handleDeleteVideo(confirmDeleteId); setConfirmDeleteId(null); }}>{t("yt.delete_yes")}</button></div></div></div>}
      {lastDeleted && (
        <div className="pointer-events-auto fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--ink)] px-4 py-2.5 shadow-lg">
            <span className="font-geist text-xs text-[var(--app-bg)]">
              {t("yt.deleted_toast").replace("{title}", lastDeleted.video.title.slice(0, 32))}
            </span>
            <button
              onClick={handleUndoDelete}
              className="rounded-[20px] border border-[var(--app-bg)] px-3 py-1 font-gelica text-[11px] font-bold text-[var(--app-bg)] transition-colors hover:bg-[var(--app-bg)] hover:text-[var(--ink)]"
            >
              geri al
            </button>
          </div>
        </div>
      )}

      {/* 1. Üst Başlık & Arama */}
      <div className="flex flex-col gap-4 border-b-2 border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="font-handwritten text-[var(--accent)] text-base block font-bold">
              {t("yt.sub")}
            </span>
            <h2 className="font-gelica text-[36px] sm:text-[42px] font-semibold lowercase text-[var(--ink)] leading-tight">
              {t("yt.section")}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleAdd}
              className="btn-pill-orange text-xs !py-1.5 !px-4"
            >
              <Plus size={13} />
              <span>{isAdding ? t("act.cancel") : t("yt.add_short")}</span>
            </button>
          </div>
        </div>

        {/* 20px Pill Durum Sekmeleri & Arama */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(() => {
              const totalCount = videos.length;
              const toWatchCount = videos.filter((v) => v.status !== "watched").length;
              const watchedCount = videos.filter((v) => v.status === "watched").length;

              return (
                <>
                  <button
                    disabled={totalCount === 0}
                    onClick={() => {
                      if (totalCount === 0) return;
                      playPopSound();
                      setActiveStatus("all");
                    }}
                    className={`rounded-[20px] px-3.5 py-1 text-xs font-gelica font-semibold transition-all ${
                      totalCount === 0
                        ? "opacity-40 cursor-not-allowed border border-[color-mix(in_srgb,var(--border-ink)_15%,transparent)] bg-[var(--app-bg)] text-[var(--ink-soft)]"
                        : activeStatus === "all"
                        ? "bg-[var(--ink)] text-[var(--app-bg)] border border-[var(--line)]"
                        : "border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] text-[var(--ink)] hover:border-[var(--ink)]"
                    }`}
                  >
                    {t("yt.filter_all").replace("{n}", String(totalCount))}
                  </button>

                  <button
                    disabled={toWatchCount === 0}
                    onClick={() => {
                      if (toWatchCount === 0) return;
                      playPopSound();
                      setActiveStatus("to_watch");
                    }}
                    className={`rounded-[20px] px-3 py-1 text-xs font-gelica font-semibold transition-all ${
                      toWatchCount === 0
                        ? "opacity-40 cursor-not-allowed border border-[color-mix(in_srgb,var(--border-ink)_15%,transparent)] bg-[var(--app-bg)] text-[var(--ink-soft)]"
                        : activeStatus === "to_watch"
                        ? "bg-[var(--accent)] text-[var(--app-bg)] border border-[var(--line)]"
                        : "border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] text-[var(--ink)] hover:border-[var(--ink)]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5"><SketchClock size={13} strokeWidth={1.8} className="shrink-0" /><span>{t("yt.to_watch")} ({toWatchCount})</span></span>
                  </button>

                  <button
                    disabled={watchedCount === 0}
                    onClick={() => {
                      if (watchedCount === 0) return;
                      playPopSound();
                      setActiveStatus("watched");
                    }}
                    className={`rounded-[20px] px-3 py-1 text-xs font-gelica font-semibold transition-all ${
                      watchedCount === 0
                        ? "opacity-40 cursor-not-allowed border border-[color-mix(in_srgb,var(--border-ink)_15%,transparent)] bg-[var(--app-bg)] text-[var(--ink-soft)]"
                        : activeStatus === "watched"
                        ? "bg-[#22c55e] text-[var(--app-bg)] border border-[var(--line)]"
                        : "border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] text-[var(--ink)] hover:border-[var(--ink)]"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5"><SketchCheckedBox size={13} strokeWidth={1.8} className="shrink-0" /><span>{t("yt.status_watched")} ({watchedCount})</span></span>
                  </button>
                </>
              );
            })()}
          </div>

          <div className="relative flex items-center max-w-xs w-full">
            <Search size={15} className="absolute start-3.5 text-[var(--ink)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("yt.search_ph")}
              className="w-full rounded-[20px] border border-[var(--line-strong)] bg-[var(--paper)] py-2 ps-9 pe-3 font-geist text-xs font-medium text-[var(--ink)] placeholder:text-[var(--ink-soft)] outline-none focus:border-[var(--accent)] shadow-[3px_3px_0_0_var(--ink)] transition-all"
            />
          </div>
        </div>

        {/* ⭐ KONULARINA GÖRE SINIFLANDIRMA SEKMELERİ */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[color-mix(in_srgb,var(--border-ink)_18%,transparent)]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-handwritten text-[var(--accent)] text-sm font-bold me-2 flex items-center gap-1">
              <Tag size={13} />
              <span>{t("yt.topics_label")}</span>
            </span>

            <button
              disabled={videos.length === 0}
              onClick={() => {
                if (videos.length === 0) return;
                playPopSound();
                setActiveCat("all");
              }}
              className={`rounded-[20px] px-3 py-1 text-xs font-gelica font-semibold transition-all ${
                videos.length === 0
                  ? "opacity-40 cursor-not-allowed border border-[color-mix(in_srgb,var(--border-ink)_15%,transparent)] bg-[var(--app-bg)] text-[var(--ink-soft)]"
                  : activeCat === "all"
                  ? "bg-[var(--ink)] text-[var(--app-bg)] border border-[var(--line)] shadow-sm"
                  : "border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] text-[var(--ink)] hover:border-[var(--ink)]"
              }`}
            >
              {t("yt.topics_all").replace("{n}", String(videos.length))}
            </button>

            {Object.entries(VIDEO_CATEGORIES).map(([catKey, catInfo]) => {
              const count = videos.filter((v) => v.category === catKey).length;
              const isSelected = activeCat === catKey;
              const isDisabled = count === 0;
              const CatIcon = CATEGORY_DOODLE_ICONS[catKey as VideoCategory];
              return (
                <button
                  key={catKey}
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    playPopSound();
                    setActiveCat(catKey as VideoCategory);
                  }}
                  className={`rounded-[20px] px-3 py-1 text-xs font-gelica font-semibold transition-all flex items-center gap-1.5 ${
                    isDisabled
                      ? "opacity-40 cursor-not-allowed border border-[color-mix(in_srgb,var(--border-ink)_15%,transparent)] bg-[var(--app-bg)] text-[var(--ink-soft)]"
                      : isSelected
                      ? "bg-[var(--accent)] text-[var(--app-bg)] border border-[var(--line)] shadow-sm"
                      : "border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] text-[var(--ink)] hover:border-[var(--ink)]"
                  }`}
                >
                  <CatIcon size={14} />
                  <span>{catLabel(catKey as VideoCategory)}</span>
                  <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 font-mono text-[10px] font-bold text-[var(--app-bg)]">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Konulara Göre Grupla / Düz Izgara Görünümü Anahtarı */}
          <button
            type="button"
            onClick={() => {
              playPopSound();
              setGroupByTopic((prev) => !prev);
            }}
            className={`flex items-center gap-1.5 rounded-[20px] px-3 py-1 text-xs font-gelica font-semibold border border-[var(--line-strong)] transition-all ${
              groupByTopic
                ? "bg-[var(--ink)] text-[var(--app-bg)] shadow-sm"
                : "bg-[var(--app-bg)] text-[var(--ink)] hover:bg-[var(--paper)]"
            }`}
          >
            <ListOrdered size={13} />
            <span>{groupByTopic ? t("yt.grouped") : t("yt.group")}</span>
          </button>
        </div>
      </div>

      {/* 2. Yeni YouTube Linki Ekleme Formu */}
      <AnimatePresence>
        {isAdding && (
          <motion.form
            initial={{ opacity: 0, maxHeight: 0, overflow: "hidden" }}
            animate={{ opacity: 1, maxHeight: 600, overflow: "hidden" }}
            exit={{ opacity: 0, maxHeight: 0, overflow: "hidden" }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onSubmit={handleAddVideo}
            className="my-5 p-5 card-superr border border-[var(--line-strong)] bg-[var(--paper)] flex flex-col gap-3.5 shadow-superrCard"
          >
            <span className="font-gelica text-xs font-semibold text-[var(--ink)]">
              {t("yt.add_ph")}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClipboardPasteButton}
                className="rounded-[20px] border border-[var(--line-strong)] bg-[var(--app-bg)] px-3 py-1 font-gelica text-[11px] font-semibold text-[var(--ink)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all shadow-sm"
              >
                {t("yt.paste")}
              </button>
              {clipboardHint && (
                <span className="font-geist text-[11px] text-[var(--accent)] font-semibold">{clipboardHint}</span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                ref={urlInputRef}
                value={inputUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                onPaste={handleUrlPaste}
                placeholder={t("yt.link_ph")}
                required
                className="flex-1 rounded-[10px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-2.5 font-mono text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)] shadow-sm"
              />

              <select
                value={inputCategory}
                onChange={(e) => setInputCategory(e.target.value as any)}
                className="rounded-[10px] border border-[var(--line-strong)] bg-[var(--app-bg)] px-3 py-2 font-gelica text-xs font-semibold text-[var(--ink)] outline-none shadow-sm"
              >
                {Object.entries(VIDEO_CATEGORIES).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.icon ? `${info.icon} ` : ""}{catLabel(key as VideoCategory)}
                  </option>
                ))}
              </select>
            </div>

            {/* Canlı otomatik sınıflandırma göstergesi */}
            {(autoDetected || isFetchingMeta) && (
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {isFetchingMeta ? (
                  <span className="flex items-center gap-1.5 rounded-full border-[1.5px] border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] px-2.5 py-1 font-gelica font-semibold text-[color-mix(in_srgb,var(--border-ink)_20%,transparent)]">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
                    {t("yt.fetching")}
                  </span>
                ) : (
                  <span
                    className={`rounded-full border-[1.5px] px-2.5 py-1 font-gelica font-semibold ${
                      VIDEO_CATEGORIES[inputCategory]?.badgeClass || ""
                    }`}
                  >
                    {t("yt.auto_classified")}: {catLabel(inputCategory)}
                  </span>
                )}
                {inputTitle && (
                  <span className="rounded-full border-[1.5px] border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--app-bg)] px-2.5 py-1 font-geist text-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] max-w-full truncate">
                    {inputTitle}
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={inputTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder={t("yt.video_title_ph")}
                className="rounded-[10px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-2.5 font-geist text-xs text-[var(--ink)] outline-none"
              />

              <input
                type="text"
                value={inputChannel}
                onChange={(e) => setInputChannel(e.target.value)}
                placeholder={t("yt.channel_ph")}
                className="rounded-[10px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-2.5 font-geist text-xs text-[var(--ink)] outline-none shadow-sm"
              />
            </div>

            <textarea
              rows={2}
              value={inputNotes}
              onChange={(e) => setInputNotes(e.target.value)}
              placeholder={t("yt.notes_ph")}
              className="w-full rounded-[10px] border border-[var(--line-strong)] bg-[var(--app-bg)] p-2.5 font-geist text-xs text-[var(--ink)] outline-none leading-relaxed shadow-sm"
            />

            <div className="flex justify-end gap-2 pt-1">
              <button type="submit" className="btn-pill-orange text-xs !py-1.5 !px-5">
                <Check size={13} strokeWidth={2.5} />
                <span>{t("yt.save")}</span>
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* 3. Konularına Göre Sınıflandırılmış Video Listesi */}
      {filteredVideos.length === 0 ? (
        <div className="py-14 flex flex-col items-center justify-center text-center">
          {search.trim() ? (
            <SketchEmptySearch size={110} />
          ) : (
            <SketchEmptyVideo size={110} />
          )}
          <p className="font-gelica text-xl font-semibold text-[var(--ink)] mt-4">
            {search.trim() ? t("yt.empty_search").replace("{q}", search.trim()) : t("yt.empty")}
          </p>
          <p className="font-handwritten text-sm text-[var(--accent)] mt-1 font-bold">
            {search.trim()
              ? t("yt.empty_search_hint")
              : t("yt.empty_hint")}
              {search.trim() !== "" && (
                <button
                  type="button"
                  data-clear-search="1"
                  onClick={() => setSearch("")}
                  className="mt-3 rounded-[20px] border border-[var(--line-strong)] bg-[var(--app-bg)] px-3.5 py-1.5 font-gelica text-xs font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--paper)]"
                >
                  {t("search.clear")}
                </button>
              )}
          </p>
        </div>
      ) : groupByTopic && activeCat === "all" ? (
        <div className="mt-6 flex flex-col gap-8">
          {Object.entries(VIDEO_CATEGORIES).map(([catKey, catInfo]) => {
            const catVideos = filteredVideos.filter((v) => v.category === catKey);
            if (catVideos.length === 0) return null;
            const CatIcon = CATEGORY_DOODLE_ICONS[catKey as VideoCategory];
            return (
              <div key={catKey} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 pb-2 border-b-2 border-dashed border-[color-mix(in_srgb,var(--border-ink)_25%,transparent)]">
                  <span className="p-1 rounded-[6px] border border-[var(--line)] bg-[var(--paper)]">
                    <CatIcon size={16} />
                  </span>
                  <h3 className="font-gelica text-lg font-bold text-[var(--ink)]">
                    {catLabel(catKey as VideoCategory)}
                  </h3>
                  <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 font-mono text-[10px] font-bold text-[var(--app-bg)]">{catVideos.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {catVideos.map((video, idx) => (
                    <VideoCardItem
                      key={video.id}
                      video={video}
                      idx={idx}
                      onPlay={() => {
                        playPopSound();
                        setPlayingVideo(video);
                      }}
                      onCategoryChange={(newCat) => {
                        playPopSound();
                        setVideos((prev) =>
                          prev.map((v) => (v.id === video.id ? { ...v, category: newCat } : v))
                        );
                      }}
                      onStatusChange={(newStatus, e) => handleStatusChange(video.id, newStatus, e)}
                      onDelete={(e) => handleDeleteVideo(video.id, e)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVideos.map((video, idx) => (
            <VideoCardItem
              key={video.id}
              video={video}
              idx={idx}
              onPlay={() => {
                playPopSound();
                setPlayingVideo(video);
              }}
              onCategoryChange={(newCat) => {
                playPopSound();
                setVideos((prev) =>
                  prev.map((v) => (v.id === video.id ? { ...v, category: newCat } : v))
                );
              }}
              onStatusChange={(newStatus, e) => handleStatusChange(video.id, newStatus, e)}
              onDelete={(e) => handleDeleteVideo(video.id, e)}
            />
          ))}
        </div>
      )}

      {/* 4. Doğrudan Uygulama İçi YouTube Video Oynatıcı Modalı */}
      <AnimatePresence>
        {playingVideo && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm select-none"
            onClick={() => setPlayingVideo(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl overflow-hidden rounded-[16px] border border-[var(--line-strong)] bg-[var(--app-bg)] shadow-2xl"
            >
              {/* Modal Başlık */}
              <div className="flex items-center justify-between p-4 border-b border-[var(--line)] bg-[var(--paper)]">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[var(--accent)]">#{playingVideo.order}</span>
                  <h3 className="font-gelica text-lg font-semibold lowercase text-[var(--ink)] line-clamp-1">
                    {playingVideo.title}
                  </h3>
                </div>

                <button
                  onClick={() => setPlayingVideo(null)}
                  className="rounded-[20px] p-1.5 text-[var(--ink)] hover:bg-black/5"
                >
                  <X size={16} />
                </button>
              </div>

              {/* YouTube Iframe Embed Oynatıcı */}
              <div className="relative aspect-video w-full bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${playingVideo.videoId}?autoplay=1`}
                  title={playingVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              </div>

              {/* Video Altı Notlar */}
              <div className="p-4 border-t border-[var(--line)] bg-[var(--app-bg)]">
                <span className="font-gelica text-xs font-semibold text-[var(--ink)] block mb-1">
                  {t("yt.notes_extracted")}
                </span>
                <p className="font-geist text-xs text-[var(--ink-soft)] leading-relaxed whitespace-pre-line">
                  {playingVideo.notes || t("yt.no_notes")}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface VideoCardItemProps {
  video: YouTubeVideoItem;
  idx: number;
  onPlay: () => void;
  onCategoryChange: (newCat: VideoCategory) => void;
  onStatusChange: (status: WatchStatus, e?: React.MouseEvent) => void;
  onDelete: (e?: React.MouseEvent) => void;
}

function VideoCardItem({
  video,
  idx,
  onPlay,
  onCategoryChange,
  onStatusChange,
  onDelete,
}: VideoCardItemProps) {
  const { t } = useT();
  const catInfo = VIDEO_CATEGORIES[video.category] || VIDEO_CATEGORIES.personal;

  return (
    <div
      onClick={onPlay}
      style={getCardRotationStyle(video.id)}
      className="card-superr overflow-hidden flex flex-col justify-between group cursor-pointer hover:border-[var(--accent)] transition-all"
    >
      <div>
        {/* Otomatik YouTube Video Kapağı & Oynat Rozeti */}
        <div className="relative aspect-video w-full bg-[var(--ink)] overflow-hidden border-b border-[var(--line)]">
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-white border border-[var(--line-strong)] shadow-lg group-hover:scale-110 transition-transform">
              <Play size={18} className="fill-current ms-0.5" />
            </div>
          </div>

          {/* Sıra Numarası (01, 02...) */}
          <span className="absolute top-2 start-2 rounded-[6px] bg-[var(--ink)] text-[var(--app-bg)] font-mono text-[11px] font-bold px-2 py-0.5 shadow-sm">
            #{idx + 1}
          </span>

          {/* Konu Sınıflandırıcısı Seçimi */}
          <select
            value={video.category}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onCategoryChange(e.target.value as VideoCategory)}
            title={t("yt.change_category")}
            className="absolute top-2 end-2 rounded-[20px] bg-[var(--app-bg)] border border-[var(--line-strong)] px-2.5 py-0.5 font-gelica text-[10px] font-semibold text-[var(--ink)] shadow-sm outline-none cursor-pointer hover:border-[var(--accent)]"
          >
            {Object.entries(VIDEO_CATEGORIES).map(([cKey, cInfo]) => (
              <option key={cKey} value={cKey}>
                {cInfo.icon ? `${cInfo.icon} ` : ""}{t(`yt.cat.${cKey}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Video Bilgileri */}
        <div className="p-4">
          <span className="font-geist text-[11px] text-[var(--ink-soft)] block mb-1">
            {video.channelName}
          </span>
          <h4 className="font-gelica text-base font-semibold lowercase text-[var(--ink)] line-clamp-2 leading-snug">
            {video.title}
          </h4>

          {/* Varsa Alınan Notlar */}
          {video.notes && (
            <div className="mt-3 p-2.5 rounded-[8px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] bg-[var(--paper)] text-xs font-geist text-[var(--ink)] leading-relaxed whitespace-pre-line line-clamp-3">
              {video.notes}
            </div>
          )}
        </div>
      </div>

      {/* Alt Durum Çubuğu & Eylemler */}
      <div className="p-4 pt-2 border-t-2 border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] flex items-center justify-between text-xs">
        {/* Durum Değiştirici: İzlenecek veya İzlendi */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange("to_watch", e);
            }}
            title={t("yt.watch_later")}
            className={`rounded-[20px] px-3 py-1 font-gelica text-[10px] font-semibold transition-all ${
              video.status !== "watched"
                ? "bg-[var(--accent)] text-white border border-[var(--line)] shadow-sm"
                : "border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] text-[var(--ink-soft)] hover:border-[var(--ink)]"
            }`}
          >
            <span className="inline-flex items-center gap-1"><SketchClock size={12} strokeWidth={1.8} /> {t("yt.to_watch")}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onStatusChange("watched", e);
            }}
            title={t("yt.watched")}
            className={`rounded-[20px] px-3 py-1 font-gelica text-[10px] font-semibold transition-all ${
              video.status === "watched"
                ? "bg-[#22c55e] text-white border border-[var(--line)] shadow-sm"
                : "border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] text-[var(--ink-soft)] hover:border-[var(--ink)]"
            }`}
          >
            <span className="inline-flex items-center gap-1"><SketchCheckedBox size={12} strokeWidth={1.8} /> {t("yt.status_watched")}</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const target =
                video.url && /^https?:\/\//i.test(video.url)
                  ? video.url
                  : `https://www.youtube.com/watch?v=${video.videoId}`;
              window.open(target, "_blank", "noopener,noreferrer");
            }}
            title={t("yt.open_youtube")}
            aria-label={t("yt.open_youtube")}
            className="p-1 text-[var(--ink-soft)] hover:text-[var(--accent)] cursor-pointer"
          >
            <ExternalLink size={13} />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onCategoryChange(video.category); }} title={t("act.edit")} aria-label={t("yt.edit_video")} className="p-1 text-[var(--ink-soft)] hover:text-[var(--accent)]">
            <Pencil size={13} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
            }}
            title={t("yt.remove")}
            className="p-1 text-[var(--ink-soft)] hover:text-red-600"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
