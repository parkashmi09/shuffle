/**
 * Every studio this platform holds artwork for — 106 brands.
 *
 * ── WHY THIS EXISTS ALONGSIDE `catalog.js`'s `providers` ─────────────────
 *
 * That list is Shuffle's: 56 studios captured from the reference site, keyed by
 * ITS slugs (`pragmatic-play`, `bgmng`, `3oaks`). Ours are the aggregator's own
 * codes (`pragmatic`, `km`, `2j`), and only five of the fourteen we carry games
 * for happened to collide — the rest fell through to the star mark.
 *
 * So this is the lookup for OUR studios, and `catalog.js` stays the reference
 * capture it is. `toProvider` tries this first and falls back to that.
 *
 * ── THE KEY IS THE CATALOGUE'S, NOT A PRETTY NAME ────────────────────────
 *
 *   key    `gisgamesnew.provider` verbatim where we carry the studio. It is
 *          what `GET /casino/games/provider/:name` filters on, so it is not a
 *          display string and must not be tidied. Studios we hold artwork for
 *          but no games from use their own slug, which is the same shape.
 *   label  what a player reads. `km`, `2j` and `pgsoft` are codes, not names.
 *   img    the wordmark, white on transparent, 440x196 — the provider tile's
 *          own 2.23:1 aspect at 2x for the ~200px card.
 *
 * ── THE ARTWORK WAS NOT TRUSTED TO ITS FILENAME ──────────────────────────
 *
 * Every one of the 125 source files was checked against its logo before being
 * mapped, and three would have been filed under the wrong studio otherwise:
 * `amigo-1` is Penguin King, `sbo-1` is Gamingsoft, and `YEEBET GAMING-1` is
 * WS168. Nineteen files were dropped as duplicates or regional lockups of a
 * studio already here (four Evolution variants, four Pragmatic, Hacksaw
 * ASIA/LATAM/WORLD, and so on), which is how 125 files become 106 brands.
 *
 * A vendor absent from here still lists and still plays; it renders the star,
 * which is what the reference does with a studio it holds no artwork for.
 */
