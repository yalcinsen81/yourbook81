import type { SVGProps } from "react";

interface SketchProps extends SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

/**
 * Superr Defter El Çizimi Boş Durum İllüstrasyonları
 * Keçeli kalem / kroki (doodle) estetiğinde, organik ve hafif pürüzlü çizgiler.
 * currentColor ve var(--ink) / var(--accent) ile temalara tam uyum sağlar.
 */

// 1. Boş Notlar & Kişisel Notlar İçin: Karalanmış Defter Kağıdı ve Çizim Kalemi
export function SketchEmptyNotes({ size = 110, className = "" }: SketchProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block ${className}`}
    >
      {/* Kağıt Sayfası (hafif eğik ve organik köşeli) */}
      <path
        d="M26 22 C28 20, 36 21, 74 20 C78 20, 84 24, 85 28 L89 88 C89 92, 85 96, 80 97 C52 98, 38 97, 25 96 C20 95, 18 90, 19 86 L23 28 C23 24, 25 22, 26 22 Z"
        stroke="var(--ink)"
      />
      {/* Kıvrık sağ alt köşe detayı */}
      <path d="M72 97 L75 84 L88 87" stroke="var(--ink)" strokeWidth={1.8} />

      {/* Kağıt üzerindeki defter çizgileri (hafif serbest el) */}
      <path d="M32 36 C42 35, 58 37, 72 36" stroke="color-mix(in srgb, var(--ink) 40%, transparent)" strokeWidth={1.8} />
      <path d="M30 48 C44 49, 56 47, 74 48" stroke="color-mix(in srgb, var(--ink) 40%, transparent)" strokeWidth={1.8} />
      <path d="M31 60 C46 59, 52 61, 68 60" stroke="color-mix(in srgb, var(--ink) 40%, transparent)" strokeWidth={1.8} />
      <path d="M33 72 C41 73, 50 71, 60 72" stroke="color-mix(in srgb, var(--ink) 40%, transparent)" strokeWidth={1.8} />

      {/* Çapraz duran kurşun kalem */}
      <g transform="rotate(24 85 62)">
        <path d="M80 18 L88 18 L90 85 L84 94 L78 85 Z" stroke="var(--accent)" strokeWidth={2.2} fill="var(--paper)" />
        <path d="M78 85 L90 85" stroke="var(--ink)" strokeWidth={1.8} />
        {/* Kalem ucu kurşunu */}
        <polygon points="84,94 81,89 87,89" fill="var(--ink)" stroke="none" />
      </g>

      {/* Küçük ilham kıvılcımları / el çizimi parıltılar */}
      <path d="M98 28 L104 22 M104 28 L98 22" stroke="var(--accent)" strokeWidth={2} />
      <circle cx="16" cy="40" r="1.8" fill="var(--accent)" stroke="none" />
      <circle cx="20" cy="78" r="1.4" fill="var(--accent)" stroke="none" />
    </svg>
  );
}

// 2. Arama Boş Durumu İçin: Mercek / Karalanmış Soru İzi
export function SketchEmptySearch({ size = 110, className = "" }: SketchProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block ${className}`}
    >
      {/* Büyüteç Çerçevesi (hafif el titreşimli daire) */}
      <path
        d="M50 20 C67 19, 82 32, 81 51 C80 69, 65 82, 47 81 C30 80, 18 66, 19 48 C20 31, 33 21, 50 20 Z"
        stroke="var(--ink)"
      />
      {/* Büyüteç camı içi parlama çizgisi */}
      <path d="M32 38 C35 32, 42 27, 49 26" stroke="color-mix(in srgb, var(--ink) 35%, transparent)" strokeWidth={1.8} />

      {/* Büyüteç Sapı */}
      <path d="M72 73 L98 100 C101 103, 105 99, 102 96 L76 69" stroke="var(--ink)" strokeWidth={2.8} />
      <path d="M84 85 L95 96" stroke="var(--accent)" strokeWidth={2} />

      {/* Camın ortasında hafif şaşkın / arayan el çizimi soru işareti */}
      <path
        d="M44 42 C44 37, 48 34, 53 35 C57 36, 59 40, 56 44 C53 48, 50 50, 50 55"
        stroke="var(--accent)"
        strokeWidth={2.4}
      />
      <circle cx="50" cy="62" r="1.8" fill="var(--accent)" stroke="none" />

      {/* Kaçan küçük toz zerrecikleri */}
      <path d="M14 62 L8 64 M14 68 L10 72" stroke="color-mix(in srgb, var(--ink) 50%, transparent)" strokeWidth={1.8} />
      <circle cx="86" cy="24" r="1.5" fill="var(--accent)" stroke="none" />
    </svg>
  );
}

