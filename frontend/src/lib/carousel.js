import { useCallback, useEffect, useRef, useState } from "react";


export const cx = (...parts) => parts.filter(Boolean).join(" ");

/**
 * Scroll state + controls for a horizontally scrolling swipe track.
 * The track itself is the reference's `CarouselSwipeContent_root`.
 */
export function useCarousel() {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ atStart: true, atEnd: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdge({
      atStart: el.scrollLeft <= 1,
      atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const step = (dir) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  return { trackRef: ref, carousel: { ...edge, prev: () => step(-1), next: () => step(1) } };
}
