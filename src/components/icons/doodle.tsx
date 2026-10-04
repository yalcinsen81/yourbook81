/**
 * Hand-drawn ("doodle") kroki tarzı ikon seti.
 * Tüm ikonlar tutarlı, stroke-tabanlı, organik/hafif düzensiz çizgili
 * (sketchy) bir defter çizimi stiline sahiptir.
 * currentColor kullanarak temanın --ink veya vurgu rengine uyum sağlar.
 */
import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({
  size = 16,
  className = "",
  children,
  viewBox = "0 0 24 24",
  strokeWidth = 2.3,
  ...rest
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      {children}
    </svg>
  );
}

/* --- Navigasyon & Bölümler (Felt-Pen El Çizimi Stili) --- */

// Defter / Yer imi / Kitap (Felt-Pen El Çizimi)
export const DBook = (p: IconProps) => (
  <Svg strokeWidth={2.1} {...p}>
    <path d="M3.8 19c2.8-1.4 5.6-1.1 8.2 0 2.6-1.1 5.4-1.4 8.2 0V5.2c-2.8-1.4-5.6-1.1-8.2 0-2.6-1.1-5.4-1.4-8.2 0v13.8Z" />
    <path d="M12 5.2v14" />
    <path d="M6.2 8.8c1.5-.3 3.5-.2 4.2.2" strokeWidth={1.5} />
    <path d="M6.2 12.5c1.8-.3 3.2-.1 4.2.2" strokeWidth={1.5} />
    <path d="M13.6 8.8c1.4-.4 3.2-.3 4.2.2" strokeWidth={1.5} />
  </Svg>
);

// Tüm notlar / Klasör (Felt-Pen El Çizimi)
export const DFolder = (p: IconProps) => (
  <Svg strokeWidth={2.1} {...p}>
    <path d="M3.2 6.8c0-.9.8-1.6 1.8-1.6h3.8c.8 0 1.5.5 1.9 1.2l.6 1.1h7.9c.9 0 1.8.8 1.8 1.8v1.2H3.2V6.8Z" />
    <path d="M3 10.5c0-.4.3-.8 1-.8h16.2c.7 0 1.2.4 1 1.1l-1.6 7.6c-.2.9-.9 1.6-1.8 1.6H5.2c-.9 0-1.6-.7-1.8-1.6L3 10.5Z" />
    <path d="M7.5 15c2.2-.4 4.8-.3 6.5.2" strokeWidth={1.5} />
  </Svg>
);

// Kelime masaları / Kart yığını (Felt-Pen El Çizimi)
export const DLayers = (p: IconProps) => (
  <Svg strokeWidth={2.1} {...p}>
    <path d="M12 2.8l8.6 4.4c.6.3.6 1 0 1.3L12 12.8c-.6.3-1.4.3-2 0L1.4 8.5c-.6-.3-.6-1 0-1.3L10 2.8c.6-.3 1.4-.3 2 0Z" />
    <path d="M2.5 12.2l8.8 4.4c.5.2 1.5.2 2 0l8.2-4.4" strokeWidth={2} />
    <path d="M2.5 16.5l8.8 4.4c.5.2 1.5.2 2 0l8.2-4.4" strokeWidth={2} />
  </Svg>
);

// Yapışkan not / Memo (Felt-Pen El Çizimi)
export const DNote = (p: IconProps) => (
  <Svg strokeWidth={2.1} {...p}>
    <path d="M4 4.5c0-.8.7-1.4 1.6-1.4H18c.8 0 1.5.6 1.5 1.4v10.6l-5.2 5H5.6c-.9 0-1.6-.7-1.6-1.6V4.5Z" />
    <path d="M14.2 15.2v4.8l5.2-4.8h-5.2Z" strokeWidth={1.8} />
    <path d="M7.5 8c2.4-.4 5.8-.3 8 .2" strokeWidth={1.5} />
    <path d="M7.5 11.8c1.8-.3 4-.2 6 .2" strokeWidth={1.5} />
  </Svg>
);

