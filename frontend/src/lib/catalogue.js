import { useMemo } from "react";
import { casino, site } from "./endpoints";
import { toBanners, toGameCard, toGameCards, toProviderRoster } from "./adapters";
import { useApi, useResource } from "./useResource";
import { banners as staticBanners, providers as staticProviders, sections as staticSections } from "../data/catalog";
import { capturedGamesFor } from "./providerGames";
import { providerBrands, providerOrder } from "../data/providerBrands";

/**
 * The casino catalogue, read from the backend where it has rows and from the
 * capture where it does not.
 *
 * `gis_games`, `gis_providers` and `banners` are all empty on a fresh database.
 * The routes work — `GET /casino/games` answers `200 []` — so this is a data
 * gap, not a missing endpoint, and every hook here is written so that seeding
 * those tables is the only thing needed to switch a screen to live data.
 * See `docs/FRONTEND-BACKEND-INTEGRATION.md` §4.2.
 */

/**
 * Which backend collection fills each captured lobby row.
 *
 * The backend has five curated collections — `hot`, `live-casino`,
 * `popular-slots`, `crash`, `indian` — each a hand-ordered list of uuids. They
 * are what a lobby row is, so the rows that have an equivalent use one.
 *
 * The others do not, and are left on their capture rather than approximated:
 *
 * - **Shuffle Games** are in-house originals. `gis_games` holds the aggregator
 *   catalogue and never held these.
 * - **Latest Releases** wants newest-first. `browse` is `.strict()` with no
 *   sort key — the order is the service's own — so there is nothing to ask for.
 * - **Shuffle Picks** is editorial. Filling it with an arbitrary slice would be
 *   inventing curation, not reading it.
 *
 * A row here is one string change away from live the moment its collection is
 * populated; a row above needs a backend that can express it.
 */
const ROW_COLLECTION = {
  slots: "popular-slots",
  "live-casino": "live-casino",
  "game-shows": "hot",
};

/** One lobby row, live where the catalogue can fill it. */
export function useLobbySection(id) {
  const captured = useMemo(() => staticSections.find((s) => s.id === id) || null, [id]);
  const collection = ROW_COLLECTION[id];

  const { data, isLive } = useResource(
    `lobby:${id}`,
    async () => {
      if (!collection) return null;
      const { data: rows } = await casino.collection(collection, { limit: 30 });
      return toGameCards(rows);
    },
    captured?.games || []
  );

  // The heading, icon and "view all" link are the capture's either way — they
  // are page furniture, not catalogue data.
  return captured ? { ...captured, games: data, isLive } : null;
}

/** The provider rail and the providers page. */
export function useProviders() {
  const { data, isLive } = useResource(
    "providers",
    async () => {
      const result = await casino.providers();
      // This route answers `{rows, total}`, not a paginated envelope — the one
      // catalogue read that does.
      return toProviderRoster(result?.rows, staticProviders, providerBrands, providerOrder);
    },
    // Before the read lands, the roster alone — every studio we hold a
    // wordmark for, with no game counts yet. The reference capture is no
    // longer the fallback: it is a different platform's supplier list.
    toProviderRoster([], staticProviders, providerBrands, providerOrder)
  );
  return { providers: data, isLive };
}

/** Home hero slides. `banners` is keyed by placement; `home` is this one. */
export function useBanners(placement = "home") {
  const { data, isLive } = useResource(
    `banners:${placement}`,
    async () => toBanners(await site.banners(placement)),
    staticBanners
  );
  return { banners: data, isLive };
}

/**
 * A category browse page.
 *
 * ── WHY THIS TAKES `category` AND NOT `type` ─────────────────────────────
 *
 * It took `type`, which the backend matches EXACTLY against the provider's own
 * word. The catalogue's providers wrote five words for one thing — `Slot Game`,
 * `Slots`, `Slot`, `slot`, `Video Slot` — so `?type=slots` answered 310 rows of
 * 1,362 and no single value answered them all. Nothing called this hook, and
 * every browse page rendered its captured list instead of the catalogue.
 *
 * `category` matches the normalised word the import writes into `tags`, so
 * `slots` is all 1,362. See `#filterClause` in `games.service.js`.
 *
 * `provider` and `search` go to the backend too, so both filter the WHOLE
 * catalogue rather than the page already on screen.
 *
 * `total` is what the header counts, and it comes from `meta.pagination.total`
 * rather than the page length — the reference shows the catalogue size, not how
 * many tiles are up.
 */
