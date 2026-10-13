import { useEffect, useMemo, useState } from "react";
import { t } from "../i18n";
import { isValidDate } from "../model/calendar";
import { ganttImage, ganttPages, type ExportScale, type GanttExportOptions, type Orientation, type PageSize } from "../model/ganttSvg";
import type { Baseline, Project, Schedule } from "../model/types";
import { downloadBlob, fileNameFor } from "../download";
import { DateInput } from "./DateInput";
import { PrintPreview } from "./PrintPreview";

interface Props {
  project: Project;
  schedule: Schedule;
  today: string;
  baseline?: Baseline;
  /** Tabloda görünen satırlar (süzgeç / kapalı özetler); tümünden azsa seçenek olarak sunulur */
  visible: number[];
  onClose: () => void;
  flash: (text: string) => void;
}

const SCALES: ExportScale[] = ["day", "week", "month", "fit"];

/** Gantt'ı PNG ya da PDF (yazdırma) olarak dışa aktar: ölçek, tarih aralığı, kağıt boyutu ve yönü seçilir */
export function GanttExportDialog({ project, schedule, today, baseline, visible, onClose, flash }: Props) {
  const [from, setFrom] = useState(project.start);
  const [to, setTo] = useState(schedule.finishDate);
  const [scale, setScale] = useState<ExportScale>("week");
  const [size, setSize] = useState<PageSize>("A4");
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [withBaseline, setWithBaseline] = useState(!!baseline);
  const [onlyVisible, setOnlyVisible] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !printing && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, printing]);

  const rangeOk = isValidDate(from) && isValidDate(to) && from <= to;
  const opts: GanttExportOptions = {
    from,
    to,
    scale,
    size,
    orientation,
    today,
    title: project.name,
    baseline: withBaseline ? baseline : undefined,
    indexes: onlyVisible ? visible : undefined,
  };
  const pages = useMemo(() => (rangeOk ? ganttPages(project, schedule, opts) : []), [project, schedule, rangeOk, from, to, scale, size, orientation, withBaseline, onlyVisible, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const savePng = async () => {
    setBusy(true);
    try {
      const { svg, width, height } = ganttImage(project, schedule, opts);
      // Tarayıcı tuvalinin sınırı (~16 bin piksel) aşılmasın; küçük görüntü 2 kat çözünürlükle
      const ratio = Math.min(2, 16_000 / Math.max(width, height));
      const img = new Image();
      img.src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      const ctx = canvas.getContext("2d")!;
      ctx.scale(ratio, ratio);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(img.src);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("png");
      downloadBlob(blob, fileNameFor([project.name, "Gantt", today], "png"));
    } catch {
      flash(t("gexport.pngFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop" onMouseDown={onClose} hidden={printing}>
        <div className="modal wide" role="dialog" aria-modal="true" aria-labelledby="gexport-title" onMouseDown={(e) => e.stopPropagation()}>
          <h2 id="gexport-title">{t("gexport.title")}</h2>
          <p className="modal-note">{t("gexport.note")}</p>
          <div className="settings">
            <div className="field-row">
              <label className="field">
                <span>{t("gexport.from")}</span>
                <DateInput value={from} ariaLabel={t("gexport.from")} onChange={setFrom} />
              </label>
              <label className="field">
                <span>{t("gexport.to")}</span>
                <DateInput value={to} ariaLabel={t("gexport.to")} onChange={setTo} />
              </label>
              <label className="field">
                <span>{t("gexport.scale")}</span>
                <select value={scale} onChange={(e) => setScale(e.target.value as ExportScale)}>
                  {SCALES.map((s) => (
                    <option key={s} value={s}>
                      {t(`gexport.scale.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span>{t("print.size")}</span>
                <select value={size} onChange={(e) => setSize(e.target.value as PageSize)}>
                  <option value="A4">A4</option>
                  <option value="A3">A3</option>
                </select>
              </label>
              <label className="field">
                <span>{t("print.orientation")}</span>
                <select value={orientation} onChange={(e) => setOrientation(e.target.value as Orientation)}>
                  <option value="landscape">{t("print.landscape")}</option>
                  <option value="portrait">{t("print.portrait")}</option>
                </select>
              </label>
            </div>
            {baseline && (
              <label className="check">
                <input type="checkbox" checked={withBaseline} onChange={(e) => setWithBaseline(e.target.checked)} />
                <span>{t("gexport.baseline", { name: baseline.name })}</span>
              </label>
            )}
            {visible.length < project.tasks.length && (
              <label className="check">
                <input type="checkbox" checked={onlyVisible} onChange={(e) => setOnlyVisible(e.target.checked)} />
                <span>{t("gexport.onlyVisible", { n: visible.length, total: project.tasks.length })}</span>
              </label>
            )}
            {!rangeOk && (
              <p className="form-error" role="alert">
                {t("gexport.badRange")}
              </p>
            )}
            {rangeOk && (
              <div className="gexport-preview" aria-label={t("gexport.preview")}>
                <div className="gexport-page" dangerouslySetInnerHTML={{ __html: pages[0] ?? "" }} />
                <small>{t("gexport.pages", { n: pages.length })}</small>
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button onClick={onClose}>{t("common.close")}</button>
            <button disabled={!rangeOk || busy} onClick={() => void savePng()}>
              {t("gexport.png")}
            </button>
            <button className="primary" disabled={!rangeOk} onClick={() => setPrinting(true)}>
              {t("gexport.pdf")}
            </button>
          </div>
        </div>
      </div>
      {printing && (
        <PrintPreview
          title={`${project.name} · Gantt`}
          size={size}
          orientation={orientation}
          onSize={setSize}
          onOrientation={setOrientation}
          pages={pages}
          onClose={() => setPrinting(false)}
        />
      )}
    </>
  );
}
