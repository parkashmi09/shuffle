'use strict';

const { VIP_LEVELS, vipLevelFor } = require('@ibitplay/common');

/**
 * Where a player stands on the ladder.
 *
 * Both reads are thin on purpose — the arithmetic lives in
 * `packages/common/src/vipLevels.js` and is shared with `bonus.service.js`,
 * which is what keeps the level shown on the VIP page and the level the bonus
 * eligibility checks compare against from ever disagreeing.
 */
class VipService {
  constructor({ models, logger }) {
    this.models = models;
    this.logger = logger;
  }

  /**
   * The ladder. Same for everyone, no login.
   *
   * `maxXp` on the top band is returned as `null` rather than its stored
   * number: `vipLevelFor` treats the last band as OPEN-ENDED — that is the
   * fix for legacy's biggest-player-becomes-VIP-0 bug — so publishing a
   * ceiling there would describe behaviour the platform does not have.
   */
  levels() {
    const top = VIP_LEVELS[VIP_LEVELS.length - 1];
    return VIP_LEVELS.map((band) => ({
      level: band.level,
      minXp: String(band.minXp),
      maxXp: band.level === top.level ? null : String(band.maxXp),
      card: band.card,
    }));
  }

  /**
   * This player's standing.
   *
   * ── `userwager.wager` IS TEXT, AND MAY CARRY THOUSANDS SEPARATORS ──────
   *
   * Legacy wrote "1,234,567.89" into it. `Number("1,234")` is NaN, so a missed
   * `replace` here silently makes every player VIP 0 — the same trap
   * `bonus.service.js`'s `#wagerAmount` documents, and the reason this parses
   * rather than casts. Anything that is not a plain decimal after the strip is
   * treated as no wager, which is the honest reading of an unparseable counter.
   */
  async standing(userId) {
    const row = await this.models.Userwager.findOne({ where: { uid: userId }, raw: true });

    const raw = row?.wager;
    const cleaned = raw == null ? '0' : String(raw).replace(/,/g, '').trim();
    const wager = /^-?\d+(\.\d+)?$/.test(cleaned) ? cleaned : '0';

    return { ...vipLevelFor(wager), totalLevels: VIP_LEVELS.length };
  }
}

module.exports = { VipService };