// Takvim (Felt-Pen El Çizimi)
export const DCalendar = (p: IconProps) => (
  <Svg strokeWidth={2.1} {...p}>
    <path d="M7.5 2.2v3.2M16.5 2.2v3.2" strokeWidth={2.2} />
    <path d="M3.8 5.8c0-.9.8-1.6 1.8-1.6h12.8c1 0 1.8.7 1.8 1.6v13.5c0 1-.8 1.7-1.8 1.7H5.6c-1 0-1.8-.7-1.8-1.7V5.8Z" />
    <path d="M3.8 9.5c4.5-.3 12-.3 16.4 0" strokeWidth={1.6} />
    <circle cx="8" cy="13.2" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="13.2" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="13.2" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="8" cy="16.8" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="16.8" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="16.8" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
);

// Günlük notlar / Ajanda çizelgesi (Felt-Pen El Çizimi)
export const DCalendarDays = (p: IconProps) => (
  <Svg strokeWidth={2.1} {...p}>
    <path d="M7.5 2.2v3.2M12 2.2v3.2M16.5 2.2v3.2" strokeWidth={2.2} />
    <path d="M4.2 5.5c0-.9.8-1.6 1.8-1.6h12c1 0 1.8.7 1.8 1.6v13.8c0 1-.8 1.7-1.8 1.7H6c-1 0-1.8-.7-1.8-1.7V5.5Z" />
    <path d="M4.2 9c4.2-.3 11.4-.3 15.6 0" strokeWidth={1.6} />
    <path d="M7 13.8l2 2 3.8-4" strokeWidth={2} />
    <path d="M14 14h2.5" strokeWidth={1.6} />
    <path d="M7.5 17.5h8.5" strokeWidth={1.6} />
  </Svg>
);

// İş & projeler / Evrak çantası (Felt-Pen El Çizimi)
export const DBriefcase = (p: IconProps) => (
  <Svg strokeWidth={2.1} {...p}>
    <path d="M8.5 6.5V4.6c0-1 .8-1.8 1.8-1.8h3.4c1 0 1.8.8 1.8 1.8v1.9" strokeWidth={2} />
    <path d="M3.5 8c0-1 .8-1.8 1.8-1.8h13.4c1 0 1.8.8 1.8 1.8v11c0 1-.8 1.8-1.8 1.8H5.3c-1 0-1.8-.8-1.8-1.8V8Z" />
    <path d="M3.5 12.2c4.5-.3 12.5-.3 17 0" strokeWidth={1.6} />
    <rect x="10.5" y="11" width="3" height="3" rx="0.8" strokeWidth={1.6} fill="none" />
  </Svg>
);

// Giriş (Felt-Pen El Çizimi)
/* --- Aksiyonlar & Çizgiler --- */

// Ekle (+ çizimi)
export const DPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4.5v15" strokeWidth={2} />
    <path d="M4.5 12h15" strokeWidth={2} />
  </Svg>
);

// Onay / Tik
export const DCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 12.5l5 5 10-11" strokeWidth={2.2} />
  </Svg>
);

// Görev tik dairesi
export const DCheckCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.2l2.8 2.8 5.4-5.5" strokeWidth={2} />
  </Svg>
);

// Boş daire
export const DCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.8" />
  </Svg>
);

// Çarpı / Kapat
export const DX = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.5 5.5l13 13" strokeWidth={2} />
    <path d="M18.5 5.5l-13 13" strokeWidth={2} />
  </Svg>
);

// Çöp kutusu
export const DTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 6.5h15" />
    <path d="M9.5 3.5h5c.5 0 1 .4 1 1v2h-7v-2c0-.6.5-1 1-1Z" />
    <path d="M6 6.5l1.2 13.2c.1.9.8 1.6 1.7 1.6h6.2c.9 0 1.6-.7 1.7-1.6L18 6.5" />
    <path d="M10 10.5v6.5" strokeWidth={1.3} />
    <path d="M14 10.5v6.5" strokeWidth={1.3} />
  </Svg>
);

// Pin / Raptiye
export const DPin = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15.5 3.5l5 5-2.2 2.2-1.3-.3-3.6 3.6.3 3.8-1.8 1.8-4.8-4.8-4.8 4.8-1.4-1.4 4.8-4.8-4.8-4.8 1.8-1.8 3.8.3 3.6-3.6-.3-1.3 2.2-2.2Z" />
    <path d="M9 15l-6 6" strokeWidth={2} />
  </Svg>
);

