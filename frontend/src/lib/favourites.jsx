import { useCallback, useEffect, useMemo, useState } from "react";
import { casino } from "./endpoints";
import { alertFromError, alertSuccess } from "./alerts";
import { FavouritesContext } from "./favouritesContext";
import { refFor, sourceFor } from "./gameRefs";
import { useSession } from "./sessionContext";

const NOBODY = { owner: null, rows: [], refs: new Set() };

/**
 * The signed-in player's starred games, held once for the whole app.
 *
 * Every game tile shows a star and the favourites page lists them, so the set
 * is read once here rather than per tile — forty cards on a category page would
 * otherwise be forty reads of the same list.
 *
 * ── WHY THE LIST CARRIES ITS OWNER ───────────────────────────────────────
 *
 * Signing out does not clear this in an effect, and signing in does not raise
 * a loading flag in one: both would be a `setState` in an effect body, and
 * both are answers that can be derived instead. The held list names whose it
 * is, so a list belonging to nobody — or to the previous account — is simply
 * not this visitor's, and "loading" is the gap between having a session and
 * having that session's list. `useApi` in `lib/useResource.js` derives its
 * disabled state the same way and for the same reason.
 *
 * The toggle is optimistic: the star flips on the press and is put back if the
 * call fails, because the round trip is long enough to feel like a dead button
 * and the failure is rare. The toasts are the reference's own strings.
 */
export function FavouritesProvider({ children }) {
  const { signedIn, user } = useSession();
  const owner = signedIn && user?.id != null ? user.id : null;
  const [held, setHeld] = useState(NOBODY);
  const [nonce, setNonce] = useState(0);

  const mine = held.owner === owner && owner !== null;
  const loading = owner !== null && !mine;

  useEffect(() => {
    if (owner === null) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const list = await casino.favourites();
        if (cancelled) return;
        const rows = Array.isArray(list) ? list : [];
        setHeld({ owner, rows, refs: new Set(rows.map((r) => r.game_ref)) });
      } catch {
        // A failed read leaves the stars off rather than blanking the page —
        // there is nothing here a visitor needs told about.
        if (!cancelled) setHeld({ owner, rows: [], refs: new Set() });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [owner, nonce]);

  const rows = mine ? held.rows : NOBODY.rows;
  const refs = mine ? held.refs : NOBODY.refs;

  const toggle = useCallback(
    async (game) => {
      if (owner === null) {
        window.dispatchEvent(new CustomEvent("shuffle:auth", { detail: "login" }));
        return;
      }

      const ref = refFor(game);
      if (!ref) return;
      const starred = refs.has(ref);
      const source = sourceFor(game);

      const setStar = (on) =>
        setHeld((cur) => {
          if (cur.owner !== owner) return cur;
          const next = new Set(cur.refs);
          if (on) next.add(ref);
          else next.delete(ref);
          return { ...cur, refs: next };
        });

      setStar(!starred);

      try {
        if (starred) {
          await casino.removeFavourite(ref);
          setHeld((cur) => (cur.owner === owner ? { ...cur, rows: cur.rows.filter((r) => r.game_ref !== ref) } : cur));
          alertSuccess("Favourite removed");
        } else {
          await casino.addFavourite(ref, source);
          // The row the list page draws. The server resolves `game` against the
          // catalogue; a captured tile has no row there, and `null` is what the
          // read would have answered too — the page falls back to the capture.
          const row = { game_ref: ref, source, created_at: new Date().toISOString(), game: null };
          setHeld((cur) => (cur.owner === owner ? { ...cur, rows: [row, ...cur.rows] } : cur));
          alertSuccess("Favourite added");
        }
      } catch (error) {
        setStar(starred);
        alertFromError(error, "Could not update your favourites");
      }
    },
    [owner, refs]
  );

  const value = useMemo(
    () => ({
      rows,
      refs,
      loading,
      signedIn: owner !== null,
      has: (game) => refs.has(refFor(game)),
      toggle,
      reload: () => setNonce((n) => n + 1),
    }),
    [rows, refs, loading, owner, toggle]
  );

  return <FavouritesContext.Provider value={value}>{children}</FavouritesContext.Provider>;
}
