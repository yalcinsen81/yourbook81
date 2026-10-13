import { useLayoutEffect, useState, type RefObject } from "react";

/** Kaydırma ve boyut: yalnızca görünen satır ve günler çizilir */
export function useViewport(ref: RefObject<HTMLDivElement | null>) {
  const [vp, setVp] = useState({ left: 0, top: 0, width: 1200, height: 800 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      setVp((v) =>
        v.left === el.scrollLeft && v.top === el.scrollTop && v.width === el.clientWidth && v.height === el.clientHeight
          ? v
          : { left: el.scrollLeft, top: el.scrollTop, width: el.clientWidth, height: el.clientHeight },
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    el.addEventListener("scroll", schedule, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    ro?.observe(el);
    return () => {
      el.removeEventListener("scroll", schedule);
      ro?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref]);
  return vp;
}