// Arama büyüteci
export const DSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6.8" />
    <path d="M15.5 15.5l5 5" strokeWidth={2.2} />
  </Svg>
);

// Sıfırla / Tekrar
export const DRefresh = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 12a8.5 8.5 0 0 1 14.5-6l2 2" />
    <path d="M20 3.5v4.5h-4.5" />
    <path d="M20.5 12a8.5 8.5 0 0 1-14.5 6l-2-2" />
    <path d="M4 20.5v-4.5h4.5" />
  </Svg>
);

// Ataç / Kopyala
export const DCopy = (p: IconProps) => (
  <Svg {...p}>
    <path d="M16.5 6.5l-7.8 7.8a3 3 0 0 0 4.2 4.2l7.8-7.8a5 5 0 0 0-7-7L6 11.5a7 7 0 0 0 9.8 9.8l6.2-6.3" />
  </Svg>
);

// İndir
export const DDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5v12m0 0l-4.5-4.5m4.5 4.5l4.5-4.5" />
    <path d="M4.5 19.5h15" />
  </Svg>
);

// Yükle
export const DUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 16.5V4m0 0L7.5 8.5M12 4l4.5 4.5" />
    <path d="M4.5 19.5h15" />
  </Svg>
);

// Gönder / Uçak
/* --- Oklar --- */

export const DArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 12h14.5" strokeWidth={2} />
    <path d="M13.5 6.5l5.5 5.5-5.5 5.5" strokeWidth={2} />
  </Svg>
);

export const DChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.5 6.5l-5.5 5.5 5.5 5.5" strokeWidth={2} />
  </Svg>
);

export const DChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 6.5l5.5 5.5-5.5 5.5" strokeWidth={2} />
  </Svg>
);

export const DChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6.5 9.5l5.5 5.5 5.5-5.5" strokeWidth={2} />
  </Svg>
);

/* --- Medya & Ses --- */

// Hoparlör
export const DVolume = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 9.5h3.8l4.8-4.2c.6-.5 1.5-.1 1.5.8v11.8c0 .9-.9 1.3-1.5.8l-4.8-4.2H3.5c-.6 0-1-.5-1-1v-3.2c0-.6.4-1 1-1Z" />
    <path d="M17 8.5c1.2 1 2 2.2 2 3.5s-.8 2.5-2 3.5" />
    <path d="M19.5 5.5c2.2 1.8 3.5 4 3.5 6.5s-1.3 4.7-3.5 6.5" />
  </Svg>
);

// Sessiz
export const DVolumeMute = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 9.5h3.8l4.8-4.2c.6-.5 1.5-.1 1.5.8v11.8c0 .9-.9 1.3-1.5.8l-4.8-4.2H3.5c-.6 0-1-.5-1-1v-3.2c0-.6.4-1 1-1Z" />
    <path d="M17 10l5 5" />
    <path d="M22 10l-5 5" />
  </Svg>
);

// Fotoğraf
export const DImage = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="8.5" cy="9" r="1.5" />
    <path d="M20.5 15.5l-5-5-4 4-2-2-6 6" />
  </Svg>
);

// Oynat
export const DPlay = (p: IconProps) => (
  <Svg {...p}>
    <polygon points="6 4.5 19 12 6 19.5 6 4.5" strokeWidth={1.8} />
  </Svg>
);

// Video
export const DVideo = (p: IconProps) => (
  <Svg strokeWidth={2.1} {...p}>
    <rect x="2.5" y="6" width="13.6" height="12" rx="2.5" />
    <path d="M16.1 10.2l4.8-3.2v10l-4.8-3.2z" strokeWidth={2} />
    <circle cx="9.3" cy="12" r="2.2" strokeWidth={1.6} />
  </Svg>
);