// 3. Boş Kelime Kartları / Masalar İçin: Açık Defter Kartları Destesi
export function SketchEmptyCards({ size = 110, className = "" }: SketchProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block ${className}`}
    >
      {/* Alttaki Kart (daha fazla eğik) */}
      <path
        d="M28 38 L84 26 C88 25, 93 29, 94 34 L102 78 C103 83, 99 88, 94 89 L38 101 C33 102, 28 98, 27 93 L19 49 C18 44, 22 39, 28 38 Z"
        stroke="color-mix(in srgb, var(--ink) 45%, transparent)"
        strokeWidth={2}
      />

      {/* Üstteki Ana Kart (dik duran, belirgin) */}
      <path
        d="M24 28 C26 26, 32 25, 78 25 C83 25, 87 29, 87 34 L87 86 C87 91, 83 95, 78 95 C40 95, 30 95, 24 95 C19 95, 15 91, 15 86 L15 34 C15 29, 19 28, 24 28 Z"
        stroke="var(--ink)"
        fill="var(--paper)"
      />

      {/* Kart üst rozet çizgisi */}
      <path d="M22 38 C32 37, 44 38, 48 37" stroke="var(--accent)" strokeWidth={2.4} />

      {/* Kart üzerindeki kelime çizgileri */}
      <path d="M22 52 C36 51, 58 53, 72 52" stroke="var(--ink)" strokeWidth={2.2} />
      <path d="M22 64 C34 65, 52 63, 62 64" stroke="color-mix(in srgb, var(--ink) 50%, transparent)" strokeWidth={1.8} />

      {/* Sağ üstte filizlenen minik organik yaprak */}
      <path
        d="M84 20 C92 12, 102 14, 102 24 C94 26, 88 22, 84 20 Z"
        stroke="var(--accent)"
        strokeWidth={2}
        fill="color-mix(in srgb, var(--accent) 30%, transparent)"
      />
      <path d="M84 20 C90 28, 92 34, 94 38" stroke="var(--accent)" strokeWidth={1.8} />
    </svg>
  );
}

// 4. Boş Fikirler & Stratejiler İçin: El Çizimi Ampul ve Düşünce Işıkları
export function SketchEmptyIdeas({ size = 110, className = "" }: SketchProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block ${className}`}
    >
      {/* Ampul Cam Gövdesi */}
      <path
        d="M44 72 C38 68, 30 58, 30 46 C30 30, 43 18, 60 18 C77 18, 90 30, 90 46 C90 58, 82 68, 76 72 L74 84 L46 84 Z"
        stroke="var(--ink)"
      />

      {/* Ampul İçi El Kıvrımı Tel (Filament) */}
      <path d="M50 56 C50 44, 55 40, 60 40 C65 40, 70 44, 70 56" stroke="var(--accent)" strokeWidth={2.2} />
      <path d="M54 56 L54 66 M66 56 L66 66" stroke="var(--accent)" strokeWidth={1.8} />

      {/* Ampul Metal Vidalı Duy Bölümü */}
      <path d="M48 90 L72 90" stroke="var(--ink)" strokeWidth={2.2} />
      <path d="M51 96 L69 96" stroke="var(--ink)" strokeWidth={2.2} />
      <path d="M54 102 C56 104, 64 104, 66 102" stroke="var(--ink)" strokeWidth={2} />

      {/* Düşünce Işınları / Kıvılcımlar */}
      <path d="M60 6 L60 12" stroke="var(--accent)" strokeWidth={2.4} />
      <path d="M22 28 L28 32" stroke="var(--accent)" strokeWidth={2.4} />
      <path d="M98 28 L92 32" stroke="var(--accent)" strokeWidth={2.4} />
      <path d="M14 52 L20 52" stroke="var(--accent)" strokeWidth={2.4} />
      <path d="M106 52 L100 52" stroke="var(--accent)" strokeWidth={2.4} />
    </svg>
  );
}