export function useCategory(slug, { captured, category, search, provider, limit = 40 } = {}) {
  const { data, isLive, loading } = useResource(
    `category:${slug}:${category || ""}:${search || ""}:${provider || ""}:${limit}`,
    async () => {
      // A slug the catalogue cannot express — Originals, Shuffle Picks — asks
      // for nothing and keeps its capture, rather than asking for everything.
      if (!category && !search) return null;
      const { data: rows, meta } = await casino.games({
        limit,
        ...(category ? { category } : {}),
        ...(search ? { search } : {}),
        ...(provider ? { provider } : {}),
      });
      const games = toGameCards(rows);
      return games.length ? { games, total: meta?.pagination?.total ?? games.length } : null;
    },
    { games: captured || [], total: (captured || []).length }
  );

  return { ...data, isLive, loading };
}

/**
 * One provider's games — the page behind a provider tile.
 *
 * `GET /casino/games/provider/:name` takes the catalogue's own provider name
 * (`hacksaw`, `pragmaticlive`), which is not always the slug in the URL: the
 * slug comes from the rail, and for a captured tile it is the reference's
 * (`pragmatic-play`). So the caller passes both and the name wins where it has
 * one. `total` is `meta.pagination.total`, the catalogue's count for that
 * studio, which is what the header reads — not the page length.
 */
export function useProviderGames(slug, name, { limit = 40 } = {}) {
  const captured = useMemo(() => capturedGamesFor(slug), [slug]);

  const { data, isLive, loading } = useResource(
    // `name` is in the key because it arrives late: the rail renders the
    // capture first ("Hacksaw Gaming") and the catalogue's own name a moment
    // later ("hacksaw"). Without it the read would keep the first answer —
    // which is the capture, since the catalogue knows no such provider.
    `provider-games:${slug}:${name || ""}:${limit}`,
    async () => {
      const { data: rows, meta } = await casino.gamesByProvider(name || slug, { limit });
      const games = toGameCards(rows);
      return games.length ? { games, total: meta?.pagination?.total ?? games.length } : null;
    },
    { games: captured, total: captured.length }
  );

  return { ...data, isLive, loading };
}

/**
 * One game, for the screen behind a tile.
 *
 * `useApi` and not `useResource`: a uuid either names a game in the catalogue
 * or it does not, and there is no capture to stand in for one that does not.
 * Falling back would render somebody else's game under this game's URL, which
 * is worse than the honest 404 the backend already sends.
 *
 * The row is adapted with `toGameCard` so the screen gets the same `name`,
 * `img` and `color` the tile it was opened from had — including the reference
 * artwork substitution — rather than a second, differently-shaped object.
 */
export function useGame(uuid) {
  const { data, loading, error } = useApi(`game:${uuid}`, () => casino.game(uuid), { enabled: Boolean(uuid) });
  const game = useMemo(() => (data ? { ...toGameCard(data), type: data.type ?? null } : null), [data]);
  return { game, loading, error };
}

/**
 * The games this player last opened, newest first.
 *
 * `useApi` and not `useResource`: a player's own history has no capture to
 * fall back on, and an empty list is the honest answer for an account that has
 * not launched anything — not a reason to show somebody else's games.
 *
 * The list is written by the launch path — `GamePage` opening a game is what
 * puts it here — so it reads empty for an account that has not opened one.
 */
export function useRecentlyPlayed({ enabled = true } = {}) {
  const { data, loading, reload } = useApi("recently-played", () => casino.recentlyPlayed(), { enabled });
  return { rows: Array.isArray(data) ? data : [], loading, reload };
}