// Dış bağlantı
export const DLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4.5h5.5V10" />
    <path d="M19.5 4.5l-9.5 9.5" />
    <path d="M17 13.5v5c0 .6-.5 1.1-1.1 1.1H5.6c-.6 0-1.1-.5-1.1-1.1V8.1c0-.6.5-1.1 1.1-1.1h5" />
  </Svg>
);

// Web / Küre
export const DGlobe = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3.5 12h17" />
    <path d="M12 3a13 13 0 0 1 3.5 9 13 13 0 0 1-3.5 9 13 13 0 0 1-3.5-9 13 13 0 0 1 3.5-9Z" />
  </Svg>
);

/* --- Durum & Zaman --- */

// Saat
export const DClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9.2" />
    <path d="M12 6.8v5.5l3.6 2" />
  </Svg>
);

// Zil / Hatırlatıcı
export const DBell = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 16.5c-1-1-2-2.5-2-6.5a4 4 0 0 0-8 0c0 4-1 5.5-2 6.5h12Z" />
    <path d="M10 19.5a2 2 0 0 0 4 0" />
    <path d="M12 2.5v1.5" />
  </Svg>
);

export const DBellRing = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 16.5c-1-1-2-2.5-2-6.5a4 4 0 0 0-8 0c0 4-1 5.5-2 6.5h12Z" />
    <path d="M10 19.5a2 2 0 0 0 4 0" />
    <path d="M12 2.5v1.5" />
    <path d="M4 4c-.8.8-1.5 2-1.5 3.5M20 4c.8.8 1.5 2 1.5 3.5" strokeWidth={1.5} />
  </Svg>
);

export const DBellOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 16.5c-1-1-2-2.5-2-6.5a4 4 0 0 0-8 0c0 4-1 5.5-2 6.5h12Z" />
    <path d="M10 19.5a2 2 0 0 0 4 0" />
    <path d="M3.5 3.5l17 17" strokeWidth={2} />
  </Svg>
);

// Uyarı
export const DAlert = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5" strokeWidth={2} />
    <circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none" />
  </Svg>
);

// Etiket
export const DTag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 12.5V4.5h8l9 9-8 8-9-9Z" />
    <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
  </Svg>
);

/* --- İnsanlar & İletişim --- */

export const DUser = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="7.5" r="4" />
    <path d="M4.5 20.5c0-3.5 3.3-6.5 7.5-6.5s7.5 3 7.5 6.5" />
  </Svg>
);

export const DUsers = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 19.5c0-3 2.9-5.5 6.5-5.5s6.5 2.5 6.5 5.5" />
    <path d="M15.5 4.5a3.5 3.5 0 0 1 0 7" />
    <path d="M17.5 14.5c2.5.5 4 2.2 4 5" />
  </Svg>
);

export const DPhone = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  </Svg>
);

export const DMail = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="M4 6.5l8 6.5 8-6.5" />
  </Svg>
);

/* --- Dekor & Rozetler --- */

// Sihir / Parıltı
export const DSparkles = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.5c.3 4 1.5 5.2 5.5 5.5-4 .3-5.2 1.5-5.5 5.5-.3-4-1.5-5.2-5.5-5.5 4-.3 5.2-1.5 5.5-5.5Z" />
    <path d="M18.5 15c.2 2 .8 2.6 2.5 2.8-1.7.2-2.3.8-2.5 2.8-.2-2-.8-2.6-2.5-2.8 1.7-.2 2.3-.8 2.5-2.8Z" strokeWidth={1.4} />
  </Svg>
);

// Ampul / Fikir
export const DLighbulb = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 17.5h6" />
    <path d="M10 20.5h4" />
    <path d="M12 3a6.5 6.5 0 0 0-4.5 11.2c.9.9 1.5 2.1 1.5 3.3h6c0-1.2.6-2.4 1.5-3.3A6.5 6.5 0 0 0 12 3Z" />
  </Svg>
);

// Kahve fincanı
export const DCoffee = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 8.5h12v7a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4v-7Z" />
    <path d="M15.5 10.5h2a2.5 2.5 0 0 1 0 5h-2" />
    <path d="M6 3.5v2M9.5 3.5v2M13 3.5v2" strokeWidth={1.3} />
  </Svg>
);

