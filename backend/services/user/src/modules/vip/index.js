'use strict';

/**
 * The VIP ladder, and where a player stands on it.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * GAP 4 ASKED FOR A LADDER TABLE. THERE ALREADY IS A LADDER.
 *
 * `packages/common/src/vipLevels.js` holds all 75 bands — level, `minXp`,
 * `maxXp` and the card tier — lifted verbatim from `legacy/bonus/calculateVip.js`
 * so a transcription slip could not move a player between levels. And
 * `vipLevelFor(wager)` already returns exactly what a player's own view needs:
 * level, card, wager, next level, wager to next level and a progress
 * percentage.
 *
 * So this module adds NO migration and NO computation. `bonus.service.js` has
 * been calling `vipLevelFor` since the port and returning it INSIDE the bonus
 * payload; what was missing was a way to ask for the ladder at all, and a way
 * to ask for a player's standing without also fetching every bonus type.
 *
 * ── THE PATHS ARE NOT THE ONES GAP 4 PROPOSED ────────────────────────────
 *
 * It suggested `GET /vip/levels` and `GET /user/vip`. Every route on this
 * service mounts under `/api/v1/user/`, whatever the audience — `auth`'s public
 * router puts login at `/api/v1/user/auth/login` — so a bare `/vip/levels` is
 * not reachable from here. `GET /user/vip/levels` is the same resource under
 * the prefix the service actually owns.
 *
 * The ladder is on the PUBLIC router: it is identical for everyone and a
 * signed-out visitor looking at the VIP page needs it. A player's own standing
 * is on the user router.
 */
module.exports = {
  name: 'vip',
  service: 'user',
  basePath: '/vip',
  /* `core` for `Userwager`, which is the only table read. */
  models: ['core'],
  routers: {
    public: require('./routes/public.routes'),
    user: require('./routes/user.routes'),
  },
};
