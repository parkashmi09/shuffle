import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribe to a media query.
 *
 * Most of the reference's responsive behaviour is plain CSS and belongs in a
 * stylesheet — this is only for the places where it swaps *markup* rather than
 * styling it, and where reproducing that with `display: none` on both variants
 * would mean shipping two live subtrees (two search inputs both claiming the
 * same label, two selects both in the tab order). The category toolbar is the
 * clear case: below `md` the reference renders a title and three 42px icon
 * buttons, above it a search field and two labelled selects, and the two share
 * no markup at all.
 *
 * `useSyncExternalStore` rather than state-plus-effect: `matchMedia` is exactly
 * the external store it exists for. The snapshot is read during render, so the
 * first paint is already correct — a `useEffect`-only read renders the desktop
 * tree for one frame and the toolbar visibly snaps on load — and there is no
 * cascading re-render on mount to pay for that.
 */
export default function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // Server-rendered, nothing matches: the mobile tree is the safe default,
    // and the client's first snapshot corrects it before paint.
    () => false
  );
}