export const DBox = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5l8 4.5v8l-8 4.5-8-4.5v-8l8-4.5Z" />
    <path d="M12 12.5v8M12 12.5l8-4.5M12 12.5l-8-4.5" />
  </Svg>
);

export const DSticker = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14.5 4.5l5 5-9.5 9.5H5v-5l9.5-9.5Z" />
    <path d="M12.5 6.5l5 5" />
  </Svg>
);

export const DEdit = DSticker;

/* --- Inspector (Geliştirici Araçları) --- */

export const DWand = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20l10-10" strokeWidth={2.2} />
    <path d="M13.5 5.5l1.5-1.5a1.4 1.4 0 0 1 2 2l-1.5 1.5" />
    <path d="M18 2.5v2M20 8h2M7 14l-4 4" strokeWidth={1.4} />
  </Svg>
);

export const DCrosshair = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    <circle cx="12" cy="12" r="2" fill="currentColor" />
  </Svg>
);

export const DEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

export const DEyeOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12s3.5-7 9.5-7c2.2 0 4.1.9 5.7 2.2M21.5 12s-3.5 7-9.5 7c-2.3 0-4.3-.9-5.9-2.3" />
    <path d="M10 10a3 3 0 0 0 4 4" />
    <path d="M3.5 3.5l17 17" strokeWidth={2} />
  </Svg>
);


/* --- Konu & Kategori El Çizimi Piktogramları (Emoji Yerine) --- */

// Almanca Dersi Piktogramı (Sketchy DE Bayrak & Harf Arması)
export const DTopicGerman = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5.5h16v13H4z" strokeWidth={1.8} rx="2" />
    <path d="M4 9.8h16" strokeWidth={1.4} strokeDasharray="1.5 1.5" />
    <path d="M4 14.2h16" strokeWidth={1.4} />
    <path d="M8.5 7.5v2.8" strokeWidth={1.5} />
    <path d="M12 7.5v2.8" strokeWidth={1.5} />
  </Svg>
);

// İngilizce Pratiği Piktogramı (Sketchy Konuşma Balonu & EN)
export const DTopicEnglish = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 11.5c0-4.4 3.8-8 8.5-8s8.5 3.6 8.5 8-3.8 8-8.5 8c-1.4 0-2.8-.3-4-.9L4 19.5l1-3.6c-1-1.3-1.5-2.8-1.5-4.4Z" />
    <path d="M8.5 11.5h7" strokeWidth={1.6} />
    <path d="M10 9h4" strokeWidth={1.3} />
    <path d="M10 14h4" strokeWidth={1.3} />
  </Svg>
);

// İş, İhale & Proje Piktogramı (Doodle Evrak Çantası / Proje Dosyası)
export const DTopicBiz = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="7" width="17" height="13" rx="2.5" />
    <path d="M8.5 7V5.2c0-.9.7-1.7 1.7-1.7h3.6c.9 0 1.7.8 1.7 1.7V7" />
    <path d="M3.5 12h17" strokeWidth={1.4} />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </Svg>
);

// Yazılım & Teknoloji Piktogramı (Doodle Kod Ekranı < / >)
export const DTopicCode = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4.5" width="18" height="13.5" rx="2.5" />
    <path d="M8 9.5l-2.5 2 2.5 2" strokeWidth={1.8} />
    <path d="M16 9.5l2.5 2-2.5 2" strokeWidth={1.8} />
    <path d="M13 8.5l-2 6" strokeWidth={1.6} />
    <path d="M8 20.5h8" strokeWidth={1.8} />
    <path d="M12 18v2.5" strokeWidth={1.8} />
  </Svg>
);

// Kişisel & İlham Piktogramı (Doodle Ampul & Sıcak Işıltı)
export const DTopicLife = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 14.5c-1.8-1.2-3-3.2-3-5.5 0-3.6 2.7-6.5 6-6.5s6 2.9 6 6.5c0 2.3-1.2 4.3-3 5.5v2H9v-2Z" />
    <path d="M10 18.5h4" strokeWidth={1.5} />
    <path d="M11 21h2" strokeWidth={1.5} />
    <path d="M12 6.5v3" strokeWidth={1.5} />
    <path d="M4 9h1.5M18.5 9H20" strokeWidth={1.4} />
  </Svg>
);

