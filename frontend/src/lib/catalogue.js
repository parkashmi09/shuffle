import { useMemo } from "react";
import { casino, jsGames, site } from "./endpoints";
import { toBanner, toBanners, toGameCard, toGameCards, toProviders } from "./adapters";
import { useApi, useResource } from "./useResource";
import { sections as staticSections } from "../data/catalog";
import { providerBrands } from "../data/providerBrands";
import { adminCategorySlug } from "./categories";
import { useGate } from "./gates";
import { underAgentBase } from "./agentBase";

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
/** An Original as a lobby tile: its page is `/casino/originals/<game_code>`. */
export const originalCard = (row) => ({
  uuid: null,
  code: row.game_code,
  name: row.name,
  img: row.image || "/icons/original.svg",
  href: `/casino/originals/${encodeURIComponent(row.game_code)}`,
  color: "#7B3FE4",
  provider: null,
});

/** The admin's Originals (on, in order) as tiles; [] while Originals are off or not synced. */
const originalCards = () => jsGames.originals().then((rows) => (Array.isArray(rows) ? rows.map(originalCard) : []), () => []);

/** Rows with no curated collection read the catalogue itself — see `categoryQuery`. */
const ROW_QUERY = {
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
      // The Originals row is the admin's Originals list and nothing else (admin → Originals → Games).
      if (id === "shuffle-games") return originalCards();
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
  const agentSite = underAgentBase();
  const { data, isLive } = useResource(
    agentSite ? "banners:agent" : "banners",
    async () => {
      // `withHidden`: a placement the admin hid comes back as `{type, mode, active: false}` only (no art).
      const shown = (b) => b.url && b.active !== false && b.hasImage !== false;
      if (!agentSite) return (await site.banners({ withHidden: true })).filter((b) => b.mode !== "agent" && shown(b));
      // The auth and VIP art stays the site's; the carousel reads agent mode's own rows, hidden ones kept
      // so agentCarousel leaves that slot's built-in out.
      const [rows, agentRows] = await Promise.all([
        site.banners({ withHidden: true }).catch(() => []),
        site.banners({ withHidden: true, mode: "agent" }).catch(() => []),
      ]);
      return [...rows.filter((b) => b.mode !== "agent" && shown(b)), ...agentRows.filter((b) => shown(b) || b.active === false)];
    },
    []
  );
  const one = (type) => {
    const row = data.find((b) => b.type === type);
    return row ? toBanner(row) : null;
  };
  const banners = agentSite
    ? agentCarousel(data)
    : toBanners(data.filter((b) => !SLOT_TYPES.includes(b.type)));
  return { banners, vip: one("vip"), auth: one("auth"), isLive };
}
const SLOT_TYPES = ["vip", "auth"];
const AGENT_SLIDE = /^agent-slider-\d+$/;
/** /agent's carousel until the admin uploads `agent-slider-<n>` rows: game banners, never a promotion. */
const AGENT_DEFAULT_SLIDES = [
  ["1", "/sports", "Cricket, football & more"],
  ["2", "/casino/categories/originals", "Crash games"],
  ["3", "/sports", "Back your team"],
  ["4", "/casino/categories/slots", "Slots & live casino"],
].map(([n, href, alt]) => ({ img: `/brand/agent/slide-${n}.webp`, href, alt }));

/**
 * /agent's carousel, slot by slot (hash 5dca56ef): an upload to `agent-slider-<n>` replaces built-in
 * slide n only, a placement the admin hid (`active: false`) drops it, every other built-in stays. Slot order.
 */
export function agentCarousel(rows) {
  const slot = (type) => Number(String(type).slice(13));
  const agent = rows.filter((b) => AGENT_SLIDE.test(b?.type));
  const hidden = new Set(agent.filter((b) => b.active === false).map((b) => slot(b.type)));
  const uploaded = agent.filter((b) => b.active !== false);
  const taken = new Set(uploaded.map((b) => slot(b.type)));
  return [
    ...uploaded.map((b) => [slot(b.type), toBanner(b)]),
    ...AGENT_DEFAULT_SLIDES.map((s, i) => [i + 1, s]).filter(([n]) => !taken.has(n) && !hidden.has(n)),
  ]
    .sort((a, b) => a[0] - b[0])
    .map(([, s]) => s);
}

/* Self-check, dev only: no rows = the built-in four, a hidden slot drops its built-in, an upload takes its own slot. */
if (import.meta.env.DEV) {
  const imgs = (rows) => agentCarousel(rows).map((s) => s.img).join();
  const art = (...n) => n.map((i) => `/brand/agent/slide-${i}.webp`).join();
  console.assert(imgs([]) === art(1, 2, 3, 4), "agent carousel: built-ins");
  console.assert(imgs([{ type: "agent-slider-2", active: false }]) === art(1, 3, 4), "agent carousel: hidden slot");
  const up = agentCarousel([{ type: "agent-slider-3", url: "/api/v1/admin/banners/image/agent-slider-3" }]);
  console.assert(up.length === 4 && up[0].img === "/brand/agent/slide-1.webp" && up[2].img !== "/brand/agent/slide-3.webp", "agent carousel: upload replaces its slot");
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
export function useCategory(slug, { captured, category, search, provider, sort, limit = 40, admin } = {}) {
  const { data, isLive, loading } = useResource(
    `category:${slug}:${category || ""}:${search || ""}:${provider || ""}:${sort || ""}:${limit}:${admin || ""}`,
    async () => {
      if (slug === "originals") {
        const needle = (search || "").toLowerCase();
        const games = (await originalCards()).filter((g) => !needle || g.name.toLowerCase().includes(needle));
        return games.length ? { games, total: games.length } : null;
      }
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
  const game = useMemo(() => (data ? { ...toGameCard(data), type: data.type ?? null, launchCurrencies: data.launchCurrencies ?? null } : null), [data]);
  return { game, loading, error };
}

/** One Original, by `game_code`, from the admin's list. A code that is not on it is the not-found state. */
export function useOriginal(code) {
  const { data, loading, error } = useApi("originals:list", () => jsGames.originals(), { enabled: Boolean(code) });
  const row = Array.isArray(data) ? data.find((g) => g.game_code === code) : null;
  const game = useMemo(() => (row ? originalCard(row) : null), [row]);
  return { game, loading, error: error || (Array.isArray(data) && !row ? new Error("Game not found") : null) };
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
