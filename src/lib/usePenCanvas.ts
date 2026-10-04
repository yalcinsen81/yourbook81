import { useCallback, useEffect, useRef, useState } from "react";
import type { PenLayer, PenPoint, PenStroke } from "./penTypes";
import { sanitizePenLayer } from "./penTypes";

/* ==========================================================================
   KALEM / STYLUS CIZIM HOOK'U
   ---------------------------------------------------------------------------
   - Pointer Events API: pointerdown / pointermove / pointerup / pointercancel
   - event.pointerType === "pen"  -> kalem (asil hedef)
   - event.pointerType === "mouse"-> fare ile de CALISIR (test edilebilsin)
   - event.pointerType === "touch"-> AVUC/PARMA; kalem yazarken YOK SAYILIR
                                     (palm rejection)
   - event.pressure -> cizgi kalinligi hafif degisir. Desteklemeyen cihazda
                       0.5 sabit kullanilir (hata vermez).
   - Cizgiler QUADRATIC egri ile yumusatilir (kesik kesik gorunmez).
   ========================================================================== */

export interface PenCanvasOptions {
  /** Baslangic katmani (kayitli cizim) */
  initialLayer?: PenLayer | null;
  /** Her degisimde cagrilir (kaydetmek icin) */
  onChange?: (layer: PenLayer) => void;
  /** Izgara/kilavuz cizgileri goster (defeter gorunumu) */
  showGuide?: boolean;
}

export interface PenCanvasApi {
  /** canvas elementine baglanacak ref */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  /** Vektor veri (kaydetmek icin) */
  layer: PenLayer;
  /** Son cizimi geri al */
  undo: () => void;
  /** Hepsini temizle */
  clear: () => void;
  /** Kalem aktif mi (son pointerType === pen) */
  usingPen: boolean;
  /** Su an cizim yapiliyor mu */
  isDrawing: boolean;
  /** Cizgi sayisi */
  strokeCount: number;
}

/** Kalinlik: basinca gore hafif degisim (0.5 basinc = temel kalinlik) */
function pressureWidth(pressure: number, base: number): number {
  // 0.55x .. 1.45x arasi; basinc 0.5 ise ~1.0x
  const factor = 0.55 + Math.min(1, Math.max(0, pressure)) * 0.9;
  return base * factor;
}

/** Canvas'i yuksek DPI'da ayarla; normalize koordinatlari piksele cevirir. */
function fitCanvas(canvas: HTMLCanvasElement): { w: number; h: number; dpr: number } {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // 2 ile sinirla (bellek)
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  const pxW = Math.round(w * dpr);
  const pxH = Math.round(h * dpr);
  if (canvas.width !== pxW || canvas.height !== pxH) {
    canvas.width = pxW;
    canvas.height = pxH;
  }
  return { w, h, dpr };
}

/** Vektor katmanini canvas'a ciz (hem canli cizim hem yeniden gosterim). */
function paintLayer(
  canvas: HTMLCanvasElement,
  layer: PenLayer,
  opts: { showGuide?: boolean; liveStroke?: PenPoint[] | null; liveWidth?: number }
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { w, h, dpr } = fitCanvas(canvas);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Kilavuz cizgileri (defter hissi) - sadece gosterim amacli, veriye yazilmaz
  if (opts.showGuide) {
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.07)";
    ctx.lineWidth = 1;
    const gap = 34;
    for (let y = gap; y < h; y += gap) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  const ink =
    getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() ||
    "#1c1917";

  const drawPoints = (points: PenPoint[], widthMul: number) => {
    if (!points.length) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (points.length === 1) {
      // tek nokta -> kucuk daire
      const p0 = points[0];
      ctx.beginPath();
      ctx.arc(p0.x * w, p0.y * h, pressureWidth(p0.p, 1.4) * widthMul, 0, Math.PI * 2);
      ctx.fillStyle = ink;
      ctx.fill();
      return;
    }

    // Basinca gore degisen kalinlik icin segment segment ciz (quadratic egri ile yumusak)
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const mx = ((a.x + b.x) / 2) * w;
      const my = ((a.y + b.y) / 2) * h;

      ctx.beginPath();
      ctx.strokeStyle = ink;
      ctx.lineWidth = pressureWidth(b.p, 2.1) * widthMul;
      if (i === 1) {
        ctx.moveTo(a.x * w, a.y * h);
      } else {
        const prev = points[i - 2];
        ctx.moveTo(((prev.x + a.x) / 2) * w, ((prev.y + a.y) / 2) * h);
      }
      ctx.quadraticCurveTo(a.x * w, a.y * h, mx, my);
      ctx.stroke();
    }
  };

  for (const s of layer.strokes) drawPoints(s.points, s.width ?? 1);
  if (opts.liveStroke && opts.liveStroke.length) {
    drawPoints(opts.liveStroke, opts.liveWidth ?? 1);
  }
}