// Sıcak Kahve / Çay Fincanı Piktogramı (Kişisel Notlar İçin)
export const DTopicCoffee = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8.5h12.5v7c0 2.8-2.2 5-5 5H9c-2.8 0-5-2.2-5-5v-7Z" />
    <path d="M16.5 10.5h2.2c1.2 0 2.3 1 2.3 2.3s-1.1 2.2-2.3 2.2h-2.2" />
    {/* Sıcak buhar dalgaları */}
    <path d="M7 4.5c.5.8 0 1.5.5 2.2M10.5 4c.5.8 0 1.5.5 2.2M14 4.5c.5.8 0 1.5.5 2.2" strokeWidth={1.3} />
  </Svg>
);

// Hızlı Aksiyon & Teslim Piktogramı (Doodle Şimşek)
export const DTopicAction = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 2.5L5.5 13h5l-1 8.5L18.5 11h-5.5l1-8.5Z" strokeWidth={1.9} />
  </Svg>
);

/* --- 'İş ve Projeler' İçin Özel Felt-Pen Piktogram Seti --- */

// 1. Fikirler: Organik Felt-Pen Ampul & Çizim Işınları
export const DFeltIdea = (p: IconProps) => (
  <Svg strokeWidth={2.1} {...p}>
    <path d="M8.8 14.2C7 13 5.8 11 5.8 8.8c0-3.4 2.8-6.2 6.2-6.2s6.2 2.8 6.2 6.2c0 2.2-1.2 4.2-3 5.4v2.2H8.8v-2.2Z" />
    <path d="M9.8 18.5h4.4" strokeWidth={1.8} />
    <path d="M10.8 21h2.4" strokeWidth={1.8} />
    <path d="M11 6.5c.5-.8 1.5-.8 2 0" strokeWidth={1.6} />
    <path d="M3.2 8.8h1.8M19 8.8h1.8" strokeWidth={1.8} />
    <path d="M5.5 3.5l1.4 1.4M17.1 4.9l1.4-1.4" strokeWidth={1.6} />
  </Svg>
);

// 2. Aksiyonlar: Organik Felt-Pen Zikzak Şimşek
export const DFeltAction = (p: IconProps) => (
  <Svg strokeWidth={2.1} {...p}>
    <path d="M13.2 2.5L5.8 12.8h5.6l-1.4 8.7L18.4 11h-5.8l1.6-8.5Z" strokeWidth={2.1} />
  </Svg>
);

// 3. Network: Organik Felt-Pen İki Kişi / Ortaklık
export const DFeltNetwork = (p: IconProps) => (
  <Svg strokeWidth={2.1} {...p}>
    <circle cx="8.5" cy="7" r="3.2" />
    <path d="M3 18.5c0-2.8 2.5-5 5.5-5s5.5 2.2 5.5 5" />
    <circle cx="16.5" cy="8" r="2.6" strokeWidth={1.8} />
    <path d="M14 18.5c.2-2 1.8-3.6 4-3.6 1.8 0 3.2 1.1 3.8 2.6" strokeWidth={1.8} />
  </Svg>
);

// 4. Kişisel: Organik Felt-Pen Kahve / Çay Fincanı
export const DFeltPersonal = (p: IconProps) => (
  <Svg strokeWidth={2.1} {...p}>
    <path d="M4 8.5h12.5v7c0 2.8-2.2 5-5 5H9c-2.8 0-5-2.2-5-5v-7Z" />
    <path d="M16.5 10.5h2.2c1.2 0 2.3 1 2.3 2.3s-1.1 2.2-2.3 2.2h-2.2" />
    <path d="M7 4.2c.5.8 0 1.5.5 2.2M10.5 3.8c.5.8 0 1.5.5 2.2M14 4.2c.5.8 0 1.5.5 2.2" strokeWidth={1.4} />
  </Svg>
);


/* --- Dil Bayrağı Piktogramları (Tüm UI Dilleri — Emoji Yerine, %100 SVG) ---
 * `DTopicGerman` / `DTopicEnglish` ile AYNI çizim stili (sketchy çerçeve + gramer işaretleri).
 * Amaç: ES/FR/IT/AR/TR masaları da artık emoji bayrağı yerine bu SVG'leri kullanır.
 */

