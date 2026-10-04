import React from "react";

/**
 * 🎨 ORGANİK EL ÇİZİMİ (SKETCH) KAPAK ROZET İKONLARI
 *
 * Bu ikonlar mükemmel geometriden arındırılmıştır:
 *  - path'ler asimetrik kontrol noktalarıyla hafif titrek (wobble) çizilmiştir
 *  - her ikonda çift/üst üste çizgi (overdraw) tekniğiyle kalem baskısı hissi vardır
 *  - ortak bir `sketchWobble` SVG filtresi (turbulence + displacement) dokuyu organikleştir
 *  - çizgi kapak sayfasındaki eğri ok ve "Caveat" el yazısıyla aynı kalem dilini konuşur
 */

export interface SketchBadgeIconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

const D = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Her ikon için hafif farklı tohumla titreme üreten ortak doku filtresi */
function SketchTextureFilter({ id, seed = 3 }: { id: string; seed?: number }) {
  return (
    <filter id={id} x="-18%" y="-18%" width="136%" height="136%">
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.045"
        numOctaves={2}
        seed={seed}
        result="noise"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="noise"
        scale="0.9"
        xChannelSelector="R"
        yChannelSelector="G"
      />
    </filter>
  );
}

/* 1. İlk Sayfa — dikişli, kıvrık, yamuk açık defter */
export function SketchNotebook({ size = 30, className = "", strokeWidth = 1.7 }: SketchBadgeIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none">
      <defs>
        <SketchTextureFilter id="skNotebook" seed={2} />
      </defs>
      <g filter="url(#skNotebook)" {...D} strokeWidth={strokeWidth}>
        {/* Sol sayfa — hafif yamuk */}
        <path d="M19.6 9.4c-2.9-1.7-6.4-2.3-9.7-1.9-1 .1-1.5.6-1.5 1.7v18.6c0 1 .5 1.4 1.5 1.4 3.1-.2 6.6.3 9.4 1.9" />
        {/* Sağ sayfa — asimetrik */}
        <path d="M20.4 9.6c3-1.8 6.5-2.4 9.9-2 .9.1 1.4.6 1.4 1.6v18.7c0 1-.5 1.4-1.5 1.4-3.1-.2-6.6.4-9.5 2" />
        {/* Orta dikiş — titrek çift çizgi */}
        <path d="M19.9 9.9c.4 6.6.3 13.3-.1 20" />
        <path d="M20.5 10.3c-.3 6.5-.2 13 .1 19.4" opacity={0.45} />
        {/* Sayfa çizgileri — elle çizilmiş, hafif eğri */}
        <path d="M11.4 16.2c2.1-.6 4.3-.6 6.4-.2" />
        <path d="M11.6 21c2-.5 4.2-.5 6.2 0" />
        <path d="M22.3 16.4c2.1-.5 4.3-.6 6.5-.3" />
        <path d="M22.2 21.2c2-.4 4.2-.4 6.2.1" />
      </g>
    </svg>
  );
}

/* 2. Ritim — organik alev taslağı, kıvılcımlı */
export function SketchFlame({ size = 30, className = "", strokeWidth = 1.7 }: SketchBadgeIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none">
      <defs>
        <SketchTextureFilter id="skFlame" seed={5} />
      </defs>
      <g filter="url(#skFlame)" {...D} strokeWidth={strokeWidth}>
        {/* Dış alev — asimetrik, ucu kıvrık */}
        <path d="M21.2 6.8c2.6 3.3 8 7.6 8 13.6 0 5.1-3.9 9.2-9.1 9.2-5.3 0-9.3-3.9-9.3-9 0-4.2 2.6-6.6 4.3-9 .6 1.9 1.4 3.1 2.6 3.9.3-3.6.9-6.1 3.5-8.7z" />
        {/* İç alev kıvrımı — titrek */}
        <path d="M20.4 17.4c1.6 1.8 2.7 3.4 2.7 5.4 0 2-1.5 3.6-3.4 3.5-1.9-.1-3.3-1.7-3.3-3.6 0-1.9 1.6-2.9 4-5.3z" opacity={0.7} />
        {/* Kıvılcımlar */}
        <path d="M10.4 12.2l-1.4-1.6" />
        <path d="M30.2 11.6l1.5-1.7" />
        <path d="M19.6 4.6l.1-2.2" opacity={0.75} />
        <path d="M14.2 8.1l-1-1.9" opacity={0.75} />
      </g>
    </svg>
  );
}

