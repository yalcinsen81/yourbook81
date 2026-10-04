import { memo, useEffect } from "react";
import { usePenCanvas } from "../lib/usePenCanvas";
import type { PenLayer } from "../lib/penTypes";
import { useT } from "../i18n/I18nProvider";

/* ==========================================================================
   KALEM YAZIM YUZEYI (canvas)
   ---------------------------------------------------------------------------
   - Kalem (pointerType "pen") ile dogrudan yazilir/cizilir.
   - Fare de calisir (test icin).
   - Parmak (touch) yazmaz; kalem yazarken AVUC REDDI uygulanir.
   - Veri VEKTOR olarak tutulur (bkz. lib/penTypes.ts).
   - Yalnizca gosterim: kayitli cizimi ayni sekilde yeniden cizer.
   ========================================================================== */

interface PenCanvasProps {
  /** Kayitli vektor katman (varsa) */
  value?: PenLayer | null;
  /** Degisince cagrilir (kaydetmek icin) */
  onLayerChange: (layer: PenLayer) => void;
  /** Defter kilavuz cizgileri */
  showGuide?: boolean;
  /** Salt okunur (akış/detay gorunumu) */
  readOnly?: boolean;
  /** Yukseklik sinifi */
  className?: string;
}

function PenCanvasInner({ value, onLayerChange, showGuide = true, readOnly = false, className }: PenCanvasProps) {
  const { t } = useT();
  // Salt okunur modda da hook kullanilir (yeniden cizim icin); olaylar baglanmaz.
  const api = usePenCanvas({
    initialLayer: value,
    onChange: readOnly ? undefined : onLayerChange,
    showGuide,
  });

  // Salt okunur modda pointer olaylari baglanmasin diye canvas'i isaretle
  useEffect(() => {
    const c = api.canvasRef.current;
    if (!c) return;
    if (readOnly) c.style.pointerEvents = "none";
    else c.style.pointerEvents = "auto";
  }, [api.canvasRef, readOnly]);

  const empty = api.strokeCount === 0;

  return (
    <div className={"relative w-full " + (className || "")}>
      <canvas
        ref={api.canvasRef}
        data-pen-canvas="1"
        className="block h-full w-full rounded-[10px] border-[1.5px] border-dashed border-[color-mix(in_srgb,var(--ink)_35%,transparent)] bg-[color-mix(in_srgb,var(--paper)_92%,transparent)]"
        style={{ minHeight: 180, height: "100%" }}
        aria-label={t("pen.canvas_label")}
      />

      {/* Bos durum ipucu - sadece yazilabilir modda ve bosken */}
      {!readOnly && empty && !api.isDrawing && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-55">
          <span className="font-handwritten text-[15px] text-[var(--ink)]">{t("pen.empty_hint")}</span>
          <span className="font-geist text-[10px] uppercase tracking-wider text-[var(--ink-soft)]">
            {t("pen.empty_hint_sub")}
          </span>
        </div>
      )}

      {/* Kalem algilandi rozeti */}
      {!readOnly && api.usingPen && (
        <span className="pointer-events-none absolute end-2 top-2 rounded-full bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] px-2 py-[2px] font-geist text-[9px] font-semibold uppercase tracking-wider text-[var(--accent)]">
          {t("pen.detected")}
        </span>
      )}
    </div>
  );
}

export const PenCanvas = memo(PenCanvasInner);
export default PenCanvas;
