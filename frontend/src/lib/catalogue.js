import { useMemo } from "react";
import { casino, site } from "./endpoints";
import { toBanner, toBanners, toGameCard, toGameCards, toProviders } from "./adapters";
import { useApi, useResource } from "./useResource";
import { sections as staticSections } from "../data/catalog";
import { providerBrands } from "../data/providerBrands";
import { adminCategorySlug } from "./categories";
import { useGate } from "./gates";

/** The site admin's category flag behind a lobby slug (`/admin/site-config/public`). */
const SLUG_FLAG = { originals: "originals", "shuffle-games": "originals", slots: "slotsgames", "live-casino": "livegames" };

/**
 * Whether a lobby slug is on: its site-admin flag, and the admin's lobby category
 * (`GET /casino/games/categories`) not switched `active: false`. Unanswered reads are on.
 */
export function useCategoryOn() {
  const on = useGate();
  const { data: cats } = useApi("casino:categories", () => casino.categories());
  return (slug) => {
    if (SLUG_FLAG[slug] && !on(SLUG_FLAG[slug])) return false;
    const admin = adminCategorySlug(slug);
    return !admin || !Array.isArray(cats) || cats.find((c) => c.slug === admin)?.active !== false;
  };
}

/** The admin's hand-picked games for a lobby slug, or null when its category is off or empty. */
async function adminCategoryCards(slug, limit) {
  const admin = adminCategorySlug(slug);
  if (!admin) return null;
  const picked = (await casino.categories().catch(() => [])).find?.((c) => c.slug === admin);
  if (!picked?.active || !(picked.count > 0)) return null;
  const { data: rows } = await casino.categoryGames(admin, { limit });
  const games = toGameCards(rows);
  return games.length ? games : null;
}

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
};
/** Rows with no curated collection read the catalogue itself — see `categoryQuery`. */
const ROW_QUERY = {
  "shuffle-games": { category: "originals" },
  "game-shows": { category: "game-shows" },
  "shuffle-picks": { sort: "popular" },
  "latest-releases": { sort: "newest" },
};

/** One lobby row, live where the catalogue can fill it. */
export function useLobbySection(id) {
  const captured = useMemo(() => staticSections.find((s) => s.id === id) || null, [id]);
  const collection = ROW_COLLECTION[id];
  const categoryOn = useCategoryOn();

  const { data, isLive } = useResource(
    `lobby:${id}`,
    async () => {
      const picked = await adminCategoryCards(id, 30);
      if (picked) return picked;
      const { data: rows } = collection
        ? await casino.collection(collection, { limit: 30 })
        : await casino.games({ limit: 30, ...ROW_QUERY[id] });
      return toGameCards(rows);
    },
    []
  );

  // The heading, icon and "view all" link are the capture's either way — they
  // are page furniture, not catalogue data.
  return captured && categoryOn(id) ? { ...captured, games: data, isLive } : null;
}

/**
 * The provider rail and the providers page: only the studios `GET /casino/games/providers` answers
 * (`{ rows, total }`). The bundled brand list supplies logos and names, never extra tiles.
 */
export function useProviders() {
  const { data, loading, error } = useApi("providers", async () => toProviders((await casino.providers())?.rows, [], providerBrands));
  return { providers: data || [], loading, error };
}

/**
 * The admin's active banners by placement `type` (agent placements excluded). `vip` and `auth`
 * (Banners → Other) are the VIP page hero and the auth modal's artwork; every other placement
 * is a home hero slide. Each is empty / null when unset, and the caller keeps its own art.
 */
export function useBanners() {
  const { data, isLive } = useResource(
    "banners",
    async () => (await site.banners()).filter((b) => b.mode !== "agent" && b.url),
    []
  );
  const one = (type) => {
    const row = data.find((b) => b.type === type);
    return row ? toBanner(row) : null;
  };
  return { banners: toBanners(data.filter((b) => !SLOT_TYPES.includes(b.type))), vip: one("vip"), auth: one("auth"), isLive };
}
const SLOT_TYPES = ["vip", "auth"];

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
export function useCategory(slug, { captured, category, search, provider, sort, limit = 40, admin } = {}) {
  const { data, isLive, loading } = useResource(
    `category:${slug}:${category || ""}:${search || ""}:${provider || ""}:${sort || ""}:${limit}:${admin || ""}`,
    async () => {
      // The admin's hand-picked games for this category, when it has any (`admin` is
      // passed only while nothing is typed in the search box).
      if (admin) {
        const picked = (await casino.categories().catch(() => [])).find?.((c) => c.slug === admin);
        if (picked?.active && picked.count > 0) {
          const { data: rows, meta } = await casino.categoryGames(admin, { limit, ...(provider ? { provider } : {}) });
          const games = toGameCards(rows);
          if (games.length) return { games, total: meta?.pagination?.total ?? games.length };
        }
      }
      // A slug the catalogue cannot express — Originals, Shuffle Picks — asks
      // for nothing and keeps its capture, rather than asking for everything.
      if (!category && !search && !sort) return null;
      const { data: rows, meta } = await casino.games({
        limit,
        ...(category ? { category } : {}),
        ...(search ? { search } : {}),
        ...(provider ? { provider } : {}),
        ...(sort ? { sort } : {}),
      });
      const games = toGameCards(rows);
      return games.length ? { games, total: meta?.pagination?.total ?? games.length } : null;
    },
    { games: captured || [], total: (captured || []).length }
  );

  return { ...data, isLive, loading };
}

/**
 * One provider's games — `GET /casino/games/provider/:name`, by the catalogue's own provider name.
 * `total` is `meta.pagination.total`. No capture stands in: a failed read is the error state.
 */
export function useProviderGames(name, { limit = 40 } = {}) {
  const { data, loading, error } = useApi(
    `provider-games:${name || ""}:${limit}`,
    async () => {
      const { data: rows, meta } = await casino.gamesByProvider(name, { limit });
      const games = toGameCards(rows);
      return { games, total: meta?.pagination?.total ?? games.length };
    },
    { enabled: Boolean(name) }
  );
  return { games: data?.games || [], total: data?.total || 0, loading, error };
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
