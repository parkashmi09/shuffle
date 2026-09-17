'use strict';

/**
 * A VIP ladder as a value: bands in, `levelFor(wager)` out.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * WHY A FACTORY
 *
 * The platform ships one ladder (41 levels, Wood to Diamond) and a site may
 * choose another through its `vip` feature variant — Addaplay keeps the
 * 75-band ladder its players were ranked on. Both need the SAME arithmetic:
 * the open-ended top band, the string-not-number comparison, the distance to
 * the first band for an unranked player. One implementation, parameterised by
 * its bands, is how those stay identical. A second copy of `levelFor` is how
 * a player becomes VIP 30 on one screen and VIP 29 on another.
 * ═════════════════════════════════════════════════════════════════════════
 *
 * A band is `{ level, name, card, minXp, maxXp }`. `maxXp` on the last band is
 * ignored: the top is open-ended. `bonusGates` are the level NUMBERS the three
 * recurring bonuses require on THIS ladder — level numbers mean different
 * things on different ladders, so they travel with the bands.
 */
function makeLadder({ key, label, bands, unranked, bonusGates }) {
  if (!key) throw new Error('makeLadder: a ladder needs a key');
  if (!Array.isArray(bands) || bands.length === 0) throw new Error(`makeLadder(${key}): no bands`);
  for (const g of ['daily', 'weekly', 'monthly']) {
    if (!Number.isInteger(bonusGates?.[g])) throw new Error(`makeLadder(${key}): bonusGates.${g} must be a level number`);
  }

  const levels = Object.freeze(bands.map((b) => Object.freeze({ ...b })));
  const first = levels[0];
  const top = levels[levels.length - 1];
  const zero = Object.freeze({ level: 0, name: 'Unranked', card: 'unranked', ...unranked });

  /** `2` → that band's display name. `0` and anything off the ladder → the unranked name. */
  const levelName = (level) => levels.find((band) => band.level === level)?.name ?? zero.name;

  /**
   * Which VIP level a lifetime wager buys.
   *
   * Takes a decimal STRING, not a number. Wagers carry eight decimal places
   * and the top bands run to eleven digits, which together exceed what a
   * double represents exactly — comparing them as numbers puts players on the
   * wrong side of a boundary. `Number` is used only after the band is chosen,
   * for the progress percentage, where a rounding error is cosmetic.
   *
   * Below the first band is level 0. Above the last band stays at the top
   * level rather than falling off the end — legacy returned an error object
   * there and its callers turned the platform's biggest player into VIP 0.
   */
  const levelFor = (wager) => {
    const amount = Number.parseFloat(String(wager ?? '0').replace(/,/g, '')) || 0;

    if (amount < Number(first.minXp)) {
      return {
        level: zero.level,
        name: zero.name,
        card: zero.card,
        wager: String(wager ?? '0'),
        nextLevel: first.level,
        nextName: first.name,
        // Distance to the first band, not the band's floor — a player 300 into
        // a 500 threshold needs 200 more, not 500.
        wagerToNextLevel: String(Number(first.minXp) - amount),
        progressPct: '0.00',
      };
    }

    if (amount >= Number(top.minXp)) {
      return {
        level: top.level,
        name: top.name,
        card: top.card,
        wager: String(wager ?? '0'),
        nextLevel: null,
        nextName: null,
        wagerToNextLevel: null,
        progressPct: '100.00',
      };
    }

    const index = levels.findIndex((v) => amount >= Number(v.minXp) && amount <= Number(v.maxXp));
    const band = levels[index];
    const next = levels[index + 1] ?? null;

    const span = Number(band.maxXp) - Number(band.minXp) + 1;
    const into = amount - Number(band.minXp);

    return {
      level: band.level,
      name: band.name,
      card: band.card,
      wager: String(wager ?? '0'),
      nextLevel: next ? next.level : null,
      nextName: next ? next.name : null,
      wagerToNextLevel: next ? String(Number(band.maxXp) - amount + 1) : null,
      progressPct: ((into / span) * 100).toFixed(2),
    };
  };

  /**
   * The ladder as `GET /user/vip/levels` publishes it. `maxXp` on the top band
   * is `null` rather than its stored number: `levelFor` treats that band as
   * open-ended, so publishing a ceiling would describe behaviour the platform
   * does not have.
   */
  const publish = () =>
    levels.map((band) => ({
      level: band.level,
      name: band.name,
      minXp: String(band.minXp),
      maxXp: band.level === top.level ? null : String(band.maxXp),
      card: band.card,
    }));

  return Object.freeze({
    key,
    label: label ?? key,
    levels,
    unranked: zero,
    top,
    bonusGates: Object.freeze({ ...bonusGates }),
    levelName,
    levelFor,
    publish,
  });
}

module.exports = { makeLadder };
