import { providers as staticProviders, sections } from "../data/catalog";
import { categories } from "../data/categories";

/**
 * Which captured game belongs to which provider.
 *
 * `gis_games` carries a `provider` column, so a seeded catalogue answers this
 * itself — `GET /casino/games/provider/:name` is the real source and
 * `useProviderGames` asks it first. This module is the fallback for the same
 * reason every other read has one (see `lib/useResource.js`): with an empty
 * table the provider page would otherwise open on nothing.
 *
 * The capture has no provider field. What it does have is the reference's own
 * game slugs, which are prefixed with the studio that published them —
 * `/games/hacksaw-le-prechaun`, `/games/nolimit-duck-hunters`. So the prefix is
 * the attribution, and this table maps it onto the provider slugs the rail
 * renders. Prefixes are matched longest-first, because `1-spin-4-win` and
 * `155-io` both start with a digit run that `split("-")` would truncate.
 *
 * A prefix with no provider tile (`n-2-games`) is left out rather than guessed
 * at: an unattributed game is better than a wrongly attributed one.
 */
const PREFIX_SLUG = [
  ["originals/", "shuffle-games"],
  ["1-spin-4-win-", "1spin4win"],
  ["3-oaks-", "3oaks"],
  ["7-rings-", "7rings"],
  ["155-io-", "155-io"],
  ["bsg-", "betsoft"],
  ["clutch-", "clutch-gaming"],
  ["delulu-", "delulu"],
  ["endorphina-", "endorphina"],
  ["evolution-", "evolution"],
  ["exco-", "exco"],
  ["hacksaw-", "hacksaw"],
  ["just-slots-", "just-slots"],
  ["microgaming-", "microgaming"],
  ["nolimit-", "nolimit-city"],
  ["novomatic-", "novomatic"],
  ["one-touch-", "onetouch"],
  ["penguin-", "penguin-king"],
  ["peter-", "peter-and-sons"],
  ["pragmaticexternal-", "pragmatic-play"],
  ["pragmaticplay-", "pragmatic-play"],
  ["pushgaming-", "push-gaming"],
  ["relax-", "relax"],
  ["shady-", "shady-lady"],
  // BGaming ships through the SoftSwiss aggregator, which is the name the
  // reference's slugs carry.
  ["softswiss-", "bgmng"],
  ["spnmnl-", "spnmnl"],
  ["truelab-", "truelab"],
  ["voltent-", "voltent"],
].sort((a, b) => b[0].length - a[0].length);

const slugForHref = (href) => {
  const path = String(href || "").replace(/^\/games\//, "");
  return PREFIX_SLUG.find(([prefix]) => path.startsWith(prefix))?.[1] || null;
};

/** Every captured game, deduplicated — the lobby rows plus the category pages. */
const allGames = (() => {
  const byHref = new Map();
  for (const section of sections) for (const game of section.games || []) byHref.set(game.href, game);
  for (const category of Object.values(categories)) for (const game of category.games || []) byHref.set(game.href, game);
  return [...byHref.values()];
})();

const bySlug = (() => {
  const map = new Map();
  for (const game of allGames) {
    const slug = slugForHref(game.href);
    if (!slug) continue;
    if (!map.has(slug)) map.set(slug, []);
    map.get(slug).push(game);
  }
  return map;
})();

/** The captured games attributed to a provider slug. Empty when nothing was captured for it. */
export const capturedGamesFor = (slug) => bySlug.get(slug) || [];

/** A provider tile by slug, from the capture — the name and logo for one we hold artwork for. */
export const capturedProvider = (slug) => staticProviders.find((p) => p.slug === slug) || null;
