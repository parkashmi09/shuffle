'use strict';

/**
 * The VIP ladder, keyed on lifetime wager.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * THIS LADDER REPLACED THE LEGACY ONE, AND IT MOVED EVERY PLAYER
 *
 * Until now this file held 75 numbered bands lifted verbatim from
 * `legacy/bonus/calculateVip.js`, running from 1 XP to 15,058,625,000 across
 * five cards (`brownz`, `silver`, `gold`, `platinum`, `diamond`).
 *
 * It now holds the ladder the reference platform publishes: **41 levels in
 * nine tiers**, read off the live signed-in VIP page rather than guessed —
 * Wood, then Bronze, Silver, Gold, Platinum, Jade, Sapphire, Ruby and Diamond
 * at five sub-levels each. The VIP page renders one accordion per tier, which
 * is why the tier is part of the data and not something the UI infers.
 *
 * ── WHAT THIS CHANGED, IN PLAIN TERMS ────────────────────────────────────
 *
 * A player's level is a function of their lifetime wager, and the function
 * changed, so **every existing player's VIP level changed with it** — nothing
 * was migrated because there is nothing stored to migrate. Two consequences
 * worth stating out loud:
 *
 *   THE ENTRY POINT MOVED UP. The old ladder started at 1 XP; this one starts
 *   at 500. A player between 1 and 499 was VIP 1 and is now VIP 0.
 *
 *   THE TOP MOVED DOWN, A LOT. The old top band began at 15,058,625,000; this
 *   one begins at 37,000,000 — about 400× lower. Players who were mid-ladder
 *   are now at or near the top.
 *
 * `bonus.constants.js` was re-gated to match (see the note there). If this
 * ladder is ever reverted, those thresholds have to move back with it: they
 * are level numbers, and level numbers mean something different here.
 *
 * ── LEVELS STAY NUMBERS ──────────────────────────────────────────────────
 *
 * The reference identifies levels by name (`BRONZE_1`). Here `level` is still
 * an ordinal 1…41, because every caller compares it numerically —
 * `bonus.service.js` gates on `vip.level >= spec.minVipLevel`, reports sort on
 * it — and a string would break all of them silently. `name` carries the
 * display form, so nothing downstream has to rebuild "Bronze 1" from a tier
 * and an offset.
 *
 * ── TWO THINGS THE LEGACY VERSION GOT WRONG, STILL FIXED ─────────────────
 *
 * 1. IT NAMED THE FIELDS BACKWARDS. `getVipLevelDetails` returned
 *    `vipLevel: nextVip.level` and `previousVipLevel: vip.level` — so the
 *    field called vipLevel was the level the player had NOT reached yet, and
 *    the one they actually held was called previous.
 *
 * 2. A PLAYER ABOVE THE TOP BAND FELL TO ZERO. Past the last band the function
 *    returned `{ error: ... }` with no level field, and the caller's
 *    `parseInt(undefined) || 0` made them VIP 0 — so the platform's biggest
 *    player would silently lose every bonus they qualified for. The top band
 *    is open-ended here.
 * ═════════════════════════════════════════════════════════════════════════
 */

/**
 * The bands. `minXp` is the "XP required" figure the VIP page prints for that
 * level; `maxXp` runs to one below the next band's floor. `maxXp` on the final
 * band is ignored — see the open-ended branch in `vipLevelFor`.
 */
