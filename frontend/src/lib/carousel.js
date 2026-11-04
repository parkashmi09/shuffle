import { useCallback, useEffect, useRef, useState } from "react";


export const cx = (...parts) => parts.filter(Boolean).join(" ");

/**
 * Scroll state + controls for a horizontally scrolling swipe track.
 * The track itself is the reference's `CarouselSwipeContent_root`.
 */
export function useCarousel() {
  const ref = useRef(null);
  // The track can mount after the hook (a carousel that renders null until its data loads),
  // so the listener follows the element itself, not the first render.
  const [el, setEl] = useState(null);
  const trackRef = useCallback((node) => {
    ref.current = node;
    setEl(node);
  }, []);
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
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [el, update]);

  const step = (dir) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  return { trackRef, carousel: { ...edge, prev: () => step(-1), next: () => step(1) } };
}
