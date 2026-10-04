import React from "react";

export interface SketchIconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

const defaultProps = {
  size: 20,
  className: "",
  strokeWidth: 1.75,
};

/* =========================================================================
   1. GENEL ARAÇLAR, MENÜ VE NAVİGASYON İKONLARI
   ========================================================================= */

/** Sevgili Günlük: Kağıt üzerine yazan dolmakalem / yazı tüyü */
export function SketchJournalPen({ size = 20, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17.5 3.5l3 3L8 19l-4.5 1.5 1.5-4.5L17.5 3.5z" />
      <path d="M15 6l3 3" strokeWidth={strokeWidth * 0.9} />
      <path d="M4.5 20.5c1.5-.5 3-1.8 4-2.8" strokeWidth={strokeWidth * 0.8} />
      <path d="M2.5 22.5c2.5-1 4.5-.5 6.5.5" strokeWidth={strokeWidth * 0.8} />
    </svg>
  );
}

/** Kağıt & El Yazısı Özelleştir: Ressam paleti & fırça */
export function SketchPalette({ size = 20, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3.5c-4.8 0-8.5 3.6-8.5 8 0 4.2 3.4 7 7.5 7 1.2 0 2.2-.8 2.2-1.8 0-.5-.2-1-.2-1.5 0-.8.7-1.5 1.5-1.5h1.5c3.2 0 5-2.2 5-5.2 0-4.4-4-8-9-8z" />
      <circle cx="8" cy="8.5" r="1.1" fill="currentColor" />
      <circle cx="12" cy="7.2" r="1.1" fill="currentColor" />
      <circle cx="16" cy="9.2" r="1.1" fill="currentColor" />
      <circle cx="8.5" cy="13" r="1.1" fill="currentColor" />
    </svg>
  );
}

/** Ayarlar / Saat Ayarla Dişlisi */
export function SketchGear({ size = 18, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M5.2 18.8l1.6-1.6M17.2 6.8l1.6-1.6" />
    </svg>
  );
}