const VIP_LEVELS = Object.freeze([
  { level:  1, name: 'Wood',        card: 'wood',     minXp:      500, maxXp:      999 },

  { level:  2, name: 'Bronze 1',    card: 'bronze',   minXp:     1000, maxXp:     1999 },
  { level:  3, name: 'Bronze 2',    card: 'bronze',   minXp:     2000, maxXp:     2999 },
  { level:  4, name: 'Bronze 3',    card: 'bronze',   minXp:     3000, maxXp:     3999 },
  { level:  5, name: 'Bronze 4',    card: 'bronze',   minXp:     4000, maxXp:     4999 },
  { level:  6, name: 'Bronze 5',    card: 'bronze',   minXp:     5000, maxXp:     9999 },

  { level:  7, name: 'Silver 1',    card: 'silver',   minXp:    10000, maxXp:    19999 },
  { level:  8, name: 'Silver 2',    card: 'silver',   minXp:    20000, maxXp:    29999 },
  { level:  9, name: 'Silver 3',    card: 'silver',   minXp:    30000, maxXp:    39999 },
  { level: 10, name: 'Silver 4',    card: 'silver',   minXp:    40000, maxXp:    49999 },
  { level: 11, name: 'Silver 5',    card: 'silver',   minXp:    50000, maxXp:    99999 },

  { level: 12, name: 'Gold 1',      card: 'gold',     minXp:   100000, maxXp:   149999 },
  { level: 13, name: 'Gold 2',      card: 'gold',     minXp:   150000, maxXp:   199999 },
  { level: 14, name: 'Gold 3',      card: 'gold',     minXp:   200000, maxXp:   249999 },
  { level: 15, name: 'Gold 4',      card: 'gold',     minXp:   250000, maxXp:   299999 },
  { level: 16, name: 'Gold 5',      card: 'gold',     minXp:   300000, maxXp:   449999 },

  { level: 17, name: 'Platinum 1',  card: 'platinum', minXp:   450000, maxXp:   599999 },
  { level: 18, name: 'Platinum 2',  card: 'platinum', minXp:   600000, maxXp:   749999 },
  { level: 19, name: 'Platinum 3',  card: 'platinum', minXp:   750000, maxXp:   899999 },
  { level: 20, name: 'Platinum 4',  card: 'platinum', minXp:   900000, maxXp:  1049999 },
  { level: 21, name: 'Platinum 5',  card: 'platinum', minXp:  1050000, maxXp:  1199999 },

  { level: 22, name: 'Jade 1',      card: 'jade',     minXp:  1200000, maxXp:  1349999 },
  { level: 23, name: 'Jade 2',      card: 'jade',     minXp:  1350000, maxXp:  1499999 },
  { level: 24, name: 'Jade 3',      card: 'jade',     minXp:  1500000, maxXp:  1649999 },
  { level: 25, name: 'Jade 4',      card: 'jade',     minXp:  1650000, maxXp:  1799999 },
  { level: 26, name: 'Jade 5',      card: 'jade',     minXp:  1800000, maxXp:  2299999 },

  { level: 27, name: 'Sapphire 1',  card: 'sapphire', minXp:  2300000, maxXp:  2799999 },
  { level: 28, name: 'Sapphire 2',  card: 'sapphire', minXp:  2800000, maxXp:  3299999 },
  { level: 29, name: 'Sapphire 3',  card: 'sapphire', minXp:  3300000, maxXp:  3799999 },
  { level: 30, name: 'Sapphire 4',  card: 'sapphire', minXp:  3800000, maxXp:  4299999 },
  { level: 31, name: 'Sapphire 5',  card: 'sapphire', minXp:  4300000, maxXp:  5799999 },

  { level: 32, name: 'Ruby 1',      card: 'ruby',     minXp:  5800000, maxXp:  7299999 },
  { level: 33, name: 'Ruby 2',      card: 'ruby',     minXp:  7300000, maxXp:  8799999 },
  { level: 34, name: 'Ruby 3',      card: 'ruby',     minXp:  8800000, maxXp: 10299999 },
  { level: 35, name: 'Ruby 4',      card: 'ruby',     minXp: 10300000, maxXp: 11799999 },
  { level: 36, name: 'Ruby 5',      card: 'ruby',     minXp: 11800000, maxXp: 16999999 },

  { level: 37, name: 'Diamond 1',   card: 'diamond',  minXp: 17000000, maxXp: 21999999 },
  { level: 38, name: 'Diamond 2',   card: 'diamond',  minXp: 22000000, maxXp: 26999999 },
  { level: 39, name: 'Diamond 3',   card: 'diamond',  minXp: 27000000, maxXp: 31999999 },
  { level: 40, name: 'Diamond 4',   card: 'diamond',  minXp: 32000000, maxXp: 36999999 },
  { level: 41, name: 'Diamond 5',   card: 'diamond',  minXp: 37000000, maxXp: 99999999999 },
]);

const { makeLadder } = require('./vipLadder');

/**
 * The platform ladder as a value. The arithmetic — open-ended top, string
 * comparison, distance to the first band — lives in `vipLadder.js`, shared
 * with every other ladder a site may choose (see `vipLadders.js`), so two
 * ladders can never disagree about HOW a wager becomes a level, only about
 * WHERE the bands sit.
 *
 * `bonusGates` are the reference platform's own: daily and weekly from
 * Bronze 1 (1,000 lifetime wager), monthly from Silver 1 (10,000). See the
 * note in `services/user/src/modules/bonus/bonus.constants.js`.
 */
const PLATFORM_LADDER = makeLadder({
  key: 'platform',
  label: 'Platform ladder — 41 levels, Wood to Diamond',
  bands: VIP_LEVELS,
  unranked: { level: 0, name: 'Unranked', card: 'unranked' },
  bonusGates: { daily: 2, weekly: 2, monthly: 7 },
});

/** Level 0 — signed up, has not wagered enough to reach the first band. */
const UNRANKED = PLATFORM_LADDER.unranked;

/** `2` → `Bronze 1`. `0` and anything off the ladder → `Unranked`. */
const vipLevelName = PLATFORM_LADDER.levelName;

/**
 * Which VIP level a lifetime wager buys, on the PLATFORM ladder.
 *
 * Callers that serve a site should prefer `resolveVipLadder(models)` from
 * `vipLadders.js`, which honours the site's `vip` variant; this stays the
 * default for anything that has no site context.
 */
const vipLevelFor = PLATFORM_LADDER.levelFor;

module.exports = { VIP_LEVELS, UNRANKED, vipLevelName, vipLevelFor, PLATFORM_LADDER };
