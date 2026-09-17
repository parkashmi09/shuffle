'use strict';

const { resolveVipLadder } = require('@ibitplay/common');

/**
 * Where a player stands on the ladder — THIS site's ladder.
 *
 * Both reads are thin on purpose: the arithmetic lives in
 * `packages/common/src/vipLadder.js` and the choice of ladder in
 * `vipLadders.js`, both shared with `bonus.service.js`, the profile socket
 * and the operator's reports. That is what keeps the level shown on the VIP
 * page, the level the bonus gates compare against and the level a support
 * agent reads from ever disagreeing.
 */
class VipService {
  constructor({ models, logger }) {
    this.models = models;
    this.logger = logger;
  }

  #ladder() {
    return resolveVipLadder(this.models, { logger: this.logger });
  }

  /**
   * The ladder. Same for everyone on this site, no login.
   *
   * `maxXp` on the top band is `null` rather than its stored number:
   * `levelFor` treats the last band as OPEN-ENDED — that is the fix for
   * legacy's biggest-player-becomes-VIP-0 bug — so publishing a ceiling there
   * would describe behaviour the platform does not have.
   */
  async levels() {
    const ladder = await this.#ladder();
    return {
      ladder: ladder.key,
      label: ladder.label,
      unranked: ladder.unranked,
      bonusGates: ladder.bonusGates,
      levels: ladder.publish(),
    };
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
    const [ladder, row] = await Promise.all([
      this.#ladder(),
      this.models.Userwager.findOne({ where: { uid: userId }, raw: true }),
    ]);

    const raw = row?.wager;
    const cleaned = raw == null ? '0' : String(raw).replace(/,/g, '').trim();
    const wager = /^-?\d+(\.\d+)?$/.test(cleaned) ? cleaned : '0';

    return { ...ladder.levelFor(wager), ladder: ladder.key, totalLevels: ladder.levels.length };
  }
}

module.exports = { VipService };
