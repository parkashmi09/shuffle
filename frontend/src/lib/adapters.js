/**
 * Backend row → the shape a component already renders.
 *
 * The clone's markup is matched against shuffle.com class by class, so nothing
 * downstream of these functions was allowed to change. Every adapter's job is
 * to produce exactly the object the static file in `src/data/` produces, from
 * the row `docs/api-surface.json` says the route returns.
 *
 * If a component starts wanting a different field, it is added here — not by
 * reshaping the component around the backend.
 */

/**
 * `gameRefs` owns the index over the captured game data, so the adapters stay
 * free of the data files themselves — the same reason `staticProviders` and
 * `providerBrands` are passed in rather than imported.
 */
import { capturedArtFor } from "./gameRefs";

/** Same base the API client uses, so an absolute `VITE_API_BASE` still resolves images. */
const API_BASE = import.meta.env.VITE_API_BASE || "/api/v1";

/**
 * A card colour per game.
 *
 * `gis_games` has no colour column and the reference tiles are colour-keyed —
 * that colour is the skeleton behind the artwork while it loads and the 2px
 * border once it has. Hashing the name gives a stable hue per game (the same
 * game is the same colour on every render and every machine) drawn from the
 * reference palette rather than an arbitrary HSL, so a seeded catalogue looks
 * like the capture rather than like a rainbow.
 */
const PALETTE = ["#05D550", "#E42735", "#FD8C1A", "#DF2079", "#00CDF2", "#7B3FE4", "#F5C518", "#FF1759"];