/* 3. Kelime Ustası — tek çizgi, püskülü sallanan kepli */
export function SketchScholarCap({ size = 30, className = "", strokeWidth = 1.7 }: SketchBadgeIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none">
      <defs>
        <SketchTextureFilter id="skCap" seed={7} />
      </defs>
      <g filter="url(#skCap)" {...D} strokeWidth={strokeWidth}>
        {/* Kep üstü — asimetrik elmas */}
        <path d="M20.2 9.1c-4.2 1.6-8.4 3.2-12.4 5.3 4.1 2.2 8.3 3.7 12.6 5.3 4.2-1.6 8.3-3.2 12.3-5.3-4.1-2-8.3-3.6-12.5-5.3z" />
        {/* Kloş (alt gövde) */}
        <path d="M12.6 17.4c-.4 2.6-.4 5 .1 7.5" />
        <path d="M27.4 17.6c.4 2.5.5 4.9 0 7.3" />
        <path d="M12.9 24.6c4.8 2 9.6 2 14.4-.1" />
        {/* Püskül — eğri ip ve topuz */}
        <path d="M31.9 14.6c1.4 3.2 1.4 6.6.2 9.9" />
        <path d="M32.2 24.3c-1.3.6-1.7 1.8-.9 3" opacity={0.8} />
      </g>
    </svg>
  );
}

/* 4. Kelime Avcısı — titrek hedef halkaları ve saplanan ok */
export function SketchTarget({ size = 30, className = "", strokeWidth = 1.7 }: SketchBadgeIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none">
      <defs>
        <SketchTextureFilter id="skTarget" seed={9} />
      </defs>
      <g filter="url(#skTarget)" {...D} strokeWidth={strokeWidth}>
        {/* Dış halka — ovalliği bozulmuş */}
        <path d="M20.3 6.6c7.5-.3 13.4 5.7 13.1 13.2-.3 7.4-6 13.3-13.4 13.1C12.6 32.7 7 26.9 7.1 19.7 7.2 12.4 12.8 6.9 20.3 6.6z" />
        {/* Orta halka */}
        <path d="M20.2 12.1c4.3-.2 7.7 3.4 7.4 7.7-.2 4.2-3.5 7.6-7.7 7.5-4.2-.1-7.6-3.5-7.5-7.7.1-4.1 3.5-7.4 7.8-7.5z" opacity={0.85} />
        {/* Merkez */}
        <path d="M19.9 17.9c1.3-.1 2.4 1 2.3 2.3-.1 1.3-1.1 2.3-2.4 2.2-1.3 0-2.3-1.1-2.2-2.4 0-1.2 1.1-2.1 2.3-2.1z" />
        {/* Saplanan ok + yarıklar */}
        <path d="M33.6 6.4c-4 3.9-8 7.7-12.1 11.4" />
        <path d="M33.8 6.2l-1.8-1.9M33.9 6.1l-1.9 1.8" opacity={0.8} />
        <path d="M27.5 12.3l-1.3-1.3" opacity={0.7} />
      </g>
    </svg>
  );
}

/* 5. Seviye 2+ — sıcak, beş köşesi bozuk doodle yıldız + ışık hatları */
export function SketchStar({ size = 30, className = "", strokeWidth = 1.7 }: SketchBadgeIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none">
      <defs>
        <SketchTextureFilter id="skStar" seed={11} />
      </defs>
      <g filter="url(#skStar)" {...D} strokeWidth={strokeWidth}>
        {/* Yıldız — asimetrik kollar */}
        <path d="M20.3 7.2c1.3 3.1 2.4 5.8 3.6 8.5 2.9.3 5.6.7 8.4 1.3-2.3 2.2-4.3 4.1-6.3 6.1.7 2.8 1.3 5.6 1.7 8.5-2.6-1.3-5.1-2.6-7.6-3.9-2.5 1.4-4.9 2.7-7.4 3.9.5-3 1-5.8 1.6-8.6-2.1-1.9-4.1-3.8-6-5.9 2.9-.6 5.6-1 8.4-1.2 .9-2.8 1.8-5.5 3.6-8.7z" />
        {/* İç gölge çizgisi (kalem baskısı) */}
        <path d="M20.1 12.9c.9 2 1.6 3.7 2.3 5.5" opacity={0.5} />
        {/* Işık hatları */}
        <path d="M9.1 9.4l-1.7-1.6" />
        <path d="M31.2 9.1l1.7-1.7" />
        <path d="M20.1 4.3V2.4" opacity={0.8} />
      </g>
    </svg>
  );
}