export function usePenCanvas(options: PenCanvasOptions = {}): PenCanvasApi {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [layer, setLayer] = useState<PenLayer>(() => sanitizePenLayer(options.initialLayer) ?? { strokes: [] });
  const [isDrawing, setIsDrawing] = useState(false);
  const [usingPen, setUsingPen] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);

  // Canli cizim tamponu (state degil -> her noktada render tetiklenmez)
  const liveRef = useRef<PenPoint[] | null>(null);
  const layerRef = useRef<PenLayer>(layer);
  // Palm rejection: kalem son gorulme zamani
  const lastPenAtRef = useRef<number>(0);
  const activePointerIdRef = useRef<number | null>(null);
  const activeTypeRef = useRef<string | null>(null);
  const onChangeRef = useRef(options.onChange);
  onChangeRef.current = options.onChange;
  const showGuideRef = useRef(!!options.showGuide);
  showGuideRef.current = !!options.showGuide;

  layerRef.current = layer;

  const repaint = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    paintLayer(c, layerRef.current, {
      showGuide: showGuideRef.current,
      liveStroke: liveRef.current,
      liveWidth: 1,
    });
  }, []);

  /** Canvas olcusunu pencere/kapla degisiminde yeniden ciz. */
  useEffect(() => {
    repaint();
    const c = canvasRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => repaint());
    try {
      ro.observe(c);
    } catch {
      /* eski tarayici: sorun degil */
    }
    window.addEventListener("resize", repaint);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", repaint);
    };
  }, [repaint]);

  /** Kayitli katman disaridan degisirse (baska gun secilince) yenile. */
  useEffect(() => {
    const next = sanitizePenLayer(options.initialLayer) ?? { strokes: [] };
    setLayer(next);
    layerRef.current = next;
    repaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.initialLayer]);

  const commit = useCallback((strokes: PenStroke[]) => {
    const next: PenLayer = {
      strokes,
      aspect: canvasRef.current
        ? canvasRef.current.getBoundingClientRect().width / Math.max(1, canvasRef.current.getBoundingClientRect().height)
        : undefined,
    };
    layerRef.current = next;
    setLayer(next);
    setStrokeCount(strokes.length);
    onChangeRef.current?.(next);
    repaint();
  }, [repaint]);

  /* ------------------------- Pointer olaylari ------------------------- */
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const toPoint = (e: PointerEvent): PenPoint => {
      const r = c.getBoundingClientRect();
      return {
        x: Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width))),
        y: Math.min(1, Math.max(0, (e.clientY - r.top) / Math.max(1, r.height))),
        // Basinc desteklenmiyorsa 0 gelir ya da 0.5 sabit
        p: typeof e.pressure === "number" && e.pressure > 0 ? e.pressure : 0.5,
        t: Math.round(performance.now()),
      };
    };

    const onDown = (e: PointerEvent) => {
      const type = e.pointerType || "mouse";
      if (type === "pen") lastPenAtRef.current = performance.now();

      // AVUC/PARMA REDDI: kalem son 700ms icinde gorulduyse touch event'i yok say
      if (type === "touch" && performance.now() - lastPenAtRef.current < 700) {
        return;
      }
      // Zaten aktif bir cizim varsa ikinci pointer'a izin verme
      if (activePointerIdRef.current !== null) return;

      activePointerIdRef.current = e.pointerId;
      activeTypeRef.current = type;
      setUsingPen(type === "pen");
      setIsDrawing(true);
      liveRef.current = [toPoint(e)];
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* bazi tarayicilar */
      }
      e.preventDefault();
      repaint();
    };

    const onMove = (e: PointerEvent) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      const type = e.pointerType || "mouse";
      if (type === "pen") lastPenAtRef.current = performance.now();
      // Cizim sirasinda touch geldiyse (avuç) yok say
      if (type === "touch" && performance.now() - lastPenAtRef.current < 700) return;

      const pts = liveRef.current;
      if (!pts) return;
      const p = toPoint(e);
      const last = pts[pts.length - 1];
      // Cok yakin noktalari atla (veri kucuk kalsin, cizgi akici olsun)
      const dx = (p.x - last.x) * c.getBoundingClientRect().width;
      const dy = (p.y - last.y) * c.getBoundingClientRect().height;
      if (dx * dx + dy * dy < 1.2) return;
      pts.push(p);
      repaint();
      e.preventDefault();
    };

    const finish = (e: PointerEvent) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      const pts = liveRef.current;
      activePointerIdRef.current = null;
      activeTypeRef.current = null;
      setIsDrawing(false);
      liveRef.current = null;

      if (pts && pts.length) {
        const strokes = layerRef.current.strokes.slice();
        strokes.push({ points: pts });
        commit(strokes);
      } else {
        repaint();
      }
      try {
        c.releasePointerCapture(e.pointerId);
      } catch {
        /* yok say */
      }
    };

    const onCancel = (e: PointerEvent) => {
      if (activePointerIdRef.current !== e.pointerId) return;
      activePointerIdRef.current = null;
      activeTypeRef.current = null;
      liveRef.current = null;
      setIsDrawing(false);
      repaint();
    };

    // touch-action: none -> tarayici kaydirma/zoom yapmasin (kalem icin sart)
    const prevTouchAction = c.style.touchAction;
    c.style.touchAction = "none";

    c.addEventListener("pointerdown", onDown);
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerup", finish);
    c.addEventListener("pointercancel", onCancel);
    c.addEventListener("pointerleave", onCancel);

    return () => {
      c.style.touchAction = prevTouchAction;
      c.removeEventListener("pointerdown", onDown);
      c.removeEventListener("pointermove", onMove);
      c.removeEventListener("pointerup", finish);
      c.removeEventListener("pointercancel", onCancel);
      c.removeEventListener("pointerleave", onCancel);
    };
  }, [commit, repaint]);

  const undo = useCallback(() => {
    const strokes = layerRef.current.strokes.slice(0, -1);
    commit(strokes);
  }, [commit]);

  const clear = useCallback(() => {
    commit([]);
  }, [commit]);

  return { canvasRef, layer, undo, clear, usingPen, isDrawing, strokeCount };
}
