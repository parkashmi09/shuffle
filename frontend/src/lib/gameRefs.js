import { sections } from "../data/catalog";
import { categories } from "../data/categories";

/**
 * How a game is named to the favourites store.
 *
 * `POST /casino/games/favourites/:gameRef` takes "whatever string the client
 * used to name the game" — the backend resolves it against both catalogues and
 * hands back `game: null` for one it does not hold (see `games.service.js`).
 * So a live card is named by its catalogue uuid and a captured card by its own
 * slug, which is the only identity it has.
 *
 * The one constraint is the route's: a reference matches
 * `^[A-Za-z0-9._:-]+$`, so it cannot carry the slash in `/games/originals/dice`.
 * That collapses to a dash, which is reversible because no captured slug
 * contains one in that position — `refFor` and the index below apply the same
 * transform, so a ref always names back the tile it came from.
 */
export const refFor = (game) =>
  game?.uuid || String(game?.href || "").replace(/^\/games\//, "").replace(/\//g, "-");

/** What the client believed it was naming — stored so a later migration has something to work from. */
export const sourceFor = (game) => (game?.uuid ? "aggregator" : "unknown");

/** Every captured game, indexed by the reference `refFor` would give it. */
const capturedByRef = (() => {
  const map = new Map();
  const add = (game) => {
    const ref = refFor(game);
    if (ref && !map.has(ref)) map.set(ref, game);
  };
  for (const section of sections) (section.games || []).forEach(add);
  for (const category of Object.values(categories)) (category.games || []).forEach(add);
  return map;
})();

export const capturedGameFor = (ref) => capturedByRef.get(ref) || null;

/**
 * A title, as a key both catalogues can be looked up by.
 *
 * Case and spacing only, plus the trademark marks a provider appends and the
 * reference does not. Deliberately NOT fuzzy: "Gates of Olympus" and "Gates of
 * Olympus 1000" are two different games, and anything that collapsed them
 * would put one game's artwork on the other.
 */
const titleKey = (name) =>
  String(name || "")
    .toLowerCase()
    .replace(/[™®]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Every captured game, indexed by its title. */
const capturedByTitle = (() => {
  const map = new Map();
  for (const game of capturedByRef.values()) {
    const key = titleKey(game.name);
    // First wins, which is the reference's own order: `sections` before the
    // category pages, so a game that appears on the home page keeps the tile
    // it was shown with there.
    if (key && !map.has(key)) map.set(key, game);
  }
  return map;
})();

/**
 * The reference's artwork for a game of this name, if it has one.
 *
 * ── WHY MATCH ON THE NAME ────────────────────────────────────────────────
 *
 * The imported catalogue carries artwork URLs pointing at sixteen other
 * operators' CDNs, and most of them are dead — `coincasino.com` and `boxbet.io`
 * answer nothing, `bc.imgix.net` answers 402, and forty-five rows point at
 * `example.com`. Around a third of the catalogue draws a real image.
 *
 * The capture holds 272 games with artwork that IS on disk. Where a catalogue
 * row carries the same title, that file is the better answer, so it is the one
 * used. A row whose title the capture does not know keeps whatever it came
 * with — no guessing, no substitution by provider or by category.
 *
 * ── WHAT THIS DOES TO THE ORIGINALS ──────────────────────────────────────
 *
 * Twenty-seven matches are Shuffle's own Originals — Dice, Mines, Plinko,
 * Limbo, Keno, Baccarat, Blackjack, Roulette, Wheel, HiLo — whose tiles carry
 * the SHUFFLE wordmark, landing on a provider's game of the same name
 * (Spribe's Dice, Hacksaw's Mines, jili's Baccarat). That is the instruction
 * read literally, and it replaces a broken image with one that loads.
 *
 * `CAPTURED_ART_INCLUDES_ORIGINALS` is the switch if that reads wrong: set it
 * false and those twenty-seven keep their own artwork while the other
 * seventy-nine matches still get the reference's.
 */
const CAPTURED_ART_INCLUDES_ORIGINALS = true;

const isOriginal = (game) => String(game?.href || "").startsWith("/games/originals/");

export const capturedArtFor = (name) => {
  const game = capturedByTitle.get(titleKey(name));
  if (!game) return null;
  if (!CAPTURED_ART_INCLUDES_ORIGINALS && isOriginal(game)) return null;
  return game.img || null;
};