/** Kapatma Çarpısı (Hand-drawn cross) */
export function SketchClose({ size = 16, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

/** Hediye Kutusu */
export function SketchGift({ size = 20, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4.5 10.5v8.2c0 .8.6 1.5 1.5 1.5h12c.8 0 1.5-.7 1.5-1.5v-8.2" />
      <path d="M3.2 8.2c0-.6.5-1 1-1h15.6c.6 0 1 .4 1 1v2.3h-17.6V8.2z" />
      <path d="M12 7.2v13" strokeWidth={strokeWidth * 0.9} />
      <path d="M12 7.2c-1.8-1.5-3.8-3.2-4.5-2.2-.8 1.1.8 2.5 4.5 2.2z" strokeWidth={strokeWidth * 0.9} />
      <path d="M12 7.2c1.8-1.5 3.8-3.2 4.5-2.2.8 1.1-.8 2.5-4.5 2.2z" strokeWidth={strokeWidth * 0.9} />
    </svg>
  );
}

/* =========================================================================
   2. AÇILIŞ RİTÜELİ VE ZAMAN DİLİMİ İKONLARI
   ========================================================================= */

/** Sabah: Ufuktan doğan yumuşak gün doğumu */
export function SketchSunRising({ size = 22, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 17.5h18M5 21h14" />
      <path d="M7 17.5a5 5 0 0 1 10 0" />
      <path d="M12 5.5v3.2M5.2 8.5l2.2 2.2M18.8 8.5l-2.2 2.2M2 13h3M19 13h3" />
    </svg>
  );
}

/** Gün Ortası: Parlayan güneş */
export function SketchSunBright({ size = 22, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12h2.5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" />
    </svg>
  );
}

/** İkindi: Tepelerin ardına batan ılık altın güneş */
export function SketchSunSetting({ size = 22, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 18h18M6 21.5h12" />
      <path d="M7.5 18a4.5 4.5 0 0 1 9 0" />
      <path d="M12 9v3.5M7 12l2 2M17 12l-2 2" strokeWidth={strokeWidth * 0.9} />
      <path d="M12 3.5l1.5 2M12 3.5l-1.5 2" strokeWidth={strokeWidth * 0.9} />
    </svg>
  );
}

/** Gece: Hilal ve minik yıldız */
export function SketchMoon({ size = 22, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19.2 14.8c-.8.2-1.6.3-2.5.3-4.8 0-8.7-3.9-8.7-8.7 0-1.4.3-2.7.9-3.9-3.5 1.3-6 4.7-6 8.7 0 5.2 4.2 9.4 9.4 9.4 4.1 0 7.6-2.6 8.9-6.2-.7.2-1.4.4-2 .4z" />
      <path d="M17.5 5.5v2.5M16.2 6.8h2.6" strokeWidth={strokeWidth * 0.8} />
    </svg>
  );
}

/** Gece Lambası / Mum */
/* =========================================================================
   3. KELİME MASALARI, KELİME DURUMU VE KELİME AVI İKONLARI
   ========================================================================= */

/** Kelime Durumu Etiketi */
export function SketchTag({ size = 20, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3.5 12.5l8.5 8.5 9-9V3.5h-8.5L3.5 12.5z" />
      <circle cx="16.5" cy="7.5" r="1.3" fill="currentColor" />
    </svg>
  );
}

/** Yeni Kelimeler: Açık kutu / kart paketi */
export function SketchBox({ size = 20, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 8.5L12 4l8 4.5-8 4.5L4 8.5z" />
      <path d="M4 8.5v7.5L12 20.5v-8" />
      <path d="M20 8.5v7.5L12 20.5" />
      <path d="M7.5 10.5l4.5 2.5" strokeWidth={strokeWidth * 0.8} />
    </svg>
  );
}

/** Tekrarı Bekleyen: Ok ve hedef */
export function SketchTarget({ size = 20, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.8" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <path d="M17.5 6.5l3.8-3.8M18.8 2.7l2.5 2.5" strokeWidth={strokeWidth * 0.9} />
    </svg>
  );
}

/** Öğrenilen Kelimeler: Kalemle atılmış tik */
/** Kelime Avı Oyna: Gerilmiş yay ve ok */
export function SketchBow({ size = 20, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Yay */}
      <path d="M5.5 3.5C11.5 5 15.5 9 17 15l-1.5 1.5C14 11 10 7 4 5.5l1.5-2z" />
      {/* Kiriş */}
      <path d="M5.5 3.5L15.5 16.5" strokeWidth={strokeWidth * 0.85} strokeDasharray="3 2" />
      {/* Ok */}
      <path d="M3.5 20.5l10-10M13.5 10.5l-1.5 4M13.5 10.5l4-1.5M19 5l-2.5 2.5" />
    </svg>
  );
}

/** Kupa / Başarı */
export function SketchTrophy({ size = 22, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 4.5h12v5c0 3.3-2.7 6-6 6s-6-2.7-6-6v-5z" />
      <path d="M6 6.5H3.5c-.8 0-1.5.7-1.5 1.5 0 2.2 1.8 4 4 4h0" />
      <path d="M18 6.5h2.5c.8 0 1.5.7 1.5 1.5 0 2.2-1.8 4-4 4h0" />
      <path d="M12 15.5v3.5M8 20.5h8" />
    </svg>
  );
}

/** Kıvılcım / XP Yıldızları */
export function SketchSparkles({ size = 20, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2.5L13.8 8l5.5 1.8-5.5 1.8L12 17l-1.8-5.4-5.5-1.8 5.5-1.8L12 2.5z" />
      <path d="M19.5 16.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" strokeWidth={strokeWidth * 0.8} />
    </svg>
  );
}

/** Seri / Ateş Taslağı */
export function SketchFlame({ size = 20, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11.8 3.2c.4 2.1-.2 4-1.6 5.5-1.5 1.7-2.7 3.5-2.7 5.8 0 3.8 3.1 6.5 6.8 6.5 4 0 6.7-3 6.7-6.6 0-3.2-1.8-5.3-3.1-7.1-.6-.9-1-1.9-1.1-3 0 0-1.8 1.5-2.5 3.2-1 2.3-3.2 3.2-2.5-.3" />
      <path d="M12.2 13.8c-.3.8-.7 1.5-.7 2.4 0 1.6 1.3 2.8 2.8 2.8 1.4 0 2.5-1.1 2.5-2.6 0-1.2-.8-2.2-1.7-3.1-.3 1.2-1.3 1.6-1.8.8" strokeWidth={strokeWidth * 0.85} />
    </svg>
  );
}

/* =========================================================================
   4. SEVGİLİ GÜNLÜK: ORGANİK RUH HALİ VE İLHAM İKONLARI
   ========================================================================= */

/** Huzurlu: Sakin dalgalar ve yumuşak açık ufuk çizgisi */
export function SketchMoodPeaceful({ size = 18, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3.5 13.5c2.5-1.8 5-1.8 7.5 0s5 1.8 7.5 0 2-.8 2-.8" />
      <path d="M3.5 18c2.5-1.5 5-1.5 7.5 0s5 1.5 7.5 0" strokeWidth={strokeWidth * 0.85} />
      <circle cx="12" cy="7.5" r="3.2" strokeWidth={strokeWidth * 0.9} />
    </svg>
  );
}

/** Üretken: Odaklanmış dinamik kıvılcım ateşi */
export function SketchMoodProductive({ size = 18, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12.5 3c-.5 2.5-2 4.5-3.5 6-1.8 1.8-2.5 3.5-2.5 5.5 0 3.5 2.5 6 5.5 6s5.5-2.5 5.5-6c0-3-1.8-4.8-3-6.5-.5-.8-1-1.8-1-3-.3.5-.8 1-1 1.5" />
      <path d="M12 14c-.5.8-.8 1.4-.8 2 0 1.2.8 1.8 1.8 1.8s1.8-.6 1.8-1.8c0-.8-.5-1.4-1.2-2-.2 1-.8 1.2-1.6 0" strokeWidth={strokeWidth * 0.85} />
    </svg>
  );
}

/** Sakin: Yumuşak hilal ve dinlenme yaprağı */
export function SketchMoodCalm({ size = 18, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 13.5c-.7.2-1.4.3-2.2.3-4.2 0-7.5-3.3-7.5-7.5 0-1.2.3-2.3.8-3.3-3 1.2-5.1 4.1-5.1 7.5 0 4.5 3.6 8.2 8.2 8.2 3.5 0 6.5-2.2 7.7-5.4-.6.1-1.3.2-1.9.2z" />
      <path d="M5.5 19.5c1.5-1 3-1 4.5 0" strokeWidth={strokeWidth * 0.8} />
    </svg>
  );
}

/** Yorgun: Usulca sarkan dinlendirici yaprak / iç çekiş çizgisi */
export function SketchMoodTired({ size = 18, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4.5 19.5c4-2 7.5-5.5 9-11 1.5 5.5 5 9 9 11" strokeWidth={strokeWidth * 0.9} />
      <path d="M13.5 8.5c0 4-1.5 7.5-4 10" strokeWidth={strokeWidth * 0.8} />
      <circle cx="8" cy="7" r="1.5" />
      <circle cx="16" cy="7" r="1.5" />
      <path d="M9.5 12.5c1.5-1 3.5-1 5 0" />
    </svg>
  );
}

/** Gergin: Zikzak / gerilim yayı */
export function SketchMoodTense({ size = 18, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M13 3.5L5.5 13h5.5l-2 7.5L18.5 11H13l2-7.5z" />
    </svg>
  );
}

/** Zor bir gün: El çizimi yağmur bulutu ve damlalar */
export function SketchMoodRain({ size = 18, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6.5 15.5H5.8c-2.4 0-4.3-1.9-4.3-4.3 0-2.2 1.7-4 3.9-4.3 1-3 3.8-5.1 7.1-5.1 3.6 0 6.6 2.5 7.3 5.9 2 .4 3.7 2.1 3.7 4.3 0 2.4-1.9 4.3-4.3 4.3H18" />
      <path d="M8 17.5v3M12 17.5v3.5M16 17.5v2.5" strokeWidth={strokeWidth * 0.9} />
    </svg>
  );
}

/** İlham İstemi: Işıltılı ampul taslağı */
export function SketchLightbulb({ size = 18, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 18.5h6M10 21h4" />
      <path d="M12 3.5c-4.2 0-7 3.2-7 7 0 2.5 1.2 4.2 2.5 5.8.6.8 1.2 1.8 1.5 2.7h6c.3-.9.9-1.9 1.5-2.7 1.3-1.6 2.5-3.3 2.5-5.8 0-3.8-2.8-7-7-7z" />
      <path d="M10 11.5c.5-.8 1.2-1.2 2-1.2s1.5.4 2 1.2" strokeWidth={strokeWidth * 0.8} />
    </svg>
  );
}

/* =========================================================================
   5. KAĞIT & EL YAZISI ÖZELLEŞTİRME SEKME İKONLARI
   ========================================================================= */

/** Kağıt Dokusu: Köşesi hafif kıvrık kağıt sayfası */
export function SketchPaper({ size = 18, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5.5 3.5h9l5 5v12c0 .8-.7 1.5-1.5 1.5h-12.5c-.8 0-1.5-.7-1.5-1.5v-15.5c0-.8.7-1.5 1.5-1.5z" />
      <path d="M14.5 3.5v5h5" />
      <path d="M8.5 12.5h7M8.5 16.5h5" strokeWidth={strokeWidth * 0.85} />
    </svg>
  );
}

/** El Yazısı: Dolmakalem ucu (nib) */
export function SketchQuill({ size = 18, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 21.2l-3.2-6.5c-.8-1.7-.6-3.7.6-5.1l3.8-4.4c.5-.6 1.4-.6 1.9 0l3.8 4.4c1.2 1.4 1.4 3.4.6 5.1L16.2 21.2H12z" />
      <path d="M12 12.5v8.7" strokeWidth={strokeWidth * 0.85} />
      <circle cx="12" cy="12.2" r="1.1" fill="currentColor" />
    </svg>
  );
}

/** Ses: Nota ve titreşim dalgası */
export function SketchSound({ size = 18, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 18V5l10-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </svg>
  );
}

/** Damga: Ahşap mürekkep damgası */
export function SketchStamp({ size = 18, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3.5c-1.8 0-2.8 1.2-2.5 3 .2 1.2 1 2.2 1 3.5H8c-1.5 0-3 1-3 2.5v1h14v-1c0-1.5-1.5-2.5-3-2.5h-2.5c0-1.3.8-2.3 1-3.5.3-1.8-.7-3-2.5-3z" />
      <path d="M4 17.5h16v2.5H4v-2.5z" />
      <path d="M6 21.5h12" strokeWidth={strokeWidth * 0.85} />
    </svg>
  );
}

/** Ciltler: Kitap rafı / ciltli defterler */
export function SketchBooks({ size = 18, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 19.5v-14c0-.8.7-1.5 1.5-1.5H8v17H5.5c-.8 0-1.5-.7-1.5-1.5z" />
      <path d="M8 4h4v17H8V4z" />
      <path d="M12 4h4v17h-4V4z" />
      <path d="M16 4.5l3.5 1.5v14.5l-3.5-1V4.5z" />
    </svg>
  );
}

/* =========================================================================
   6. YOUTUBE ARŞİVİ VE FİLTRE İKONLARI
   ========================================================================= */

/** Saat / İzlenecekler filtresi */
export function SketchClock({ size = 18, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v4.8l3 2" />
    </svg>
  );
}

/** İzlenenler: Tiklenmiş kutu */
export function SketchCheckedBox({ size = 18, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path d="M8 12.5l3 3 5.5-6.5" />
    </svg>
  );
}

/** İş & İhale & Proje Kategorisi: Deri evrak çantası */
export function SketchBriefcase({ size = 18, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="7" width="18" height="13.5" rx="2.5" />
      <path d="M9 7V5c0-.8.7-1.5 1.5-1.5h3c.8 0 1.5.7 1.5 1.5v2" />
      <path d="M3 12.5h18" strokeWidth={strokeWidth * 0.9} />
      <circle cx="12" cy="12.5" r="1.3" fill="currentColor" />
    </svg>
  );
}

/** Yazılım & Teknoloji Kategorisi: El çizimi laptop */
export function SketchLaptop({ size = 18, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4.5" y="4.5" width="15" height="11" rx="1.5" />
      <path d="M2 18.5h20c-.5.8-1.5 1.5-2.5 1.5H4.5C3.5 20 2.5 19.3 2 18.5z" />
      <path d="M9 8.5l2 2-2 2M13 12.5h2.5" strokeWidth={strokeWidth * 0.85} />
    </svg>
  );
}
/** Mezuniyet kepi / Kelime ustası */
export function SketchCap({ size = 20, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 4.6L2.5 9.2l9.5 4.7 9.5-4.7L12 4.6z" />
      <path d="M6.2 11.2v4.3c0 2 2.6 3.8 5.8 3.8s5.8-1.8 5.8-3.8v-4.3" />
      <path d="M20 9.8v6.2c-.2.8-.7 1.5-.7 1.5" strokeWidth={strokeWidth * 0.9} />
      <circle cx="19.3" cy="18.2" r="0.9" fill="currentColor" />
    </svg>
  );
}

/* =========================================================================
   7. SKETCH KONTUR KAPANIŞ İKONLARI (EMOJİ DÖNÜŞÜMÜ)
   ========================================================================= */
/** Kamera: Defter fotoğrafı çekme / OCR ikonu */
export function SketchCamera({ size = 16, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 8.5h3l1.5-2.5h7L17 8.5h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z" />
      <circle cx="12" cy="14.5" r="3.5" />
      <circle cx="18" cy="11" r="0.75" fill="currentColor" />
    </svg>
  );
}

/** Açık Kitap: Günlük akışı ve arşiv ikonu */
export function SketchOpenBook({ size = 16, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 6.5c-2.5-1.5-6-1.5-9 0v12c3-1.5 6.5-1.5 9 0m0-12c2.5-1.5 6-1.5 9 0v12c-3-1.5-6.5-1.5-9 0m0-12v12" />
    </svg>
  );
}

/** Pusula: Duygu pusulası & takvim ikonu */
export function SketchCompass({ size = 16, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" fillOpacity="0.18" />
    </svg>
  );
}

/** Kalem / Yazma ikonu */
export function SketchFeatherEdit({ size = 16, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

/** Kum Saati: Tekrar sırası bekleyen kelimeler boş durum ikonu */
export function SketchHourglass({ size = 20, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 3h14M5 21h14M7 3v4.5a5 5 0 0 0 2.5 4.33L12 13.5l2.5-1.67A5 5 0 0 0 17 7.5V3M7 21v-4.5a5 5 0 0 1 2.5-4.33L12 10.5l2.5 1.67A5 5 0 0 1 17 16.5V21" />
      <line x1="9" y1="18" x2="15" y2="18" strokeWidth={strokeWidth * 0.8} />
    </svg>
  );
}

/** Yıldız: Öğrenilen kelimeler boş durum ikonu */
export function SketchStarOutline({ size = 20, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2.5 15.09 8.76 22 9.77 17 14.64 18.18 21.52 12 18.27 5.82 21.52 7 14.64 2 9.77 8.91 8.76 12 2.5" />
    </svg>
  );
}

/** Kilit: Günlük mahremiyet kilidi ikonu */
export function SketchLock({ size = 20, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <circle cx="12" cy="16" r="1.2" fill="currentColor" />
    </svg>
  );
}

/** Anahtar: Kilit açma ikonu */
export function SketchKey({ size = 16, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.7 12.3L20 3m-3 0l3 3m-5 0l2 2" />
    </svg>
  );
}

/** Masa Saati / Çalar Saat: Geçmişten bir anı ikonu */
export function SketchHistoryClock({ size = 18, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9.5v3.5l2.5 1.5" />
      <path d="M5 4.5l3 2.5M19 4.5l-3 2.5M7 20.5l-2 2M17 20.5l2 2" />
    </svg>
  );
}

/** Pano / Kopyalama & Yapıştırma ikonu */
export function SketchClipboard({ size = 16, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

/** Belge / PDF ikonu */
export function SketchDocument({ size = 16, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5l-5-5z" />
      <path d="M14 2.5v5h5" />
      <path d="M8.5 13h7M8.5 16.5h4.5" />
    </svg>
  );
}

/* =========================================================================
   8. KALEM SESİ PROFİLİ SKETCH İKONLARI (Dolmakalem / Kurşun / Tükenmez / Daktilo)
   ========================================================================= */
/** Dolmakalem — ıslak mürekkep ucu */
export function SketchFountainPen({ size = 16, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M13.2 3.2c2.9 1.7 5 3.9 6.4 6.9-2.5 3.6-5.6 6.3-9.4 8.2-2-1.5-3.6-3.3-4.7-5.4 1.9-3.7 4.6-6.8 7.7-9.7z" />
      <path d="M13.5 3.6c-1.2 2.9-2.9 5.5-5 7.9" opacity="0.7" />
      <path d="M10.1 18.3c-.4.8-.9 1.5-1.7 2.1.8.1 1.6-.1 2.3-.4" />
      <path d="M10.4 10.6a.7.7 0 1 0 .1 1.4.7.7 0 0 0-.1-1.4z" opacity="0.6" />
    </svg>
  );
}

/** Kurşun Kalem — altıgen ahşap gövde, grafit uç */
export function SketchPencil({ size = 16, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16.8 3.1l4.1 4.1c-3 3-6 6-9 9l-4.4 1.2-1.1-1.1 1.2-4.4c3-3 6.1-6 9.2-8.8z" />
      <path d="M7.6 16.9l-1.4-1.4M15.6 4.3l4.1 4.1" opacity="0.7" />
      <path d="M7.4 17.1l-2.9 2.8" />
      <path d="M4.6 20.1l1.8-.4-.6-.6-.6 1z" strokeWidth={strokeWidth * 0.9} />
    </svg>
  );
}

/** Tükenmez Kalem — bilyeli uç ve klips */
export function SketchBallpoint({ size = 16, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18.4 3.4l2.2 2.2c-3.6 3.4-7 6.9-10.2 10.6l-3.6 1-1-1 1-3.6c3.5-3.3 7.2-6.4 11.6-9.2z" />
      <path d="M17.9 3.9l2.2 2.2" opacity="0.75" />
      <path d="M9.4 16.2l-2.1 2.1c-.3.3-.3.8 0 1.1.3.3.8.3 1.1 0l2.1-2.1" />
      <circle cx="7.3" cy="19.3" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Vintage Daktilo — mekanik tuşlar ve kağıt rulosu */
export function SketchTypewriter({ size = 16, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Kağıt ve rulo */}
      <path d="M7.4 7.4V3.6h9.2v3.8" />
      <path d="M6.6 7.3c3.6-.4 7.2-.4 10.8 0" opacity="0.8" />
      {/* Gövde */}
      <path d="M4.6 16.2c-.7 0-1.2-.6-1.1-1.3l.8-4.6c.1-.6.6-1 1.2-1h13c.6 0 1.1.4 1.2 1l.8 4.6c.1.7-.5 1.3-1.2 1.3z" />
      {/* Tuş sıraları */}
      <path d="M6.6 11.6h10.8" opacity="0.7" />
      <path d="M7.4 13.9h1.2M10.3 13.9h1.2M13.2 13.9h1.2M16.1 13.9h1.2" strokeWidth={strokeWidth * 0.85} />
      {/* Ön kenar / tuş kılavuzu */}
      <path d="M8.2 16.3v2.1M15.8 16.3v2.1" opacity="0.8" />
      <path d="M7.6 18.6c2.9 0 5.9 0 8.8 0" />
    </svg>
  );
}
/** Çeviri / Dil ikonu — organik sketch */
export function SketchTranslate({ size = 16, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3.6 5.4c3.9-.6 7.8-.6 11.7 0" />
      <path d="M9.4 3.4c-.3 2.6-.9 5-1.9 7.2-1 2.1-2.3 3.8-3.9 5.2" />
      <path d="M5.1 9.7c2.1 3.3 4.7 6 7.8 8.1" />
      <path d="M12.4 20.6c2.2-4.8 4.6-9.3 7.4-13.4" />
      <path d="M15.3 18.4c1.9 0 3.7 0 5.5 0" />
    </svg>
  );
}
/** Mikrofon: Sesli dikte (Web Speech API) ikonu */
export function SketchMic({ size = 20, className = "", strokeWidth = 1.75 }: SketchIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5v.8a6.5 6.5 0 0 0 13 0v-.8" />
      <path d="M12 18.8v2.7M8.5 21.5h7" />
    </svg>
  );
}
