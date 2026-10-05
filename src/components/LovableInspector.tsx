import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  DBox as Box,
  DCheck as Check,
  DCopy as Copy,
  DCrosshair as Crosshair,
  DWand as Wand2,
  DX as X,
} from "./icons/doodle";
import { playPopSound, playSuccessSound } from "../lib/sound";

export interface InspectedElement {
  /** Aynı öğe iki kez seçilmesin diye kararlı bir anahtar. */
  key: string;
  /** En yakın etiketli (data-lovable-target) kapsayıcının id'si, varsa. */
  taggedId?: string;
  /** Okunabilir isim — örn. "Hero Alt Paragraf". */
  name: string;
  /** Kaynak dosya — etiketten gelir; yoksa "(etiket yok)". */
  file: string;
  /** Kısa açıklama. */
  description: string;
  elementTag: string;
  previewText?: string;
  /** Seçim anındaki ölçüler, kullanıcı neyi seçtiğini anlasın diye. */
  width?: number;
  height?: number;
  /** Sınıf listesi (kısaltılmış) — öğeyi tanımayı kolaylaştır. */
  classes?: string;
  /** Seçildiği andaki canlı DOM referansı — konumu buradan okunur. */
  el?: HTMLElement | null;
}

/** Bir öğeden okunabilir bir metin çıkarır (placeholder/title/aria dahil). */
function textOf(el: HTMLElement, max = 60): string {
  const raw = (
    el.innerText ||
    el.getAttribute("placeholder") ||
    el.getAttribute("aria-label") ||
    el.getAttribute("alt") ||
    el.getAttribute("title") ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
  return raw.slice(0, max);
}

/**
 * Öğenin DOM yolundan kararlı bir anahtar üretir.
 * Etiketli bir ata varsa onu tercih eder (iç çocuklar aynı anahtarı paylaşsın).
 */
function elementKey(el: HTMLElement): string {
  const tagged = el.closest("[data-lovable-target]") as HTMLElement | null;
  if (tagged) {
    const id = tagged.getAttribute("data-lovable-target");
    if (id) return "t:" + id;
  }
  const parts: string[] = [];
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) break;
    const idx = Array.prototype.indexOf.call(parent.children, node);
    parts.unshift(node.tagName + ":" + idx);
    node = parent;
  }
  return parts.join("/");
}

/**
 * Etiketli en yakın ATAYI bulur (öğenin kendisi dahil).
 * Etiket yoksa null döner.
 */
function taggedAncestor(el: HTMLElement): HTMLElement | null {
  return el.closest("[data-lovable-target]") as HTMLElement | null;
}

/**
 * Anlamsız isim üretmeyi engeller: yalnızca rakam/noktalama veya çok kısa
 * metinleri isim olarak kullanmaz.
 */
function isMeaningfulText(t: string): boolean {
  if (!t) return false;
  const letters = t.replace(/[^\p{L}]/gu, "");
  // En az 3 harf olmalı ve tek başına sayı olmamalı
  return letters.length >= 3;
}

