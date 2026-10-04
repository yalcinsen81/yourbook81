// YouTube Archive Model & Auto-Categorization Helper
export type VideoCategory = "german" | "english" | "business" | "tech" | "personal";
export type WatchStatus = "to_watch" | "watching" | "watched";

export interface YouTubeVideoItem {
  id: string;
  url: string;
  videoId: string;
  thumbnailUrl: string;
  title: string;
  channelName: string;
  category: VideoCategory;
  status: WatchStatus;
  order: number;
  notes: string;
  tags: string[];
  createdAt: number;
}

export const VIDEO_CATEGORIES: Record<VideoCategory, { name: string; icon: string; badgeClass: string }> = {
  german: { name: "Almanca Dersi", icon: "🇩🇪", badgeClass: "bg-[#0c3b1a]/10 text-[#0c3b1a] border-[#0c3b1a]/30" },
  english: { name: "İngilizce Pratiği", icon: "🇬🇧", badgeClass: "bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30" },
  business: { name: "Work & Projects", icon: "", badgeClass: "bg-[#ff6f1e]/10 text-[#ff6f1e] border-[#ff6f1e]/30" },
  tech: { name: "Yazılım & Teknoloji", icon: "", badgeClass: "bg-[#171717]/10 text-[#171717] border-[#171717]/30" },
  personal: { name: "Kişisel & İlham", icon: "", badgeClass: "bg-[#ff66cf]/10 text-[#ff66cf] border-[#ff66cf]/30" },
};

// YouTube Linkinden Video ID Çıkarıcı (Her formatı destekler: watch, shorts, live, youtu.be, embed, mobil)
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const clean = url.trim();
  // 1. Standart regex: watch?v=, youtu.be/, shorts/, live/, embed/
  const match = clean.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/i);
  if (match && match[1]) return match[1];

  // 2. Doğrudan 11 karakterlik ID yapıştırılmışsa
  const rawMatch = clean.match(/^[\w-]{11}$/);
  if (rawMatch) return rawMatch[0];

  // 3. Genel fallback
  const fallback = clean.match(/[\w-]{11}/);
  return fallback && clean.includes("youtu") ? fallback[0] : null;
}

// Otomatik Konu Sınıflandırma Motoru (Auto-Categorization)
export function autoDetectCategory(titleOrUrl: string): VideoCategory {
  const lower = titleOrUrl.toLowerCase();

  // 1. Almanca anahtar kelimeleri
  if (lower.match(/almanca|deutsch|german|artikel|der die das|grammatik|fiil|verb|a1|a2|b1|b2|c1|c2|dw deutsch|goethe|vokabeln|wortschatz/)) {
    return "german";
  }

  // 2. İngilizce anahtar kelimeleri
  if (lower.match(/ingilizce|english|vocab|vocabulary|pronunciation|grammar|c1|c2|ielts|toefl|idioms|phrasal|bbc learning|englisch|ingles|английский/)) {
    return "english";
  }

  // 3. İş ve İhale anahtar kelimeleri
  if (lower.match(/ihale|proje|teklif|girişimcilik|startup|finance|sales|cost|management|business|project|proposal|tender|arbeit|projekt|geschäft|negocio|проект/)) {
    return "business";
  }

  // 4. Yazılım ve Teknoloji
  if (lower.match(/react|rust|tauri|frontend|kod|code|software|javascript|typescript|css|tasarım|design|ui|ux|web|programming|entwicklung/)) {
    return "tech";
  }

  return "personal";
}

export const SEED_YOUTUBE_VIDEOS: YouTubeVideoItem[] = [
  {
    id: "yt-1",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoId: "dQw4w9WgXcQ",
    thumbnailUrl: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    title: "German A2 Irregular Verbs and Tenses",
    channelName: "Deutsch Lernen Pro",
    category: "german",
    status: "to_watch",
    order: 1,
    notes: "• 03:45 - verbs that take Dativ vs Akkusativ\n• conjugation table for nehmen, geben and sehen",
    tags: ["#German", "#A2", "#Grammar"],
    createdAt: Date.now() - 3600000 * 24,
  },
  {
    id: "ev-yt-2",
    url: "https://www.youtube.com/watch?v=kJQP7kiw5Fk",
    videoId: "kJQP7kiw5Fk",
    thumbnailUrl: "https://img.youtube.com/vi/kJQP7kiw5Fk/hqdefault.jpg",
    title: "Advanced English C1: Serenity & Resilience in Speech",
    channelName: "BBC Learning English",
    category: "english",
    status: "to_watch",
    order: 2,
    notes: "• 05:20 - using varied vocabulary in academic presentations",
    tags: ["#English", "#C1", "#Vocab"],
    createdAt: Date.now() - 3600000 * 12,
  },
  {
    id: "ev-yt-3",
    url: "https://www.youtube.com/watch?v=3JZ_D3ELwOQ",
    videoId: "3JZ_D3ELwOQ",
    thumbnailUrl: "https://img.youtube.com/vi/3JZ_D3ELwOQ/hqdefault.jpg",
    title: "Public Procurement Law and the Unit Price Bid Schedule",
    channelName: "Corporate Tender Guide",
    category: "business",
    status: "watched",
    order: 3,
    notes: "• letter of guarantee validity periods and notary approval requirements",
    tags: ["#Tender", "#Project"],
    createdAt: Date.now(),
  },
  {
    id: "ev-yt-4",
    url: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
    videoId: "M7lc1UVf-VE",
    thumbnailUrl: "https://img.youtube.com/vi/M7lc1UVf-VE/hqdefault.jpg",
    title: "High-Performance Desktop Architecture with Rust & Tauri",
    channelName: "Tech Studio",
    category: "tech",
    status: "to_watch",
    order: 4,
    notes: "• Webview and native-system IPC communication protocols",
    tags: ["#Software", "#Tauri", "#Rust"],
    createdAt: Date.now() - 3600000 * 6,
  },
  {
    id: "ev-yt-5",
    url: "https://www.youtube.com/watch?v=9bZkp7q19f0",
    videoId: "9bZkp7q19f0",
    thumbnailUrl: "https://img.youtube.com/vi/9bZkp7q19f0/hqdefault.jpg",
    title: "Deep Focus and Daily Notebooking Practices",
    channelName: "Mindful Workspace",
    category: "personal",
    status: "watched",
    order: 5,
    notes: "• working free of distractions in the first 2 hours of the day",
    tags: ["#Personal", "#Focus", "#Notebook"],
    createdAt: Date.now() - 3600000 * 2,
  },
];