export const providerBrands = {
  "100hp": { label: "100HP", img: "/providers/100hp.png" },
  "18-peaches": { label: "18 Peaches", img: "/providers/18-peaches.png" },
  "2j": { label: "2J Gaming", img: "/providers/2j.png" },
  "3oaks": { label: "3 Oaks Gaming", img: "/providers/3oaks.png" },
  "5g-games": { label: "5G Games", img: "/providers/5g-games.png" },
  "759-gaming": { label: "759 Gaming", img: "/providers/759-gaming.png" },
  "9game": { label: "9.GAME", img: "/providers/9game.png" },
  "9winz": { label: "9Winz", img: "/providers/9winz.png" },
  "ae-sexy": { label: "AE Sexy", img: "/providers/ae-sexy.png" },
  amigo: { label: "Amigo Gaming", img: "/providers/amigo.png" },
  aog: { label: "Asia Online Gaming", img: "/providers/aog.png" },
  "asia-gaming": { label: "Asia Gaming", img: "/providers/asia-gaming.png" },
  askmeslot: { label: "AskMeSlot", img: "/providers/askmeslot.png" },
  atg: { label: "ATG", img: "/providers/atg.png" },
  atm: { label: "ATM", img: "/providers/atm.png" },
  aviatrix: { label: "Aviatrix", img: "/providers/aviatrix.png" },
  "bar-bara-bang": { label: "Bar Bara Bang", img: "/providers/bar-bara-bang.png" },
  bgaming: { label: "BGaming", img: "/providers/bgaming.png" },
  biggaming: { label: "Big Gaming", img: "/providers/biggaming.png" },
  bng: { label: "BNG", img: "/providers/bng.png" },
  btgaming: { label: "BT Gaming", img: "/providers/btgaming.png" },
  bti: { label: "BTi", img: "/providers/bti.png" },
  casini: { label: "Casini", img: "/providers/casini.png" },
  cmd368: { label: "CMD368", img: "/providers/cmd368.png" },
  "cp-gaming": { label: "CP Gaming", img: "/providers/cp-gaming.png" },
  cq9: { label: "CQ9 Gaming", img: "/providers/cq9.png" },
  creedroomz: { label: "CreedRoomz", img: "/providers/creedroomz.png" },
  crowdplay: { label: "Crowd Play", img: "/providers/crowdplay.png" },
  "dp-gaming": { label: "DP Gaming", img: "/providers/dp-gaming.png" },
  "dp-sports": { label: "DP Sports", img: "/providers/dp-sports.png" },
  "easy-games": { label: "Easy Games", img: "/providers/easy-games.png" },
  eeai: { label: "EEAI", img: "/providers/eeai.png" },
  endorphina: { label: "Endorphina", img: "/providers/endorphina.png" },
  epicwin: { label: "Eppic Win", img: "/providers/epicwin.png" },
  evo888h: { label: "EVO888H", img: "/providers/evo888h.png" },
  evolution: { label: "Evolution", img: "/providers/evolution.png" },
  evoplay: { label: "Evoplay", img: "/providers/evoplay.png" },
  expanse: { label: "Expanse Studios", img: "/providers/expanse.png" },
  ezugi: { label: "Ezugi", img: "/providers/ezugi.png" },
  fachai: { label: "FaChai", img: "/providers/fachai.png" },
  fastspin: { label: "Fastspin", img: "/providers/fastspin.png" },
  "funky-games": { label: "Funky Games", img: "/providers/funky-games.png" },
  galaxsys: { label: "Galaxsys", img: "/providers/galaxsys.png" },
  gameart: { label: "GameArt", img: "/providers/gameart.png" },
  gamingsoft: { label: "Gamingsoft", img: "/providers/gamingsoft.png" },
  habanero: { label: "Habanero", img: "/providers/habanero.png" },
  hacksaw: { label: "Hacksaw Gaming", img: "/providers/hacksaw.png" },
  "ia-casino": { label: "iA Casino", img: "/providers/ia-casino.png" },
  ideal: { label: "Ideal", img: "/providers/ideal.png" },
  inout: { label: "InOut", img: "/providers/inout.png" },
  jdb: { label: "JDB", img: "/providers/jdb.png" },
  jili: { label: "JILI", img: "/providers/jili.png" },
  ka: { label: "KA Gaming", img: "/providers/ka.png" },
  kalamba: { label: "Kalamba Games", img: "/providers/kalamba.png" },
  kingmidas: { label: "KingMidas", img: "/providers/kingmidas.png" },
  km: { label: "KMone Gaming", img: "/providers/km.png" },
  koolbet: { label: "Koolbet", img: "/providers/koolbet.png" },
  ky: { label: "KY Gaming", img: "/providers/ky.png" },
  live22: { label: "Live22", img: "/providers/live22.png" },
  mac88: { label: "MAC88", img: "/providers/mac88.png" },
  mancala: { label: "Mancala Gaming", img: "/providers/mancala.png" },
  microgaming: { label: "Microgaming", img: "/providers/microgaming.png" },
  minigames: { label: "MiniGames", img: "/providers/minigames.png" },
  mtgame: { label: "MT.GAME", img: "/providers/mtgame.png" },
  netent: { label: "NetEnt", img: "/providers/netent.png" },
  nextspin: { label: "Nextspin", img: "/providers/nextspin.png" },
  odin: { label: "Odin", img: "/providers/odin.png" },
  ongaming: { label: "Ongaming", img: "/providers/ongaming.png" },
  onlyplay: { label: "Onlyplay", img: "/providers/onlyplay.png" },
  "penguin-king": { label: "Penguin King", img: "/providers/penguin-king.png" },
  pgsoft: { label: "PG Soft", img: "/providers/pgsoft.png" },
  pix: { label: "Pix", img: "/providers/pix.png" },
  playngo: { label: "Play'n GO", img: "/providers/playngo.png" },
  playson: { label: "Playson", img: "/providers/playson.png" },
  playtech: { label: "Playtech", img: "/providers/playtech.png" },
  pragmatic: { label: "Pragmatic Play", img: "/providers/pragmatic.png" },
  pragmaticlive: { label: "Pragmatic Play Live", img: "/providers/pragmaticlive.png" },
  psg: { label: "PSG", img: "/providers/psg.png" },
  rectangle: { label: "Rectangle", img: "/providers/rectangle.png" },
  redtiger: { label: "Red Tiger", img: "/providers/redtiger.png" },
  relax: { label: "Relax Gaming", img: "/providers/relax.png" },
  revolver: { label: "Revolver Gaming", img: "/providers/revolver.png" },
  "rich-gaming": { label: "Rich Gaming", img: "/providers/rich-gaming.png" },
  rich88: { label: "Rich88", img: "/providers/rich88.png" },
  rubyplay: { label: "RubyPlay", img: "/providers/rubyplay.png" },
  "sa-gaming": { label: "SA Gaming", img: "/providers/sa-gaming.png" },
  sbobet: { label: "SBOBET", img: "/providers/sbobet.png" },
  sgamingsoft: { label: "SGamingSoft", img: "/providers/sgamingsoft.png" },
  skywind: { label: "Skywind Group", img: "/providers/skywind.png" },
  smartsoft: { label: "SmartSoft Gaming", img: "/providers/smartsoft.png" },
  spadegaming: { label: "Spadegaming", img: "/providers/spadegaming.png" },
  spribe: { label: "Spribe", img: "/providers/spribe.png" },
  tada: { label: "TaDa Gaming", img: "/providers/tada.png" },
  topbet: { label: "TopBet", img: "/providers/topbet.png" },
  "turbo-games": { label: "Turbo Games", img: "/providers/turbo-games.png" },
  "united-gaming": { label: "United Gaming", img: "/providers/united-gaming.png" },
  v8poker: { label: "V8Poker", img: "/providers/v8poker.png" },
  veliplay: { label: "VeliPlay", img: "/providers/veliplay.png" },
  "victory-ark": { label: "Victory Ark Gaming", img: "/providers/victory-ark.png" },
  vplus: { label: "VPlus", img: "/providers/vplus.png" },
  wintoslots: { label: "WinToSlots", img: "/providers/wintoslots.png" },
  "wm-casino": { label: "WM Casino", img: "/providers/wm-casino.png" },
  wonwon: { label: "WonWon", img: "/providers/wonwon.png" },
  ws168: { label: "WS168", img: "/providers/ws168.png" },
  yeebet: { label: "Yeebet Gaming", img: "/providers/yeebet.png" },
  "yellow-bat": { label: "Yellow Bat", img: "/providers/yellow-bat.png" },
};

/** Display order for the providers page: alphabetical by what a player reads. */
export const providerOrder = Object.keys(providerBrands).sort((a, b) =>
  providerBrands[a].label.localeCompare(providerBrands[b].label)
);

export default providerBrands;
