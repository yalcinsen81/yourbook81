import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { t } from "../i18n";
import type { Orientation, PageSize } from "../model/ganttSvg";
import { Icon } from "./icons";

interface Props {
  title: string;
  /** Kağıt; sayfa içeriği hazır SVG sayfalarıysa kenar boşluğu 0 olur */
  size: PageSize;
  orientation: Orientation;
  onOrientation?: (o: Orientation) => void;
  onSize?: (s: PageSize) => void;
  /** Hazır sayfalar (Gantt): her biri bir kağıt */
  pages?: string[];
  /** Akan içerik (rapor tablosu): tarayıcı sayfalara böler */
  children?: ReactNode;
  onClose: () => void;
}

const MM = { A4: [297, 210], A3: [420, 297] } as const;

/**
 * Yazdırma önizlemesi: içerik kağıt boyutunda gösterilir; "Yazdır / PDF" tarayıcının yazdırma penceresini açar
 * ("PDF olarak kaydet" hedefiyle PDF olur). Uygulama yazdırırken gizlenir, yalnızca önizleme basılır.
 */
export function PrintPreview({ title, size, orientation, onOrientation, onSize, pages, children, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.classList.add("printing");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("printing");
    };
  }, [onClose]);

  const [long, short] = MM[size];
  const w = orientation === "landscape" ? long : short;
  const h = orientation === "landscape" ? short : long;
  // Hazır sayfalarda kenar boşluğu sayfanın içindedir
  const margin = pages ? "0" : "12mm";
  const pageCss = `@page { size: ${size} ${orientation}; margin: ${margin}; }`;

  return createPortal(
    <div className="print-overlay" role="dialog" aria-modal="true" aria-label={t("print.title", { title })}>
      <style>{pageCss}</style>
      <div className="print-toolbar">
        <strong>{t("print.title", { title })}</strong>
        {onSize && (
          <select value={size} onChange={(e) => onSize(e.target.value as PageSize)} aria-label={t("print.size")}>
            <option value="A4">A4</option>
            <option value="A3">A3</option>
          </select>
        )}
        {onOrientation && (
          <select value={orientation} onChange={(e) => onOrientation(e.target.value as Orientation)} aria-label={t("print.orientation")}>
            <option value="landscape">{t("print.landscape")}</option>
            <option value="portrait">{t("print.portrait")}</option>
          </select>
        )}
        <span className="print-hint">{t("print.hint")}</span>
        <span className="spacer" />
        <button className="primary" onClick={() => window.print()} autoFocus>
          <Icon name="download" size={15} />
          {t("print.print")}
        </button>
        <button onClick={onClose}>{t("common.close")}</button>
      </div>
      <div className="print-area">
        {pages ? (
          pages.map((svg, i) => (
            <div key={i} className="print-page fixed" style={{ width: `${w}mm`, height: `${h}mm` }} dangerouslySetInnerHTML={{ __html: svg }} />
          ))
        ) : (
          <div className="print-page flow" style={{ width: `${w}mm`, minHeight: `${h}mm`, padding: "12mm" }}>
            {children}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