function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < String(name).length; i += 1) hash = (hash * 31 + String(name).charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

/**
 * A game's artwork.
 *
 * `image` is usually an absolute URL from the aggregator. `images` is a JSON
 * column that may hold sized variants; when it does, prefer them. A row with
 * neither gets the reference's own placeholder rather than a broken `<img>`.
 */
function imageFor(row) {
  const fromSet = row.images && (row.images.medium || row.images.large || row.images.small || row.images.default);
  const src = fromSet || row.image;
  if (!src) return "/icons/logo-star.svg";
  return /^https?:\/\//.test(src) || src.startsWith("/") ? src : `${API_BASE}/casino/games/image/${src}`;
}

/** Slug for a URL segment: lower case, non-alphanumerics collapsed to one dash. */
export const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * One catalogue row → one lobby card.
 *
 * Target shape is `data/catalog.js`: `{ name, href, color, img }`. The href
 * points at the launch route by uuid, which is what `/casino/catalogue/launch`
 * takes — the tiles do not navigate yet (§4.4), but the link is the real one
 * rather than a placeholder to rewrite later.
 */
export const toGameCard = (row) => ({
  name: row.name,
  href: `/casino/games/${row.uuid}`,
  color: colorFor(row.name),
  /**
   * The reference's own file where it has one for this TITLE, and the
   * catalogue's URL otherwise.
   *
   * Not a fallback for a broken image — nothing here can know an image is
   * broken, because a 404 is discovered by the browser long after this runs.
   * It is a preference: a file on disk beats another operator's CDN, and most
   * of the CDNs this catalogue names are dead. See `capturedArtFor`.
   */
  img: capturedArtFor(row.name) || imageFor(row),
  uuid: row.uuid,
  provider: row.provider || null,
});

export const toGameCards = (rows) => (Array.isArray(rows) ? rows.map(toGameCard) : []);

/**
 * `gis_providers` row → the provider tile.
 *
 * The table holds a name and nothing else — no logo column. The reference tiles
 * are SVG wordmarks that ship in `public/providers/`, so a provider we already
 * hold artwork for keeps it and one we do not falls back to the star mark. The
 * lookup is by slug, which is why `staticProviders` is passed in rather than
 * imported: this file stays free of the data files it adapts *to*.
 */
const PROVIDER_ALIAS = { bgaming: "bgmng", pragmatic: "pragmatic-play", pragmaticlive: "pragmatic-play-live" };

/**
 * `brands` is OUR catalogue's studios, keyed by the aggregator's own vendor
 * code, and it wins. `staticProviders` is the reference capture, keyed by
 * Shuffle's slugs — a near miss for five of our fourteen and nothing at all for
 * the rest, which is why the alias map above exists and why it is no longer
 * enough on its own.
 *
 * Both are passed in rather than imported: this file stays free of the data
 * files it adapts *to*.
 */
export const toProvider = (row, staticProviders = [], brands = {}) => {
  const slug = slugify(row.name);
  const brand = brands[row.name] || brands[slug];
  const alias = PROVIDER_ALIAS[slug] || slug;
  const known = staticProviders.find((p) => p.slug === alias || slugify(p.name) === alias);
  // `name` stays the catalogue's own — it is the key
  // `GET /casino/games/provider/:name` takes. `label` is what a heading reads,
  // which for a studio we hold a tile for is the reference's spelling
  // ("Pragmatic Play Live", not "pragmaticlive").
  return {
    slug,
    name: row.name,
    label: brand?.label || known?.name || row.name,
    img: brand?.img || known?.img || "/icons/logo-star.svg",
    total: row.total ?? null,
    /**
     * This studio has rows in the catalogue.
     *
     * NOT `Boolean(total)`: `GET /casino/games/providers` answers `{name}` and
     * no count, so `total` is null for every live provider. Filtering a
     * dropdown on it emptied the list and left the control inert — which is
     * exactly how the provider filter looked like it was broken.
     */
    hasGames: true,
  };
};

export const toProviders = (rows, staticProviders, brands) =>
  Array.isArray(rows) ? rows.map((r) => toProvider(r, staticProviders, brands)) : [];

/**
 * The providers page: the whole roster, not only what has games today.
 *
 * `gis_providers` holds the studios the catalogue has ROWS for — fourteen of
 * them. The brand list holds every studio we have a wordmark for, which is the
 * roster the operator actually carries. Showing only the first makes the page
 * look like a platform with fourteen suppliers.
 *
 * So both, in that order: a studio with games keeps its live row — its own
 * `name` key and its game `total` — and every other brand follows it as a tile
 * with `total: 0`. `order` decides the tail's sequence; the live ones lead
 * because they are the ones a player can act on.
 *
 * A tail tile still links to its provider page. That page reads the catalogue
 * for its slug and finds nothing, which is the honest answer — the studio is on
 * the roster and its games are not loaded yet.
 */
export const toProviderRoster = (rows, staticProviders, brands = {}, order = []) => {
  const live = toProviders(rows, staticProviders, brands);
  const claimed = new Set(live.map((p) => p.slug));

  const keys = order.length ? order : Object.keys(brands);
  const rest = keys
    .filter((key) => !claimed.has(key))
    .map((key) => ({
      slug: key,
      // The catalogue key it WOULD be queried by, which for a studio with no
      // rows is simply its own. Nothing here invents a name it does not have.
      name: key,
      label: brands[key].label,
      img: brands[key].img,
      total: 0,
      /** Artwork only — nothing to filter a game list by. */
      hasGames: false,
    }));

  return [...live, ...rest];
};

/** `banners` row → a hero slide. `image` is a filename the binary route serves. */
export const toBanner = (row) => ({
  href: row.link || "/",
  alt: row.type || "banner",
  img: /^https?:\/\//.test(row.image || "") ? row.image : `${API_BASE}/admin/banners/image/${row.image}`,
});

export const toBanners = (rows) => (Array.isArray(rows) ? rows.map(toBanner) : []);

// ── The activity board ───────────────────────────────────────────────────

/**
 * `bets.game` is an in-house code — `classic_dice`, `limbo`, `wheel` — and the
 * board renders artwork and a title. The captured originals carry both, so the
 * code is normalised (`classic_dice` → `dice`) and matched against them; a game
 * with no match keeps its code, title-cased, beside the generic mark.
 */
export function resolveGame(code, known = []) {
  const raw = String(code || "");
  const key = raw.toLowerCase().replace(/^classic_/, "").replace(/[_-]/g, "");
  const hit = known.find((g) => g.name.toLowerCase().replace(/[^a-z0-9]/g, "") === key);
  if (hit) return hit;

  const title = raw ? raw.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—";
  return { name: title, img: "/icons/original.svg", color: colorFor(raw), href: "#" };
}

/**
 * A bet row → a board row.
 *
 * The public ticker names nobody — `liveFeed` selects `gid, amount, profit,
 * coin, created, game` and no user column, deliberately (the legacy route it
 * replaces answered `SELECT * FROM bets`). So `user` is null and `UserCell`
 * renders its anonymous state, which is a case it already handles.
 *
 * `multiplier` is not stored: the row carries stake and profit, so it is
 * derived. `profit` is signed — a loss is negative and equals `-amount`, which
 * is why a losing row's multiplier is 0 rather than a ratio.
 *
 * @param {object[]} [knownGames] Captured games to resolve artwork against.
 */
export const toBoardRow = (row, knownGames) => {
  const amount = Number(row.amount) || 0;
  const profit = Number(row.profit) || 0;
  const won = profit > 0;
  return {
    // `reference` is the bet id and unique, which is what the list key wants —
    // an index would reorder rows as new bets land at the top.
    key: row.reference ?? `${row.game}-${row.at}`,
    user: null,
    game: resolveGame(row.game, knownGames),
    coin: (row.currency || "usdt").toLowerCase(),
    bet: amount.toFixed(8),
    // Payout ÷ stake. A zero stake cannot produce a ratio, so it stays 0.
    mult: won && amount > 0 ? Number(((amount + profit) / amount).toFixed(2)) : 0,
    payout: (won ? amount + profit : profit).toFixed(8),
    at: row.at,
  };
};

export const toBoardRows = (rows, knownGames) =>
  Array.isArray(rows) ? rows.map((r) => toBoardRow(r, knownGames)) : [];

/**
 * A leaderboard row → a standings row.
 *
 * `player` is already masked by the backend ("Player 2207") — it resolves no
 * real username on the public audience, and that is the privacy decision the
 * service documents rather than something to undo here.
 *
 * `wagered` and `won` are decimal strings, formatted for display with grouping
 * separators the way the captured board shows them. `prize` has no source: the
 * platform has no prize-table module, so it is left null and the column renders
 * empty rather than inventing a number.
 */
export const toStandingRow = (row, index) => ({
  rank: row.rank ?? index + 1,
  user: row.player ? { name: row.player, vip: null } : null,
  amount: formatAmount(row.wagered),
  prize: null,
  coin: "btc",
  bets: row.bets ?? 0,
});

export const toStandingRows = (rows) => (Array.isArray(rows) ? rows.map(toStandingRow) : []);

/** Grouped to two decimals — the board's own format. */
export function formatAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * The wallet's headline figure.
 *
 * `/user/wallet/balances` answers every currency the platform knows, most of
 * them zero. The header shows one, so this picks the caller's preferred code if
 * they have a balance in it, otherwise the largest non-zero holding, otherwise
 * USDT — which is what an account with an empty wallet should read as, rather
 * than the first key the object happens to have.
 */
export function primaryBalance(balances, preferred = "USDT") {
  const entries = Object.entries(balances || {});
  if (!entries.length) return { currency: preferred, amount: "0.00000000" };

  const held = entries.filter(([, v]) => Number(v) > 0);
  if (!held.length) return { currency: preferred, amount: balances[preferred] ?? "0.00000000" };

  const pick = held.find(([code]) => code === preferred) || held.sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  return { currency: pick[0], amount: pick[1] };
}

/**
 * Codes the header shows to two decimals rather than eight.
 *
 * Stablecoins sit here beside the fiat currencies because they are quoted the
 * same way — `12.34`, not `12.34000000`.
 */
const TWO_DP = ["USD", "INR", "EUR", "AED", "PKR", "BDT", "NPR", "MVR", "USDT", "USDC", "BUSD", "TUSD", "USDP"];

/**
 * Currencies the platform funds by bank transfer rather than on-chain.
 *
 * The split matters in the wallet: fiat goes through `bank-details` and
 * `deposits/fiat`, crypto through the CCPayment provider. Stablecoins are
 * *not* here — they are quoted to two decimals (above) but they still arrive
 * on a chain.
 */
const FIAT = ["INR", "USD", "EUR", "AED", "PKR", "BDT", "NPR", "MVR"];

/** Whether a code is funded by bank transfer. */
export const isFiat = (code) => FIAT.includes(String(code).toUpperCase());

/**
 * The symbol a currency is written with, where it has one.
 *
 * The reference header reads `₹0.00` — the symbol, not the code, which the coin
 * icon beside it already carries.
 */
export const SYMBOL = { USD: "$", EUR: "€", INR: "₹", PKR: "₨", NPR: "₨", BDT: "৳", AED: "د.إ", MVR: "Rf" };

/** Trim a balance for the header: 2dp for fiat-like codes, 8 for crypto. */
export function displayBalance(amount, currency) {
  const n = Number(amount) || 0;
  const code = String(currency).toUpperCase();
  return n.toFixed(TWO_DP.includes(code) ? 2 : 8);
}

/**
 * What one unit of a currency is worth in USD.
 *
 * `GET /user/exchange-rate/rates` answers `[{ currency, usdRate }]`, where
 * `usdRate` is USD **per unit** — `BTC 65000`, `INR 0.012`. So a balance
 * crosses to another currency through USD: `amount × usdRate(from) ÷ usdRate(to)`.
 */
const rateFor = (rates, code) => {
  const upper = String(code).toUpperCase();
  const row = (rates || []).find((r) => r.currency === upper);
  const n = Number(row?.usdRate);
  if (Number.isFinite(n) && n > 0) return n;
  // USD is the column's own unit, so the table does not carry a row for it —
  // `GET /user/exchange-rate/rates` lists INR 0.012 and BTC 65000 and no USD
  // at all. Without this a conversion to or from dollars finds no rate and
  // falls back to the raw figure.
  return upper === "USD" ? 1 : null;
};

/**
 * The header's headline figure, in the fiat currency the player reads.
 *
 * ── WHY THE BAR DOES NOT SHOW THE COIN'S OWN AMOUNT ──────────────────────
 *
 * The live header pairs an ETH mark with `₹0.00`: the icon names the wallet
 * being spent from, the number is what it is worth in the player's display
 * currency. That is why the pill reads `₹0.00` and not `0.00000000` — and, in
 * passing, why it measures 118px rather than 110.
 *
 * Returns `null` when either rate is missing, so the caller can fall back to
 * the coin's own amount rather than print a converted figure it cannot stand
 * behind.
 */
export function toFiat(amount, from, to, rates) {
  const fromRate = rateFor(rates, from);
  const toRate = rateFor(rates, to);
  if (fromRate === null || toRate === null) return null;
  return (Number(amount) || 0) * (fromRate / toRate);
}

/**
 * That figure, formatted the way the bar shows it.
 *
 * Grouped and to two decimals — a fiat total, not a crypto balance. Falls back
 * to the coin's own amount when no rate is held, which is honest: an unpriced
 * currency has no fiat value to show.
 */
export function displayFiat(amount, from, to, rates) {
  const value = toFiat(amount, from, to, rates);
  if (value === null) return displayBalance(amount, from);
  const code = String(to).toUpperCase();
  return `${SYMBOL[code] || ""}${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