// 5. Boş Görevler / Günlük İçin: El Çizimi Kontrol Listesi & Tikler
export function SketchEmptyTasks({ size = 110, className = "" }: SketchProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block ${className}`}
    >
      {/* Pano / Defter Şablonu */}
      <rect x="24" y="24" width="72" height="82" rx="6" stroke="var(--ink)" />
      {/* Pano Üst Metal Klipsi */}
      <path d="M44 24 V16 C44 14, 46 12, 49 12 H71 C74 12, 76 14, 76 16 V24" stroke="var(--ink)" strokeWidth={2.2} />
      <circle cx="60" cy="18" r="2.2" stroke="var(--accent)" strokeWidth={1.8} fill="none" />

      {/* 1. Madde: Tik Atılmış Kutu */}
      <rect x="32" y="38" width="14" height="14" rx="2.5" stroke="var(--accent)" />
      <path d="M35 45 L39 49 L50 37" stroke="var(--accent)" strokeWidth={2.4} />
      <path d="M52 45 H84" stroke="color-mix(in srgb, var(--ink) 45%, transparent)" strokeWidth={2} />

      {/* 2. Madde: Bekleyen Boş Kutu */}
      <rect x="32" y="58" width="14" height="14" rx="2.5" stroke="var(--ink)" />
      <path d="M52 65 H80" stroke="var(--ink)" strokeWidth={2} />

      {/* 3. Madde: Bekleyen Boş Kutu */}
      <rect x="32" y="78" width="14" height="14" rx="2.5" stroke="var(--ink)" />
      <path d="M52 85 H74" stroke="var(--ink)" strokeWidth={2} />

      {/* Küçük neşeli gülen yüz çizimi */}
      <path d="M96 46 C99 50, 105 50, 108 46" stroke="var(--accent)" strokeWidth={2} />
      <circle cx="98" cy="40" r="1.2" fill="var(--accent)" stroke="none" />
      <circle cx="106" cy="40" r="1.2" fill="var(--accent)" stroke="none" />
    </svg>
  );
}

// 6. Boş YouTube / Video Listesi İçin: Retro El Çizimi Ekran ve Oynatma Butonu
export function SketchEmptyVideo({ size = 110, className = "" }: SketchProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block ${className}`}
    >
      {/* Çift Anten */}
      <path d="M42 16 L56 32 M78 16 L64 32" stroke="var(--accent)" strokeWidth={2.2} />
      <circle cx="41" cy="15" r="2.2" fill="var(--accent)" stroke="none" />
      <circle cx="79" cy="15" r="2.2" fill="var(--accent)" stroke="none" />

      {/* Retro TV / Monitör Kasası */}
      <rect x="18" y="32" width="84" height="62" rx="8" stroke="var(--ink)" />

      {/* Ekran Alanı */}
      <rect x="26" y="38" width="56" height="50" rx="4" stroke="color-mix(in srgb, var(--ink) 35%, transparent)" strokeWidth={1.8} />

      {/* Ekran İçi Organik Oynat (Play) Üçgeni */}
      <path
        d="M48 51 L64 63 L48 75 Z"
        stroke="var(--accent)"
        strokeWidth={2.4}
        fill="color-mix(in srgb, var(--accent) 20%, transparent)"
      />

      {/* Sağ Panel Kontrol Düğmeleri */}
      <circle cx="91" cy="48" r="3.2" stroke="var(--ink)" strokeWidth={1.8} />
      <circle cx="91" cy="62" r="3.2" stroke="var(--ink)" strokeWidth={1.8} />
      <path d="M86 76 H96" stroke="color-mix(in srgb, var(--ink) 45%, transparent)" strokeWidth={1.8} />
      <path d="M86 82 H96" stroke="color-mix(in srgb, var(--ink) 45%, transparent)" strokeWidth={1.8} />

      {/* TV Ayakları */}
      <path d="M30 94 L22 104 M90 94 L98 104" stroke="var(--ink)" strokeWidth={2.4} />
    </svg>
  );
}
