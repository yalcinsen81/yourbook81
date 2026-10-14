import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * Tek satırlık araç çubuğu: sığmayan öğeler "Diğer" menüsüne taşınır.
 * Öğeler `data-ov="n"` ile işaretlenir (küçük n önce gizlenir). Dönen düzey `lv` ise `data-ov ≤ lv` olan öğeler gizlidir;
 * aynı öğeler menüde gösterilir. Ölçüm her çizimden sonra ve kap boyutu değişince yapılır.
 */
export function useOverflow(ref: RefObject<HTMLElement | null>, maxLevel: number): number {
  const [level, setLevel] = useState(0);
  const fitRef = useRef<() => void>(() => {});

  fitRef.current = () => {
    const el = ref.current;
    if (!el) return;
    const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-ov]"));
    const apply = (lv: number) => {
      for (const n of nodes) n.toggleAttribute("data-off", Number(n.dataset.ov) <= lv);
    };
    let lv = 0;
    for (; lv < maxLevel; lv++) {
      apply(lv);
      if (el.scrollWidth <= el.clientWidth + 1) break;
    }
    apply(lv);
    setLevel(lv);
  };

  useLayoutEffect(() => {
    fitRef.current();
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => fitRef.current());
    ro.observe(el);
    // Yazı tipi geç yüklenirse genişlikler değişir
    void document.fonts?.ready.then(() => fitRef.current());
    return () => ro.disconnect();
  }, [ref]);

  return level;
}
