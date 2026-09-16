import { useCallback, useEffect, useState } from "react";

/**
 * Read from the API, but never render less than the static capture.
 *
 * This clone is matched pixel for pixel against shuffle.com, and several of the
 * tables behind it are empty on a fresh database — `gis_games`, `gis_providers`
 * and `banners` all have zero rows, so `GET /casino/games` answers `200 []`.
 * A plain fetch-and-render would replace a full lobby with nothing at all and
 * look like a regression rather than an empty table.
 *
 * So: the fallback renders immediately, the request goes out beside it, and the
 * answer is adopted **only if it carries something**. An error, an empty list or
 * an unreachable gateway all leave the capture in place. Seed the tables and the
 * same components show live data with no edit anywhere.
 *
 * `isLive` says which one is on screen, so a caller can tell the difference when
 * it matters. Nothing renders a spinner off `loading` for a fallback-backed
 * read — there is already content there.
 *
 * ── WHY `key` AND NOT A DEPENDENCY ARRAY ─────────────────────────────────
 *
 * The fetcher is written inline at the call site, so it is a new function on
 * every render and cannot itself be a dependency. The obvious fix — take a
 * `deps` array and spread it — produces a non-literal dependency list, which
 * the hooks lint rejects for good reason: it cannot check a list it cannot see.
 * A single string that names what is being read is checkable, and reads better
 * at the call site than a positional array.
 *
 * @param {string} key                  Identifies this read; changing it re-runs the fetcher.
 * @param {() => Promise<any>} fetcher  Runs on mount and whenever `key` changes.
 * @param {any} fallback                Rendered until — and unless — the API has more.
 */
export function useResource(key, fetcher, fallback) {
  const [state, setState] = useState({ data: fallback, loading: true, error: null, isLive: false });
  const [nonce, setNonce] = useState(0);

  // `fetcher` and `fallback` are read through this ref-free closure on purpose:
  // the effect below depends on `key` alone, and both are captured fresh each
  // time it runs, so a changed key always uses the current pair.
  const latest = { fetcher, fallback };
  const ref = useLatest(latest);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { fetcher: run, fallback: spare } = ref.current;
      try {
        const data = await run();
        if (cancelled) return;
        setState(
          hasContent(data)
            ? { data, loading: false, error: null, isLive: true }
            : { data: spare, loading: false, error: null, isLive: false }
        );
      } catch (error) {
        if (cancelled || error?.name === "AbortError") return;
        // A refusal is not a reason to blank the page. The capture stays and
        // the error is exposed for anything that wants to say so.
        setState({ data: spare, loading: false, error, isLive: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, nonce, ref]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, reload };
}

/**
 * A plain read with no fallback — for data that has no static equivalent.
 *
 * Returns `null` while in flight and on failure, so a caller renders nothing
 * rather than a half-populated widget. Used for signed-in reads (wallet, VIP
 * progress) where there is no capture to fall back to and an empty state is the
 * honest answer.
 */
export function useApi(key, fetcher, { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const [nonce, setNonce] = useState(0);
  const ref = useLatest({ fetcher });

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const data = await ref.current.fetcher();
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (error) {
        if (cancelled || error?.name === "AbortError") return;
        setState({ data: null, loading: false, error });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key, nonce, enabled, ref]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // Disabled is a derived answer, not a stored one — a signed-out caller has no
  // data and is not waiting for any. Clearing state from the effect instead
  // would render one frame of the previous user's data first.
  if (!enabled) return { data: null, loading: false, error: null, reload };

  return { ...state, reload };
}

/**
 * The current value of something, readable from an effect without depending on it.
 *
 * Writing `ref.current` during render is what React's rules forbid — a render
 * that is thrown away must not leave a trace. The write happens in a layout-free
 * effect instead, which runs only for a render that was committed.
 */
function useLatest(value) {
  const [ref] = useState(() => ({ current: value }));
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * Whether an answer is worth showing instead of the capture.
 *
 * An empty array and an empty object both mean "the table has no rows", which
 * is the case this whole module exists for. `0` and `false` are real answers
 * and must survive — hence the explicit checks rather than a truthiness test.
 */
function hasContent(data) {
  if (data === null || data === undefined) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === "object") return Object.keys(data).length > 0;
  return true;
}