/* ==========================================================================
   YOUTUBE META VERISI (baslik + kanal adi)
   ---------------------------------------------------------------------------
   SORUN: Eskiden SADECE "noembed.com" (ucuncu taraf proxy) cagriliyordu.
   Bu servis sik sik rate-limit verir / yanit vermez -> catch sessizce yutar ->
   inputTitle/inputChannel bos kalir -> handleAddVideo GENERIC deger yazar:
     title   : "YouTube Video (abc123)"
     kanal   : t("yt.channel") = "YouTube Kanalı"

   COZUM: COK KATMANLI fallback (biri calisirsa yeter):
     1) YouTube'un KENDI oEmbed API'si (birincil, resmi):
        https://www.youtube.com/oembed?url=<url>&format=json
     2) noembed.com (proxy; CORS sorunlarina karsi yedek)
     3) allorigins proxy uzerinden resmi endpoint (ag engeli varsa)
   Ayrica: oEmbed JSON'unda hem "title" hem "author_name" alanlari okunur.
   ========================================================================== */

export interface YouTubeMeta {
  title: string | null;
  channelName: string | null;
  /** Hangi kaynaktan geldigi (teshis icin) */
  source: string | null;
  /** Thumbnail (oEmbed'den ya da dogrudan YouTube CDN'den) */
  thumbnailUrl: string | null;
}

interface OEmbedShape {
  title?: unknown;
  author_name?: unknown;
  thumbnail_url?: unknown;
}

/** Bir oEmbed JSON yanitini guvenli sekilde ayristir. */
function parseOEmbed(data: unknown, source: string): YouTubeMeta | null {
  const o = data as OEmbedShape | null;
  if (!o) return null;
  const title = typeof o.title === "string" && o.title.trim() ? o.title.trim() : null;
  const channelName = typeof o.author_name === "string" && o.author_name.trim() ? o.author_name.trim() : null;
  const thumbnailUrl = typeof o.thumbnail_url === "string" && o.thumbnail_url.trim() ? o.thumbnail_url.trim() : null;
  // En az baslik VEYA kanal gelmisse kabul et
  if (!title && !channelName) return null;
  return { title: title, channelName: channelName, thumbnailUrl: thumbnailUrl, source: source };
}

/** Belirli bir URL'den JSON cek (timeout'lu). */
async function fetchJson(url: string, timeoutMs = 6000): Promise<unknown | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim().startsWith("<")) return null; // HTML hata sayfasi
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * YouTube videosunun basligini ve kanal adini getirir.
 * BIRINCIL: resmi YouTube oEmbed API. Yedekler: noembed, allorigins proxy.
 * Hicbiri calismazsa { title:null, channelName:null } doner (cagiran taraf
 * generic degere dusebilir).
 */
export async function fetchYouTubeMeta(videoId: string, originalUrl?: string): Promise<YouTubeMeta> {
  const empty: YouTubeMeta = { title: null, channelName: null, source: null, thumbnailUrl: null };
  if (!videoId) return empty;

  const watchUrl = originalUrl && originalUrl.startsWith("http")
    ? originalUrl
    : "https://www.youtube.com/watch?v=" + videoId;
  const enc = encodeURIComponent(watchUrl);

  // 1) RESMI YouTube oEmbed (birincil kaynak)
  const ytOembed = "https://www.youtube.com/oembed?url=" + enc + "&format=json";
  const r1 = parseOEmbed(await fetchJson(ytOembed), "youtube-oembed");
  if (r1) return r1;

  // 2) noembed.com (proxy - CORS dostu)
  const r2 = parseOEmbed(await fetchJson("https://noembed.com/embed?url=" + enc), "noembed");
  if (r2) return r2;

  // 3) resmi endpoint'e proxy uzerinden eris (ag/CORS engeli varsa)
  const r3 = parseOEmbed(
    await fetchJson("https://api.allorigins.win/raw?url=" + encodeURIComponent(ytOembed)),
    "allorigins->youtube-oembed"
  );
  if (r3) return r3;

  // 4) Hicbiri olmadi: en azindan thumbnail'i CDN'den uret
  return { title: null, channelName: null, source: null, thumbnailUrl: "https://img.youtube.com/vi/" + videoId + "/hqdefault.jpg" };
}