/* 6. Zaman Ustası — halkalı cep saati, 10:10 ibresi */
export function SketchClock({ size = 30, className = "", strokeWidth = 1.7 }: SketchBadgeIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none">
      <defs>
        <SketchTextureFilter id="skClock" seed={13} />
      </defs>
      <g filter="url(#skClock)" {...D} strokeWidth={strokeWidth}>
        {/* Kurma halkası */}
        <path d="M18.1 5.7c1.2-.9 2.6-.9 3.8 0 .7.6.6 1.5 0 2.1" />
        <path d="M15.9 8.4c2.7-1.4 5.6-1.4 8.3.1" />
        {/* Gövde — ovalliği bozuk */}
        <path d="M20.2 9.1c7.3-.4 13.1 5.7 12.7 12.9-.4 7.1-6.2 12.7-13.3 12.4C12.6 34.1 7 28.3 7.2 21.2 7.4 14.1 13 9.5 20.2 9.1z" />
        {/* Kadran */}
        <path d="M20 14.2v7.1l4.1 2.4" />
        <path d="M20.3 14.1c-.5 5.2-.3 10.4.2 15.7" opacity={0.35} />
        {/* Saat tırtıkları */}
        <path d="M19.9 11.4v1.4M20.1 28.7v1.3M11.9 20v1.5M28.2 20.1v1.4" opacity={0.7} />
      </g>
    </svg>
  );
}

/* 7. İki Dilli — üst üste binen dostane konuşma balonları */
export function SketchBubbles({ size = 30, className = "", strokeWidth = 1.7 }: SketchBadgeIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none">
      <defs>
        <SketchTextureFilter id="skBubbles" seed={15} />
      </defs>
      <g filter="url(#skBubbles)" {...D} strokeWidth={strokeWidth}>
        {/* Arka balon */}
        <path d="M25.1 8.4c3.9-.2 7 2.7 7.1 6.6.1 3.9-2.8 7-6.7 7-.9 0-1.8-.2-2.6-.5-1.6 1-3 1.7-4.9 2 .9-1.1 1.3-2.1 1.3-3.3-1.2-1.3-1.9-3-1.9-4.9 0-3.8 3.1-6.8 7.7-6.9z" />
        {/* Ön balon */}
        <path d="M14.2 12.1c-4.1-.2-7.4 2.9-7.5 7-.1 4.1 3 7.4 7 7.4.9 0 1.8-.1 2.6-.5 1.6 1 3 1.6 5 1.9-.9-1.1-1.4-2.1-1.4-3.3 1.3-1.3 2-3.1 2-5 0-4.1-3.2-7.2-7.7-7.5z" />
        {/* Küçük konuşma çizgileri */}
        <path d="M11.1 18.1c1.3-.3 2.6-.3 3.9-.1" opacity={0.7} />
        <path d="M23.4 15.3c1.2-.3 2.4-.3 3.6-.1" opacity={0.7} />
      </g>
    </svg>
  );
}

/* 8. Özgün Defter — dolmakalem ucu + mürekkep yarığı */
export function SketchQuill({ size = 30, className = "", strokeWidth = 1.7 }: SketchBadgeIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none">
      <defs>
        <SketchTextureFilter id="skQuill" seed={17} />
      </defs>
      <g filter="url(#skQuill)" {...D} strokeWidth={strokeWidth}>
        {/* Kalem ucu — asimetrik */}
        <path d="M21.1 6.2c4.6 2.3 8.2 5.9 10.5 10.5-4 6.1-9.1 10.6-15.2 13.7-3.3-2.4-5.9-5.4-7.7-8.8 3.1-6.1 7.6-11.2 12.4-15.4z" />
        {/* Mürekkep yarığı */}
        <path d="M21.6 6.7c-2 4.8-4.7 9.1-8.1 13" />
        <path d="M16.9 14.1c1.7 1.5 3.1 3.1 4.2 5" opacity={0.7} />
        {/* Uç ve nefes deliği */}
        <path d="M15.7 30.6c-.7 1.3-1.6 2.4-2.8 3.3 1.4.2 2.7 0 3.8-.6" />
        <path d="M16.4 18.3a.9.9 0 1 0 .1 1.8.9.9 0 0 0-.1-1.8z" opacity={0.6} />
      </g>
    </svg>
  );
}