/** Öğe için okunabilir isim + açıklama + dosya üretir. */
function describeElement(el: HTMLElement): {
  name: string;
  description: string;
  file: string;
  taggedId?: string;
} {
  // 1) En yakın etiketli ata — varsa onun bilgileri BİRİNCİL kaynaktır.
  const tagged = taggedAncestor(el);
  if (tagged) {
    const taggedId = tagged.getAttribute("data-lovable-target") || undefined;
    const tagName = tagged.getAttribute("data-lovable-name");
    const tagFile = tagged.getAttribute("data-lovable-file");
    const tagDesc = tagged.getAttribute("data-lovable-desc");

    // Öğe etiketli kökün KENDİSİ mi, yoksa içindeki bir çocuk mu?
    const isRoot = el === tagged;
    let name = tagName || taggedId || "Etiketli Öğe";
    let description = tagDesc || "etiketli arayüz bölümü";

    if (!isRoot) {
      // Çocuk öğe: bölüm adını koru. Öğenin kendi metni bölüm adıyla AYNIYSA
      // tekrar etme — aksi hâlde etiket gereksiz uzuyor ve taşıyor.
      const t = textOf(el, 40);
      const tag = el.tagName.toLowerCase();
      /**
       * Öğenin metni bölüm adında geçiyor mu?
       * Tam string eşleşmesi yetmez: "Menü: Günlük Notlar & Görevler" ile
       * "günlük notlar ve görevler" farklı ("&" vs "ve", baştaki "Menü:").
       * Bu yüzden KELİME bazlı kapsama oranına bakıyoruz.
       */
      const words = (x: string) =>
        x
          .toLocaleLowerCase("tr")
          .replace(/[^\p{L}\p{N}\s]/gu, " ")
          .split(/\s+/)
          .filter((w) => w.length > 2);
      const nameWords = new Set(words(name));
      const tWords = words(t);
      const covered =
        tWords.length > 0 &&
        tWords.filter((w) => nameWords.has(w)).length >= Math.ceil(tWords.length * 0.6);
      const alreadyInName = t.length > 2 && covered;

      let part = "";
      if (alreadyInName) {
        // Bölüm adı zaten bu metni içeriyor; yalnızca tür farkı varsa belirt.
        if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) part = "başlık";
        else if (tag === "img" || tag === "svg" || tag === "path") part = "ikon";
        else part = "";
      } else if (tag === "button" || el.closest("button") === el) {
        part = t ? `buton "${t}"` : "buton";
      } else if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
        part = t ? `başlık "${t}"` : `${tag} başlığı`;
      } else if (tag === "img" || tag === "svg" || tag === "path") {
        part = "ikon / görsel";
      } else if (tag === "input" || tag === "textarea" || tag === "select") {
        part = `giriş alanı "${el.getAttribute("placeholder") || ""}"`.trim();
      } else if (isMeaningfulText(t)) {
        part = `"${t}"`;
      } else {
        part = `<${tag}>`;
      }

      if (part) name = `${name} → ${part}`;
      description = tagDesc || "etiketli arayüz bölümü";
    }

    return {
      name,
      description,
      file: tagFile || "(bu bölümde data-lovable-file yok)",
      taggedId,
    };
  }

  // 2) Etiket yok — tip bazlı makul bir tahmin.
  const tag = el.tagName.toLowerCase();
  const t = textOf(el, 40);

  if (tag === "button" || el.closest("button") === el) {
    const btn = (tag === "button" ? el : el.closest("button")!) as HTMLElement;
    const bt = textOf(btn, 30);
    return {
      name: bt ? `Buton: "${bt}"` : "Buton (etiketsiz)",
      description:
        "tıklanabilir buton — bu öğeye data-lovable-file eklenirse dosya adı görünür",
      file: "(etiket yok)",
    };
  }
  if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
    return {
      name: isMeaningfulText(t) ? `Başlık: "${t}"` : `${tag.toUpperCase()} başlık`,
      description: "metin başlığı",
      file: "(etiket yok)",
    };
  }
  if (tag === "img" || tag === "svg" || tag === "path") {
    return { name: "Görsel / ikon", description: "görsel veya ikon", file: "(etiket yok)" };
  }
  if (tag === "input" || tag === "textarea" || tag === "select") {
    const ph = el.getAttribute("placeholder") || "";
    return {
      name: ph ? `Giriş Alanı ("${ph}")` : "Giriş Alanı",
      description: "kullanıcı veri girişi",
      file: "(etiket yok)",
    };
  }

  // aside / nav içinde ama etiketsiz — sayı uydurma, anlamlıysa metni kullan.
  if (el.closest("aside") || el.closest("nav")) {
    return {
      name: isMeaningfulText(t) ? `Menü: "${t}"` : `Menü öğesi <${tag}>`,
      description: "gezinme öğesi (etiketsiz)",
      file: "(etiket yok)",
    };
  }

  if (isMeaningfulText(t)) {
    return { name: `Metin: "${t}"`, description: "metin öğesi", file: "(etiket yok)" };
  }
  return {
    name: `Kapsayıcı <${tag}>`,
    description: "arayüz kutusu / panel (etiketsiz)",
    file: "(etiket yok)",
  };
}

