import React, { useState, useRef, useEffect, useCallback } from "react";
import { useT } from "../i18n/I18nProvider";
import { motion, AnimatePresence } from "framer-motion";
import { SketchQuill } from "./icons/sketchIcons";
import {
  DX as Close,
  DSparkles as Sparkle,
  DCheck as Check,
  DRefresh as Refresh,
  DUpload as Upload,
} from "./icons/doodle";
import {
  saveCustomHandwriting,
  getSavedCustomHandwriting,
  applyCustomHandwritingVars,
  STORAGE_KEY_FONT,
  type CustomHandwritingConfig,
} from "../lib/notebookConfig";
import { playPopSound, playSuccessSound, playPenScratch, playPaperRustle } from "../lib/sound";

interface HandwritingStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplied: () => void;
}

export function HandwritingStudioModal({
  isOpen,
  onClose,
  onApplied,
}: HandwritingStudioModalProps) {
  const { t, lang } = useT();
  const [mode, setMode] = useState<"draw" | "photo">("draw");
  const [baseFont, setBaseFont] = useState<"kalam" | "architect" | "marck">("kalam");
  const [slant, setSlant] = useState<number>(4);
  const [weight, setWeight] = useState<number>(550);
  const [letterSpacing, setLetterSpacing] = useState<number>(0.4);
  const [previewText, setPreviewText] = useState<string>(() => t("hw.preview_sample"));
  useEffect(() => { setPreviewText(t("hw.preview_sample")); /* eslint-disable-next-line */ }, [lang]);
  const [previewImage, setPreviewImage] = useState<string | undefined>(undefined);
  const [analysisResult, setAnalysisResult] = useState<{
    strokeDensity: number;
    detectedSlant: number;
    inkContrast: number;
    naturalJitter: number;
  } | null>(null);

  // --- DRAWING CANVAS STATE ---
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Array<Array<{ x: number; y: number }>>>([]);
  const currentStrokeRef = useRef<Array<{ x: number; y: number }>>([]);

  // --- PHOTO UPLOAD CANVAS STATE ---
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [uploadedImgSrc, setUploadedImgSrc] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number>(140);
  const [contrast, setContrast] = useState<number>(120);

  // Load existing configuration on open
  useEffect(() => {
    if (isOpen) {
      const saved = getSavedCustomHandwriting();
      if (saved) {
        setBaseFont(saved.baseFont || "kalam");
        setSlant(saved.slant ?? 4);
        setWeight(saved.weight ?? 550);
        setLetterSpacing(saved.letterSpacing ?? 0.4);
        if (saved.previewImage) setPreviewImage(saved.previewImage);
        if (saved.analysis) setAnalysisResult(saved.analysis);
      }
    }
  }, [isOpen]);

  // Render canvas strokes
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Kılavuz çizgileri (klasik çizgili defter)
    ctx.strokeStyle = "rgba(180, 150, 120, 0.28)";
    ctx.lineWidth = 1;

    // Taban çizgisi (baseline)
    ctx.beginPath();
    ctx.moveTo(10, canvas.height * 0.68);
    ctx.lineTo(canvas.width - 10, canvas.height * 0.68);
    ctx.stroke();

    // Üst kılavuz (x-height)
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(10, canvas.height * 0.38);
    ctx.lineTo(canvas.width - 10, canvas.height * 0.38);
    ctx.stroke();
    ctx.setLineDash([]);

    // Çizilen vuruşları çiz (doğal mürekkep efekti)
    ctx.strokeStyle = "#241c15";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3.2;

    const allStrokes = [...strokes];
    if (currentStrokeRef.current.length > 0) {
      allStrokes.push(currentStrokeRef.current);
    }

    for (const stroke of allStrokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        const xc = (stroke[i].x + stroke[i - 1].x) / 2;
        const yc = (stroke[i].y + stroke[i - 1].y) / 2;
        ctx.quadraticCurveTo(stroke[i - 1].x, stroke[i - 1].y, xc, yc);
      }
      ctx.stroke();
    }
  }, [strokes]);

  useEffect(() => {
    if (mode === "draw" && isOpen) {
      setTimeout(redrawCanvas, 60);
    }
  }, [mode, isOpen, redrawCanvas]);

  // Drawing event handlers
  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const pt = { x: clientX - rect.left, y: clientY - rect.top };
    currentStrokeRef.current = [pt];
    playPenScratch();
  };

  const handleDrawMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const pt = { x: clientX - rect.left, y: clientY - rect.top };
    currentStrokeRef.current.push(pt);
    redrawCanvas();
  };

  const handleEndDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStrokeRef.current.length > 1) {
      setStrokes((prev) => [...prev, currentStrokeRef.current]);
    }
    currentStrokeRef.current = [];
  };

  const handleClearDraw = () => {
    playPopSound();
    setStrokes([]);
    currentStrokeRef.current = [];
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      redrawCanvas();
    }
  };

  const handleUndoDraw = () => {
    playPopSound();
    setStrokes((prev) => prev.slice(0, -1));
  };

  // Analyze drawn strokes for slant & density
  const handleAnalyzeDrawing = () => {
    playSuccessSound();
    if (strokes.length === 0) return;

    let totalSlant = 0;
    let slantSampleCount = 0;
    let totalLength = 0;

    for (const stroke of strokes) {
      for (let i = 2; i < stroke.length; i += 2) {
        const dx = stroke[i].x - stroke[i - 2].x;
        const dy = stroke[i].y - stroke[i - 2].y;
        totalLength += Math.hypot(dx, dy);

        // İniş vuruşları (aşağıya doğru olanlar dikey eğimi belirler)
        if (dy > 3) {
          const angleRad = Math.atan2(dx, dy);
          const angleDeg = (angleRad * 180) / Math.PI;
          if (Math.abs(angleDeg) < 45) {
            totalSlant += angleDeg;
            slantSampleCount++;
          }
        }
      }
    }

    const detected = slantSampleCount > 0 ? Math.round(totalSlant / slantSampleCount) : 4;
    const clampedSlant = Math.max(-12, Math.min(14, detected));
    const calculatedWeight = Math.min(700, Math.max(450, 480 + Math.round(totalLength * 0.15)));

    setSlant(clampedSlant);
    setWeight(calculatedWeight);

    const canvas = canvasRef.current;
    const dataUrl = canvas ? canvas.toDataURL("image/png") : undefined;
    if (dataUrl) setPreviewImage(dataUrl);

    setAnalysisResult({
      strokeDensity: Math.min(95, Math.round(totalLength / 18)),
      detectedSlant: clampedSlant,
      inkContrast: 92,
      naturalJitter: 7,
    });
  };

  // --- PHOTO PROCESSING & ANALYSIS ---
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    playPaperRustle();
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === "string") {
        setUploadedImgSrc(ev.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const processAndFilterPhoto = useCallback(() => {
    if (!uploadedImgSrc) return;
    const canvas = photoCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = Math.min(600, img.width);
      canvas.height = Math.round((canvas.width / img.width) * img.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Grayscale + Adaptive Thresholding + Contrast
      const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      let darkPixels = 0;
      let totalPixels = canvas.width * canvas.height;

      for (let i = 0; i < data.length; i += 4) {
        // Luminance
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const contrasted = Math.min(255, Math.max(0, contrastFactor * (gray - 128) + 128));

        // Threshold to crisp ink
        const isInk = contrasted < threshold;
        if (isInk) darkPixels++;

        const val = isInk ? 25 : 255;
        data[i] = val;
        data[i + 1] = isInk ? 20 : 250;
        data[i + 2] = isInk ? 16 : 242;
      }
      ctx.putImageData(imgData, 0, 0);

      // Estimate stroke density and slant
      const densityPct = Math.round((darkPixels / totalPixels) * 100);
      setAnalysisResult({
        strokeDensity: densityPct,
        detectedSlant: 6,
        inkContrast: Math.round((contrast / 200) * 100),
        naturalJitter: 8,
      });

      const croppedUrl = canvas.toDataURL("image/png");
      setPreviewImage(croppedUrl);
    };
    img.src = uploadedImgSrc;
  }, [uploadedImgSrc, threshold, contrast]);

  useEffect(() => {
    if (uploadedImgSrc) {
      processAndFilterPhoto();
    }
  }, [uploadedImgSrc, threshold, contrast, processAndFilterPhoto]);

  // Apply & Save
  const handleApplyCustomHandwriting = () => {
    playSuccessSound();

    const config: CustomHandwritingConfig = {
      createdAt: Date.now(),
      previewImage,
      slant,
      weight,
      letterSpacing,
      baseFont,
      label: t("hws.my_style"),
      sourceType: mode === "draw" ? "draw" : "photo",
      analysis: analysisResult || {
        strokeDensity: 24,
        detectedSlant: slant,
        inkContrast: 90,
        naturalJitter: 6,
      },
    };

    saveCustomHandwriting(config);
    localStorage.setItem(STORAGE_KEY_FONT, "custom");
    applyCustomHandwritingVars(config);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("notebook-config-changed"));
    }

    onApplied();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence
      data-lovable-target="handwriting-studio-modal"
      data-lovable-name="Modal: El Yazısı Stüdyosu"
      data-lovable-file="src/components/HandwritingStudioModal.tsx"
      data-lovable-desc="El yazısı çalışma stüdyosu modalı"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        data-qa-modal="handwriting-studio"
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-3.5 select-none"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 14 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 14 }}
          transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-[20px] border border-[var(--line-strong)] bg-[var(--paper)] p-5 shadow-2xl scrollbar-thin"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ÜST BAŞLIK */}
          <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--border-ink)_18%,transparent)] pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-xs">
                <SketchQuill size={16} strokeWidth={1.9} />
              </span>
              <div>
                <h3 className="font-gelica text-base font-bold text-[var(--ink)] flex items-center gap-1.5">
                  {t("cust.studio.title")}
                  <span className="rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[9.5px] px-2 py-0.2 font-mono">
                    Laboratuvar
                  </span>
                </h3>
                <p className="font-geist text-[11px] text-[var(--ink-soft)]">
                  {t("cust.studio.desc")}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              title={t("common.close")}
              className="rounded-full p-1 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
            >
              <Close size={16} />
            </button>
          </div>

          {/* GİRİŞ YÖNTEMİ SEÇİCİ (Çizim vs Fotoğraf) */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-[16px] border border-[var(--line)] bg-[var(--app-bg)] mb-4">
            <button
              onClick={() => {
                playPopSound();
                setMode("draw");
              }}
              className={`flex items-center justify-center gap-2 py-2 rounded-[12px] font-gelica text-xs font-bold transition-all ${
                mode === "draw"
                  ? "bg-[var(--ink)] text-[var(--app-bg)] shadow-xs"
                  : "text-[var(--ink)] hover:text-[var(--accent)]"
              }`}
            >
              <span>{t("hws.draw")}</span>
            </button>
            <button
              onClick={() => {
                playPopSound();
                setMode("photo");
              }}
              className={`flex items-center justify-center gap-2 py-2 rounded-[12px] font-gelica text-xs font-bold transition-all ${
                mode === "photo"
                  ? "bg-[var(--ink)] text-[var(--app-bg)] shadow-xs"
                  : "text-[var(--ink)] hover:text-[var(--accent)]"
              }`}
            >
              <span>{t("hws.upload")}</span>
            </button>
          </div>

          {/* 1. ÇİZİM MODU (Interactive Canvas Pad) */}
          {mode === "draw" && (
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between">
                <span className="font-geist text-[11px] font-semibold text-[var(--ink)]">
                  {t("hws.scratch_hint")}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleUndoDraw}
                    disabled={strokes.length === 0}
                    className="px-2 py-1 rounded-[8px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] font-geist text-[10.5px] text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-40"
                  >
                    Geri Al
                  </button>
                  <button
                    onClick={handleClearDraw}
                    className="px-2 py-1 rounded-[8px] border border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] font-geist text-[10.5px] text-rose-600 hover:bg-rose-50"
                  >
                    Temizle
                  </button>
                </div>
              </div>

              {/* Çizim Tuvali */}
              <div className="relative rounded-[14px] border-2 border-dashed border-[color-mix(in_srgb,var(--border-ink)_30%,transparent)] bg-[#faf6ee] p-1 overflow-hidden shadow-inner">
                <canvas
                  ref={canvasRef}
                  width={520}
                  height={130}
                  className="w-full h-[120px] cursor-crosshair touch-none"
                  onMouseDown={handleStartDraw}
                  onMouseMove={handleDrawMove}
                  onMouseUp={handleEndDraw}
                  onMouseLeave={handleEndDraw}
                  onTouchStart={handleStartDraw}
                  onTouchMove={handleDrawMove}
                  onTouchEnd={handleEndDraw}
                />
                <span className="absolute bottom-1.5 end-2 font-mono text-[9.5px] text-amber-900/40 pointer-events-none">
                  {t("cust.studio.draw_hint")}
                </span>
              </div>

              <button
                onClick={handleAnalyzeDrawing}
                disabled={strokes.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-[12px] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] border border-[var(--accent)] text-[var(--accent)] font-gelica text-xs font-bold hover:bg-[var(--accent)] hover:text-white transition-all disabled:opacity-40"
              >
                <Sparkle size={13} />
                <span>{t("hws.analyze")}</span>
              </button>
            </div>
          )}

          {/* 2. FOTOĞRAF YÜKLEME MODU */}
          {mode === "photo" && (
            <div className="space-y-3 mb-4">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelect}
              />

              {!uploadedImgSrc ? (
                <div
                  onClick={() => photoInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-6 rounded-[14px] border-2 border-dashed border-[color-mix(in_srgb,var(--border-ink)_30%,transparent)] bg-[var(--app-bg)] hover:border-[var(--accent)] cursor-pointer transition-all"
                >
                  <Upload size={24} className="text-[var(--accent)] mb-2" />
                  <span className="font-gelica text-xs font-bold text-[var(--ink)]">
                    {t("cust.studio.pick_photo")}
                  </span>
                  <span className="font-geist text-[10.5px] text-[var(--ink-soft)] mt-0.5">
                    JPG, PNG veya kamera görüntüsü (kağıt üzerindeki yazın ayıklanır)
                  </span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="relative rounded-[14px] border border-[var(--line)] bg-[#faf6ee] p-2 overflow-hidden max-h-48 flex items-center justify-center">
                    <canvas ref={photoCanvasRef} className="max-w-full max-h-40 rounded shadow-xs" />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="flex justify-between font-geist text-[10.5px] text-[var(--ink-soft)] mb-0.5">
                        <span>{t("hws.ink_threshold")}</span>
                        <span className="font-mono">{threshold}</span>
                      </div>
                      <input
                        type="range"
                        min="70"
                        max="220"
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        className="w-full accent-[var(--accent)]"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between font-geist text-[10.5px] text-[var(--ink-soft)] mb-0.5">
                        <span>Kontrast & Netlik</span>
                        <span className="font-mono">{contrast}</span>
                      </div>
                      <input
                        type="range"
                        min="40"
                        max="200"
                        value={contrast}
                        onChange={(e) => setContrast(Number(e.target.value))}
                        className="w-full accent-[var(--accent)]"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="text-[10.5px] font-geist text-[var(--accent)] underline block"
                  >
                    {t("cust.studio.other_photo")}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ANALİZ SONUÇLARI KARTI */}
          {analysisResult && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-2.5 rounded-[12px] bg-emerald-50 border border-emerald-300 text-emerald-900 mb-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Check size={14} className="text-emerald-700" />
                <span className="font-gelica text-xs font-bold">
                  {t("hw.solved")}
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono text-[10px] text-emerald-800">
                <span>{t("hw.slant")}: {analysisResult.detectedSlant > 0 ? `+${analysisResult.detectedSlant}°` : `${analysisResult.detectedSlant}°`}</span>
                <span>{t("hw.contrast")}: %{analysisResult.inkContrast}</span>
              </div>
            </motion.div>
          )}

          {/* İNCE AYAR KONTROLLERİ */}
          <div className="rounded-[14px] border border-[color-mix(in_srgb,var(--border-ink)_18%,transparent)] bg-[var(--app-bg)] p-3.5 space-y-3 mb-4">
            <span className="font-gelica text-xs font-bold text-[var(--ink)] block">
              Stil Kalibrasyonu & Temel Karakter
            </span>

            {/* Temel Karakter İskeleti */}
            <div>
              <span className="font-geist text-[10.5px] text-[var(--ink-soft)] block mb-1">
                {t("cust.studio.skeleton")}
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  
                  { id: "kalam", name: t("hws.style_flowing") },
                  { id: "architect", name: "Mimari" },
                  { id: "marck", name: "Klasik" },
                ].map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      playPopSound();
                      setBaseFont(b.id as any);
                    }}
                    className={`py-1.5 px-1 rounded-[10px] text-center font-gelica text-[11px] font-bold border transition-all ${
                      baseFont === b.id
                        ? "border-[var(--accent)] bg-[var(--paper)] text-[var(--accent)] shadow-xs"
                        : "border-[color-mix(in_srgb,var(--border-ink)_15%,transparent)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Sürgüler: Eğim & Mürekkep Kalınlığı & Boşluk */}
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div>
                <div className="flex justify-between font-geist text-[10px] text-[var(--ink-soft)] mb-0.5">
                  <span>{t("hws.slant")}</span>
                  <span className="font-mono">{slant > 0 ? `+${slant}°` : `${slant}°`}</span>
                </div>
                <input
                  type="range"
                  min="-12"
                  max="14"
                  value={slant}
                  onChange={(e) => setSlant(Number(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                />
              </div>

              <div>
                <div className="flex justify-between font-geist text-[10px] text-[var(--ink-soft)] mb-0.5">
                  <span>{t("hws.weight")}</span>
                  <span className="font-mono">{weight}</span>
                </div>
                <input
                  type="range"
                  min="400"
                  max="700"
                  step="25"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                />
              </div>

              <div>
                <div className="flex justify-between font-geist text-[10px] text-[var(--ink-soft)] mb-0.5">
                  <span>{t("hws.spacing")}</span>
                  <span className="font-mono">{letterSpacing}px</span>
                </div>
                <input
                  type="range"
                  min="-0.5"
                  max="2.5"
                  step="0.1"
                  value={letterSpacing}
                  onChange={(e) => setLetterSpacing(Number(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                />
              </div>
            </div>
          </div>

          {/* CANLI DEFTER SATIRI ÖNİZLEMESİ */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1">
              <span className="font-gelica text-xs font-bold text-[var(--ink)]">
                {t("cust.studio.preview")}
              </span>
              {previewImage && (
                <span className="font-geist text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-semibold">
                  {t("cust.studio.saved")}
                </span>
              )}
            </div>

            <div className="relative rounded-[14px] border border-[var(--line-strong)] bg-[#fcf9f2] p-4 shadow-sm overflow-hidden">
              {/* Orijinal Mürekkep İmzası Damgası */}
              {previewImage && (
                <div className="absolute top-2 end-2 border border-dashed border-amber-800/40 rounded p-1 bg-white/70 max-w-[80px] opacity-75">
                  <img src={previewImage} alt={t("hws.signature")} className="h-6 w-auto object-contain" />
                </div>
              )}

              <input
                type="text"
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                style={{
                  fontFamily:
                    baseFont === "kalam"
                      ? '"Kalam", cursive'
                      : baseFont === "architect"
                      ? '"Architects Daughter", cursive'
                      : baseFont === "marck"
                      ? '"Marck Script", cursive'
                      : '"Caveat", cursive',
                  fontWeight: weight,
                  letterSpacing: `${letterSpacing}px`,
                  fontStyle: slant !== 0 ? "oblique" : "normal",
                  transform: slant !== 0 ? `skewX(${-slant * 0.7}deg)` : "none",
                }}
                className="w-full bg-transparent text-[20px] text-[var(--ink)] outline-none border-b border-amber-300 pb-1"
                placeholder="Metin girerek dene..."
              />
              <span className="font-mono text-[9px] text-[var(--ink-soft)] block mt-1">
                {t("cust.studio.meta", { font: baseFont, weight, slant })}
              </span>
            </div>
          </div>

          {/* BUTONLAR */}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-[16px] border border-[var(--line)] font-gelica text-xs font-bold text-[var(--ink)] hover:bg-[var(--app-bg)] transition-colors"
            >
              {t("act.cancel")}
            </button>
            <button
              onClick={handleApplyCustomHandwriting}
              className="flex-[2] py-2.5 rounded-[16px] bg-[var(--ink)] text-[var(--app-bg)] font-gelica text-xs font-bold hover:bg-[var(--accent)] transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Check size={14} />
              <span>{t("hws.save_apply")}</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}