// Türkçe Piktogramı (Sketchy Bayrak & Harf Arması)
export const DTopicTurkish = (p: IconProps) => (
 <Svg {...p}>
    <path d="M4 5.5h16v13H4z" rx="2" strokeWidth={1.8} />
    <circle cx="10.4" cy="12" r="3.4" strokeWidth={1.5} />
    <circle cx="11.6" cy="12" r="2.6" strokeWidth={1.4} />
    <path d="M16.6 9.4l.6 1.9 1.9.2-1.5 1.2.5 1.9-1.5-1.1-1.5 1.1.5-1.9-1.5-1.2 1.9-.2Z" strokeWidth={1.2} />
 </Svg>
);

// İspanyolca Piktogramı (Sketchy Bayrak & Harf Arması)
export const DTopicSpanish = (p: IconProps) => (
 <Svg {...p}>
    <path d="M4 5.5h16v13H4z" rx="2" strokeWidth={1.8} />
    <path d="M4 8.6h16" strokeWidth={1.4} />
    <path d="M4 15.4h16" strokeWidth={1.4} />
    <path d="M9 11.2v1.6M12 11.2v1.6" strokeWidth={1.5} />
    <path d="M10 14.4c1.3.7 2.7.7 4 0" strokeWidth={1.3} />
 </Svg>
);

// Fransızca Piktogramı (Sketchy Bayrak & Harf Arması)
export const DTopicFrench = (p: IconProps) => (
 <Svg {...p}>
    <path d="M4 5.5h16v13H4z" rx="2" strokeWidth={1.8} />
    <path d="M9.4 5.5v13M14.6 5.5v13" strokeWidth={1.4} />
    <path d="M6.5 11.6h1.4M11.2 11.6h1.4" strokeWidth={1.5} />
    <path d="M16 11.6h1.2" strokeWidth={1.4} />
 </Svg>
);

// İtalyanca Piktogramı (Sketchy Bayrak & Harf Arması)
export const DTopicItalian = (p: IconProps) => (
 <Svg {...p}>
    <path d="M4 5.5h16v13H4z" rx="2" strokeWidth={1.8} />
    <path d="M9.4 5.5v13M14.6 5.5v13" strokeWidth={1.4} />
    <path d="M11.2 10.6v2.6" strokeWidth={1.4} />
    <path d="M16 10.6l-1.2 2.8" strokeWidth={1.3} />
 </Svg>
);

// Arapça Piktogramı (Sketchy Bayrak & Hilal Arması)
export const DTopicArabic = (p: IconProps) => (
 <Svg {...p}>
    <path d="M4 5.5h16v13H4z" rx="2" strokeWidth={1.8} />
    <path d="M12.2 8.4l.8 1.4-1.6.3.6 1.3-1.5-.2.4 1.4-1.4-.7" strokeWidth={1.3} />
    <circle cx="10.4" cy="11.6" r="3.1" strokeWidth={1.5} />
    <circle cx="11.7" cy="11.6" r="2.3" strokeWidth={1.4} />
 </Svg>
);

/**
 * Hedef dil etiketine göre sketchy SVG konu ikonu döndür (emoji yerine).
 * DE/EN/ES/FR/IT/AR/TR desteklenir; bilinmeyen etiketlerde nötr not ikonu döner.
 */
export function spaceTopicIcon(langTag: string | null | undefined) {
  switch ((langTag || "").toUpperCase()) {
    case "DE":
      return DTopicGerman;
    case "EN":
      return DTopicEnglish;
    case "ES":
      return DTopicSpanish;
    case "FR":
      return DTopicFrench;
    case "IT":
      return DTopicItalian;
    case "AR":
      return DTopicArabic;
    case "TR":
      return DTopicTurkish;
    case "MEMO":
      return DBriefcase;
    case "BRIEFCASE":
      return DBriefcase;
    case "PERSONAL":
      return DFeltPersonal;
    default:
      return DNote;
  }
}
