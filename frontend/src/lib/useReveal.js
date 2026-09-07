import { useEffect, useRef, useState } from "react";

/**
 * Marks an element as revealed once it enters the viewport (used for the
 * reference's staggered card / row entrance animations).
 */
export function useReveal(rootMargin = "0px 0px -10% 0px") {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin }
    );
    io.observe(el);
    // Safety net: never leave content invisible if the observer is starved (hidden tabs, iframes).
    const fallback = setTimeout(() => setShown(true), 1500);
    return () => {
      io.disconnect();
      clearTimeout(fallback);
    };
  }, [rootMargin, shown]);

  return [ref, shown];
}