/* 9. Hediye Defter — fiyonklu minik kutu taslağı */
export function SketchGift({ size = 30, className = "", strokeWidth = 1.7 }: SketchBadgeIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} fill="none">
      <defs>
        <SketchTextureFilter id="skGift" seed={19} />
      </defs>
      <g filter="url(#skGift)" {...D} strokeWidth={strokeWidth}>
        {/* Kutu gövdesi — yamuk */}
        <path d="M8.3 16.1c7.9-1.1 15.8-1.1 23.6.1.3 5.7.2 11.4-.3 17.1-7.8 1.3-15.6 1.4-23.3.1-.5-5.7-.5-11.4 0-17.3z" />
        {/* Kurdele — dikey */}
        <path d="M20.2 15.7c-.4 5.8-.3 11.6.2 17.4" opacity={0.8} />
        {/* Kapak bandı */}
        <path d="M8.4 21.6c7.8-.6 15.7-.6 23.5 0" opacity={0.55} />
        {/* Fiyonk — asimetrik ilmekler */}
        <path d="M20.1 15.6c-2.7-3.5-5.5-4.4-7.4-2.7-1.8 1.6-1.1 4.3 2 5.6 1.7.7 3.8-.4 5.4-2.9z" />
        <path d="M20.3 15.6c2.7-3.6 5.6-4.6 7.5-2.9 1.9 1.6 1.2 4.3-1.9 5.7-1.7.7-3.9-.5-5.6-2.8z" />
        {/* Kurdele uçları */}
        <path d="M19.8 15.9c-.9-1.4-1.6-2.6-2.2-3.9" opacity={0.6} />
        <path d="M20.5 15.9c.9-1.5 1.7-2.7 2.3-4" opacity={0.6} />
      </g>
    </svg>
  );
}

/** Kilit ikonu — kazanılmamış rozetler için (sketch dilinde) */
export function SketchBadgeLock({ size = 13, className = "", strokeWidth = 1.7 }: SketchBadgeIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <defs>
        <SketchTextureFilter id="skBadgeLock" seed={23} />
      </defs>
      <g filter="url(#skBadgeLock)" {...D} strokeWidth={strokeWidth}>
        <path d="M6.1 10.6c3.9-.5 7.9-.5 11.8.1.3 3.4.2 6.7-.2 10-3.8.5-7.6.6-11.4.1-.4-3.3-.5-6.7-.2-10.2z" />
        <path d="M8.4 10.4C8 6.8 9.7 5 12.1 5.1c2.3.1 3.9 1.8 3.6 5.1" />
        <path d="M12 14.1c-.4 1.1-.4 2.2 0 3.3" opacity={0.8} />
      </g>
    </svg>
  );
}

/** Kazanılmış rozet için küçük el çizimi tik */
export function SketchBadgeCheck({ size = 11, className = "", strokeWidth = 2 }: SketchBadgeIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none">
      <g {...D} strokeWidth={strokeWidth}>
        <path d="M5.4 12.7c1.8 1.4 3.3 2.9 4.7 4.6 2.9-3.9 5.5-7.4 9.1-10.7" />
      </g>
    </svg>
  );
}

/**
 * Rozet kimliğine göre uygun organik sketch ikonunu döndüren dağıtıcı.
 * Geriye dönük uyumluluk için korunmuştur.
 */
export function SketchBadgeIcon({
  badgeId,
  size = 28,
  strokeWidth = 1.7,
  isUnlocked = true,
}: {
  badgeId: string;
  size?: number;
  strokeWidth?: number;
  isUnlocked?: boolean;
}) {
  const props = { size, strokeWidth };
  switch (badgeId) {
    case "first_journal":
      return <SketchNotebook {...props} />;
    case "streak_rhythm":
      return <SketchFlame {...props} />;
    case "word_master":
      return <SketchScholarCap {...props} />;
    case "word_hunter":
      return <SketchTarget {...props} />;
    case "level_up":
      return <SketchStar {...props} />;
    case "agenda_planner":
      return <SketchClock {...props} />;
    case "dual_language":
      return <SketchBubbles {...props} />;
    case "custom_notebook":
      return <SketchQuill {...props} />;
    case "gift_notebook":
      return <SketchGift {...props} />;
    default:
      return <SketchNotebook {...props} />;
  }
}