/**
 * LovableInspector — tasarım/UI değişiklikleri için sayfa içi öğe seçici.
 *
 * Alt+I ile (veya sağ alttaki butonla) açılır. Açıkken fare bir öğenin üzerine
 * gelince vurgu kutusu çizilir; tıklanınca öğe yakalanır ve kullanıcı ne
 * düzeltmek istediğini yazar. "Talimatı Kopyala" ile sohbete yapıştırılacak
 * hazır prompt panoya kopyalanır.
 *
 * ÇOKLU SEÇİM: Ctrl (Windows) / ⌘ (Mac) basılı tutup tıklarsan öğe seçime
 * EKLENİR ve modal açılmaz — birkaç paneli tek talimatta birleştirebilirsin.
 *
 * İSİMLENDİRME: Öğe bir `data-lovable-target` etiketli bölümün içindeyse,
 * bölümün adı + dosyası kullanılır ve hangi parça olduğu eklenir
 * (örn. "Hero Alt Paragraf → başlık \"...\""). Etiket yoksa tag/metinden
 * makul bir tahmin üretilir; rakam gibi anlamsız metinler isim olmaz.
 */
export function LovableInspector() {
  const [isActive, setIsActive] = useState(false);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const [hoveredName, setHoveredName] = useState<string>("");
  const [hoveredHasTag, setHoveredHasTag] = useState(false);
  const [selected, setSelected] = useState<InspectedElement[]>([]);
  const [markedRects, setMarkedRects] = useState<
    { key: string; rect: DOMRect }[]
  >([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userPrompt, setUserPrompt] = useState("");
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        playPopSound();
        setIsActive((prev) => !prev);
        setIsModalOpen(false);
        setSelected([]);
        setMarkedRects([]);
        setHoveredRect(null);
      }
      if (e.key === "Escape") {
        if (isModalOpen) {
          setIsModalOpen(false);
          setSelected([]);
          setMarkedRects([]);
        } else {
          setIsActive(false);
          setHoveredRect(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  useEffect(() => {
    if (!isActive || isModalOpen) {
      setHoveredRect(null);
      return;
    }

    const toElement = (el: HTMLElement): InspectedElement => {
      const info = describeElement(el);
      const rect = el.getBoundingClientRect();
      return {
        key: elementKey(el),
        taggedId: info.taggedId,
        name: info.name,
        file: info.file,
        description: info.description,
        elementTag: el.tagName.toLowerCase(),
        previewText: textOf(el, 35) || undefined,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        classes: (el.className || "").toString().slice(0, 80),
        el,
      };
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || target.closest("[data-lovable-ignore]")) return;
      const info = describeElement(target);
      setHoveredRect(target.getBoundingClientRect());
      setHoveredName(info.name);
      setHoveredHasTag(!!taggedAncestor(target));
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || target.closest("[data-lovable-ignore]")) return;
      e.preventDefault();
      e.stopPropagation();

      const info = toElement(target);
      const multiSelect = e.ctrlKey || e.metaKey;

      if (multiSelect) {
        playPopSound();
        setSelected((prev) => {
          const exists = prev.some((s) => s.key === info.key);
          const next = exists
            ? prev.filter((s) => s.key !== info.key)
            : [...prev, info];
          setMarkedRects(
            next.map((s) => ({
              key: s.key,
              rect: s.el ? s.el.getBoundingClientRect() : new DOMRect(0, 0, 0, 0),
            })),
          );
          return next;
        });
        return;
      }

      playPopSound();
      const already = selected.some((s) => s.key === info.key);
      const next = selected.length
        ? already
          ? selected
          : [...selected, info]
        : [info];
      setSelected(next);
      setMarkedRects(
        next.map((s) => ({
          key: s.key,
          rect: s.el ? s.el.getBoundingClientRect() : new DOMRect(0, 0, 0, 0),
        })),
      );
      setHoveredRect(null);
      setIsModalOpen(true);
      setUserPrompt("");
    };

    document.addEventListener("mouseover", handleMouseOver, true);
    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("mouseover", handleMouseOver, true);
      document.removeEventListener("click", handleClick, true);
    };
  }, [isActive, isModalOpen, selected]);

  useEffect(() => {
    if (!isModalOpen || !selected.length) return;
    const refresh = () => {
      setMarkedRects(
        selected.map((s) => ({
          key: s.key,
          rect: s.el ? s.el.getBoundingClientRect() : new DOMRect(0, 0, 0, 0),
        })),
      );
    };
    refresh();
    window.addEventListener("scroll", refresh, true);
    window.addEventListener("resize", refresh);
    return () => {
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
    };
  }, [isModalOpen, selected]);

  const generatePromptMessage = () => {
    if (!selected.length) return "";
    const what =
      userPrompt ||
      (selected.length > 1
        ? "Bu öğelerdeki tasarımı veya davranışı tutarlı biçimde düzelt."
        : "Bu öğedeki tasarımı veya davranışı düzelt.");

    if (selected.length === 1) {
      const one = selected[0];
      const size = one.width && one.height ? ` [${one.width}×${one.height}px]` : "";
      return `[SEÇİLEN ÖĞE: ${one.name}]${size}
Dosya: ${one.file}
Tür: ${one.description}
Kopyala-yapıştır talimatı: ${what}`;
    }

    const list = selected
      .map(
        (s, i) =>
          `${i + 1}. ${s.name}${s.width ? ` [${s.width}×${s.height}px]` : ""}
   dosya: ${s.file}
   tür: ${s.description}`,
      )
      .join("\n");
    return `[SEÇİLEN ${selected.length} ÖĞE]
${list}
Kopyala-yapıştır talimatı: ${what}`;
  };

  const handleCopyPrompt = () => {
    const text = generatePromptMessage();
    navigator.clipboard?.writeText(text);
    playSuccessSound();
    setCopiedPrompt(true);
    setTimeout(() => {
      setCopiedPrompt(false);
      setIsModalOpen(false);
      setIsActive(false);
      setSelected([]);
      setMarkedRects([]);
    }, 1500);
  };

  const removeOne = (key: string) => {
    playPopSound();
    setSelected((prev) => {
      const next = prev.filter((s) => s.key !== key);
      if (!next.length) setIsModalOpen(false);
      return next;
    });
  };

  const quickFixPresets = [
    "Yazı boyutunu ve fontunu düzelt",
    "Rengini değiştir",
    "Gereksiz boşlukları azalt",
    "Hizalamayı düzelt",
    "Fotoğraf alanını genişlet",
    "Tıklama hissini / buton stilini iyileştir",
    "Öğeleri birbiriyle hizala",
    "Aralarındaki boşluğu eşitle",
  ];

  return createPortal(
    <>
      <div
        data-lovable-ignore
        className="hidden lg:flex fixed bottom-5 right-5 z-50 items-center gap-2 select-none"
      >
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => {
            playPopSound();
            setIsActive((prev) => !prev);
            setIsModalOpen(false);
            setSelected([]);
            setMarkedRects([]);
            setHoveredRect(null);
          }}
          className={`flex items-center gap-2 rounded-[10px] px-3.5 py-1.5 font-sans text-xs font-semibold shadow-lg transition-all ${
            isActive
              ? "bg-[var(--ink)] text-[var(--paper)] ring-2 ring-[var(--accent)]"
              : "border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--paper)]"
          }`}
        >
          <Crosshair
            size={14}
            className={isActive ? "animate-spin text-[var(--accent)]" : ""}
          />
          <span>
            {isActive
              ? selected.length
                ? `Seçim Modu Açık · ${selected.length} öğe`
                : "Seçim Modu Açık (Ctrl ile çoklu seç)"
              : "Öğe Seç & Düzenle"}
          </span>
          <span className="font-mono text-[10px] opacity-60">Alt+I</span>
        </motion.button>
      </div>

      {isActive &&
        !isModalOpen &&
        markedRects.map((m) =>
          m.rect.width > 0 ? (
            <div
              key={m.key}
              data-lovable-ignore
              data-lovable-marked={m.key}
              style={{
                position: "fixed",
                top: m.rect.top,
                left: m.rect.left,
                width: m.rect.width,
                height: m.rect.height,
                border: "2px dashed var(--accent)",
                backgroundColor: "rgba(255, 111, 30, 0.07)",
                pointerEvents: "none",
                borderRadius: "6px",
                zIndex: 9997,
              }}
            />
          ) : null,
        )}

      {isActive && hoveredRect && !isModalOpen && (
        <div
          data-lovable-ignore
          style={{
            position: "fixed",
            top: hoveredRect.top,
            left: hoveredRect.left,
            width: hoveredRect.width,
            height: hoveredRect.height,
            border: hoveredHasTag ? "2px solid var(--ink)" : "2px dashed var(--ink)",
            backgroundColor: "rgba(255, 111, 30, 0.12)",
            pointerEvents: "none",
            borderRadius: "6px",
            zIndex: 9998,
            transition: "all 0.04s ease-out",
          }}
        >
          <div
            className="absolute -top-6 flex items-center gap-1.5 whitespace-nowrap rounded-[6px] bg-[var(--ink)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--paper)] shadow-md z-50 max-w-[min(92vw,460px)]"
            style={{
              // Kutu sağ kenara yakınsa etiketi sola yasla — taşmasın.
              left:
                window.innerWidth - hoveredRect.left < 300
                  ? "auto"
                  : 0,
              right:
                window.innerWidth - hoveredRect.left < 300
                  ? 0
                  : "auto",
            }}
          >
            <Box size={10} className="shrink-0 text-[var(--accent)]" />
            <span className="truncate">{hoveredName}</span>
            {!hoveredHasTag && (
              <span className="shrink-0 text-[var(--accent)]">· etiketsiz</span>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && selected.length > 0 && (
          <div
            data-lovable-ignore
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm select-none"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="w-full max-w-xl overflow-hidden rounded-[12px] border-[var(--line-strong)] bg-[var(--paper)] p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between pb-3 border-b border-[var(--line-strong)]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--ink)] text-[var(--paper)]">
                    <Wand2 size={15} />
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate font-sans text-lg font-bold text-[var(--ink)]">
                      {selected.length === 1
                        ? selected[0].name
                        : `${selected.length} öğe seçildi`}
                    </span>
                    <p className="truncate font-mono text-[11px] text-[var(--ink-soft)]">
                      {selected.length === 1
                        ? selected[0].file
                        : "tek talimatta birleştirilecek"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelected([]);
                    setMarkedRects([]);
                  }}
                  className="shrink-0 rounded-[8px] p-1 text-[var(--ink-soft)] transition-colors hover:bg-black/5 hover:text-[var(--ink)]"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="pt-3" data-lovable-selected-list>
                <span className="block mb-1.5 font-mono text-[10px] font-semibold uppercase text-[var(--ink-soft)]">
                  Seçilen {selected.length === 1 ? "öğe" : `öğeler (${selected.length})`}:
                </span>
                <ul className="max-h-44 overflow-y-auto rounded-[10px] border-[var(--line-strong)]">
                  {selected.map((s, i) => (
                    <li
                      key={s.key}
                      className="flex items-start justify-between gap-2 border-b border-[var(--ink-soft)] px-2.5 py-2 last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-sans text-[12px] font-semibold text-[var(--ink)]">
                          <span className="mr-1 font-mono text-[10px] text-[var(--ink-soft)]">
                            {i + 1}.
                          </span>
                          {s.name}
                        </div>
                        <div className="truncate font-mono text-[10px] text-[var(--ink-soft)]">
                          {s.file}
                          {s.width ? `  ·  ${s.width}×${s.height}px` : ""}
                        </div>
                        <div className="truncate font-sans text-[10px] text-[var(--ink-soft)]">
                          {s.description}
                        </div>
                      </div>
                      <button
                        type="button"
                        title="bu öğeyi seçimden çıkar"
                        onClick={() => removeOne(s.key)}
                        className="mt-0.5 shrink-0 rounded-[6px] p-0.5 text-[var(--ink-soft)] transition-colors hover:bg-black/5 hover:text-[var(--ink)]"
                      >
                        <X size={11} />
                      </button>
                    </li>
                  ))}
                </ul>
                {selected.length === 1 && (
                  <p className="mt-1.5 font-sans text-[10px] text-[var(--ink-soft)]">
                    {selected[0].file === "(etiket yok)"
                      ? "Bu öğede data-lovable-file yok — dosya adı görünmüyor. Ctrl ile tıklayıp birkaç öğe ekleyebilirsin."
                      : "İpucu: seçim modundayken Ctrl (⌘) ile tıklayarak öğe ekleyip çıkarabilirsin."}
                  </p>
                )}
                {selected.length > 1 && (
                  <p className="mt-1.5 font-sans text-[10px] text-[var(--ink-soft)]">
                    İpucu: seçim modundayken Ctrl (⌘) ile tıklayarak öğe ekleyip
                    çıkarabilirsin.
                  </p>
                )}
              </div>

              <div className="pt-3 pb-2">
                <span className="block mb-1.5 font-mono text-[10px] font-semibold uppercase text-[var(--ink-soft)]">
                  Hızlı talimat şablonları (tıkla & ekle):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {quickFixPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        playPopSound();
                        setUserPrompt((prev) =>
                          prev ? `${prev}, ${preset.toLowerCase()}` : preset,
                        );
                      }}
                      className="rounded-[8px] border-[var(--line-strong)] px-2.5 py-1 text-[11px] text-[var(--ink)] transition-colors hover:bg-[var(--ink)] hover:text-[var(--paper)]"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <label className="mb-1 block font-sans text-xs font-semibold text-[var(--ink)]">
                  {selected.length > 1
                    ? "Bu öğelerde neyi değiştirmemi istersin?"
                    : "Bu öğede neyi değiştirmemi istersin?"}
                </label>
                <textarea
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="Örn: bu panellerin genişliğini eşitle, arasına 16px boşluk koy, başlıkları aynı boyuta getir..."
                  rows={3}
                  autoFocus
                  className="w-full rounded-[10px] border-[var(--line-strong)] bg-[var(--paper)] p-3 font-sans text-xs leading-relaxed text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)] focus:border-[var(--accent)]"
                />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-[var(--line-strong)] pt-3">
                <span className="font-sans text-[11px] text-[var(--ink-soft)]">
                  {selected.length > 1
                    ? `${selected.length} öğe tek talimatta kopyalanır.`
                    : "Kopyalayıp sohbete doğrudan yapıştırabilirsin."}
                </span>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCopyPrompt}
                  className="btn-pill-orange flex items-center gap-2 text-xs"
                >
                  {copiedPrompt ? (
                    <>
                      <Check size={13} />
                      <span>Kopyalandı! (yapıştır)</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Talimatı Kopyala</span>
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}
