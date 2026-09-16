import { useEffect, useState } from "react";

/**
 * True below the reference's 768px modal/sheet switch, live across resizes.
 *
 * Measured on the live site, which opens a bottom sheet at 767px and a centred
 * modal at 768px. `components/ui/Modal` is the only caller that matters, but it
 * lives here so that file exports nothing but its component.
 */
const SHEET_QUERY = "(max-width: 767px)";

export function useMobileSheet() {
  const [isSheet, setIsSheet] = useState(
    () => typeof window !== "undefined" && window.matchMedia(SHEET_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(SHEET_QUERY);
    const onChange = (e) => setIsSheet(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isSheet;
}
