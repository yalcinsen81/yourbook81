/* ==========================================================================
   KALEM / STYLUS VERI MODELI (VEKTOR)
   ---------------------------------------------------------------------------
   Cizim RESIM olarak DEGIL, vektor olarak saklanir:
     PenStroke  = tek bir cizgi (kalem kaldirilana kadar)
     PenPoint   = { x, y, basinc, zaman }
   Amac: kucuk ve tasinabilir veri (backend'e gecerken de ayni yapi kullanilir).
   Koordinatlar 0..1 ARALIGINDA NORMALIZE edilir; boylece canvas boyutu
   degisse bile (mobil/masaustu, farkli genislik) cizim AYNI gorunur.
   ========================================================================== */

/** Tek bir noktanin normalize koordinati (0..1) + basinc + zaman. */
export interface PenPoint {
  /** 0..1 arasi yatay konum (canvas genisligine gore) */
  x: number;
  /** 0..1 arasi dikey konum (canvas yuksekligine gore) */
  y: number;
  /** 0..1 arasi basinc (cihaz desteklemiyorsa cizim sirasinda 0.5 sabit) */
  p: number;
  /** Noktanin olusma zamani (ms, performans saati) */
  t: number;
}

/** Kalem ekrana degdigi andan kaldirilana kadar olusan tek bir cizgi. */
export interface PenStroke {
  /** Nokta listesi (en az 1) */
  points: PenPoint[];
  /** Bu cizginin renk tonu - su an tek renk ("ink"); ileride genisletilebilir */
  color?: string;
  /** Cizgi kalinlik carpani (kullanici inceligi) - varsayilan 1 */
  width?: number;
}

/** Bir gunluk kaydina eklenen el yazisi katmani. */
export interface PenLayer {
  /** Vektor cizgiler */
  strokes: PenStroke[];
  /** Kaydin olusturuldugu andaki canvas en/boy orani (yeniden cizerken ipucu) */
  aspect?: number;
}

/** Bos katman kontrolu */
export function isEmptyPenLayer(layer: PenLayer | null | undefined): boolean {
  return !layer || !Array.isArray(layer.strokes) || layer.strokes.length === 0;
}

/** Toplam nokta sayisi (veri boyutu teshisi icin) */
export function countPenPoints(layer: PenLayer | null | undefined): number {
  if (!layer || !Array.isArray(layer.strokes)) return 0;
  let n = 0;
  for (const s of layer.strokes) n += Array.isArray(s.points) ? s.points.length : 0;
  return n;
}

/**
 * Kayitli/silinmis veriden GUVENLI katman uretir.
 * - Bozuk/eksik alanlar ayiklanir (x,y sayi ve 0..1 araliginda olmali)
 * - Noktasi olmayan cizgiler atilir
 * Eski (stroke'suz) gunluk kayitlari ile geriye donuk uyumluluk saglar.
 */
export function sanitizePenLayer(input: unknown): PenLayer | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as { strokes?: unknown; aspect?: unknown };
  if (!Array.isArray(raw.strokes)) return null;

  const strokes: PenStroke[] = [];
  for (const s of raw.strokes) {
    if (!s || typeof s !== "object") continue;
    const so = s as { points?: unknown; color?: unknown; width?: unknown };
    if (!Array.isArray(so.points)) continue;

    const points: PenPoint[] = [];
    for (const pt of so.points) {
      if (!pt || typeof pt !== "object") continue;
      const po = pt as { x?: unknown; y?: unknown; p?: unknown; t?: unknown };
      const x = typeof po.x === "number" ? po.x : NaN;
      const y = typeof po.y === "number" ? po.y : NaN;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      // 0..1 disindaysa kirp (bozuk veri ekrani bozmasin)
      const cx = Math.min(1, Math.max(0, x));
      const cy = Math.min(1, Math.max(0, y));
      const p = typeof po.p === "number" && Number.isFinite(po.p) ? Math.min(1, Math.max(0, po.p)) : 0.5;
      const t = typeof po.t === "number" && Number.isFinite(po.t) ? po.t : 0;
      points.push({ x: cx, y: cy, p, t });
    }
    if (!points.length) continue;

    strokes.push({
      points,
      color: typeof so.color === "string" ? so.color : undefined,
      width: typeof so.width === "number" && Number.isFinite(so.width) ? so.width : undefined,
    });
  }

  if (!strokes.length) return null;
  const aspect = typeof raw.aspect === "number" && Number.isFinite(raw.aspect) && raw.aspect > 0
    ? raw.aspect
    : undefined;
  return { strokes, aspect };
}
