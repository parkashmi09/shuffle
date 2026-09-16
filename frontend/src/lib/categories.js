import { categories } from "../data/categories";

/**
 * Categories the reference browses but the capture holds no list for.
 *
 * "Table Games" is a lobby tab, not a captured page — the reference's own tab
 * pools blackjack, roulette and baccarat, so the page behind its heading does
 * the same rather than falling through to the home page on a link the lobby
 * renders.
 */
const composed = {
  "table-games": {
    title: "Table Games",
    more: true,
    games: ["blackjack", "roulette", "baccarat"].flatMap((id) => categories[id]?.games || []),
  },
};

/**
 * The mark beside a category's title — the same one its lobby row and its nav
 * entry carry, so a page opened from either is recognisably the same category.
 */
const ICONS = {
  originals: "/icons/original.svg",
  slots: "/icons/slots.svg",
  "live-casino": "/icons/casino.svg",
  "game-shows": "/icons/game-show.svg",
  "shuffle-picks": "/icons/shuffle-picks.svg",
  "latest-releases": "/icons/latest-releases.svg",
  blackjack: "/icons/blackjack.svg",
  roulette: "/icons/roulette.svg",
  baccarat: "/icons/baccarat.svg",
  "table-games": "/icons/table-games.svg",
};

export const categoryIcon = (slug) => ICONS[slug] || null;

/**
 * What to ask the catalogue for, per category slug.
 *
 * ── `category` VS `search` ───────────────────────────────────────────────
 *
 * `category` matches the normalised word the import writes into
 * `gisgamesnew.tags` — `slots`, `live`, `table`, `crash`, `arcade`. Three of
 * the reference's categories are finer than that: Blackjack, Roulette and
 * Baccarat are all `table`, and the only thing separating them is the title.
 * So those ask by `search` instead, which is a name match.
 *
 * ── AND WHAT IS DELIBERATELY ABSENT ──────────────────────────────────────
 *
 * `originals`      the in-house games. They live in `js_games`, not in the
 *                  aggregator catalogue this queries, so there is nothing here
 *                  to ask for — the capture is the right answer.
 * `shuffle-picks`  editorial. Filling it from a filter would be inventing
 *                  curation, not reading it.
 * `game-shows`     a studio format, not a type any provider records.
 * `latest-releases` wants newest-first, and `browse` has no sort key for it.
 *
 * A slug absent from here keeps its captured list, which is what every slug
 * did before this map existed.
 */
const QUERY = {
  slots: { category: "slots" },
  "live-casino": { category: "live" },
  "table-games": { category: "table" },
  crash: { category: "crash" },
  blackjack: { search: "blackjack" },
  roulette: { search: "roulette" },
  baccarat: { search: "baccarat" },
};

export const categoryQuery = (slug) => QUERY[slug] || {};

/** The captured list behind a category slug, or null for one that has none. */
export const categoryFor = (slug) => composed[slug] || categories[slug] || null;

/**
 * Whether a slug has a browse page — the router asks before rendering one, so
 * an unknown `/casino/categories/<slug>` still falls through to the lobby.
 * Latest Releases has no captured list of its own; it is pooled from the rows.
 */
export const hasCategory = (slug) => slug === "latest-releases" || Boolean(categoryFor(slug));
