'use strict';

const { response, asyncHandler } = require('@ibitplay/common');

function createControllers({ service }) {
  const page = (q) => ({ page: Math.floor(q.offset / q.limit) + 1, limit: q.limit });

  return {
    // ── Public ────────────────────────────────────────────────────────

    /**
     * Both races and their on/off state, in one request.
     *
     * The whole feature's visibility hangs off this, so a front end asks once
     * rather than probing each race and inferring "off" from a 404.
     */
    configs: asyncHandler(async (_req, res) => response.ok(res, await service.listConfigs())),

    /**
     * Standings.
     *
     * Public, but reads the session when there is one: `req.user` is populated
     * by the gateway's token check on any request that carries a token, and a
     * signed-in player wants their own rank whether or not they are winning.
     */
    leaderboard: asyncHandler(async (req, res) =>
      response.ok(res, await service.leaderboard({ type: req.params.type, userId: req.user?.id ?? null }))
    ),

    // ── Players ───────────────────────────────────────────────────────

    myRewards: asyncHandler(async (req, res) => {
      const result = await service.myRewards({ ...req.query, userId: req.user.id });
      return response.paginated(res, result.rows, {
        ...page(req.query),
        total: result.total,
        unclaimedTotal: result.unclaimedTotal,
        unclaimedCount: result.unclaimedCount,
        currency: result.currency,
      });
    }),

    claim: asyncHandler(async (req, res) =>
      response.ok(res, await service.claim({ userId: req.user.id, rewardId: req.params.rewardId }))
    ),

    // ── Staff ─────────────────────────────────────────────────────────

    getConfig: asyncHandler(async (req, res) => response.ok(res, await service.getConfig(req.params))),

    updateConfig: asyncHandler(async (req, res) =>
      response.ok(res, await service.updateConfig({ type: req.params.type, ...req.body }))
    ),

    listRaces: asyncHandler(async (req, res) => {
      const result = await service.listRaces(req.query);
      return response.paginated(res, result.rows, { ...page(req.query), total: result.total });
    }),

    listRewards: asyncHandler(async (req, res) => {
      const result = await service.listRewards(req.query);
      return response.paginated(res, result.rows, { ...page(req.query), total: result.total });
    }),

    /**
     * Settle now, rather than waiting for the window to close.
     *
     * The manual path and the automatic one call the SAME method — which is why
     * settlement lives in the service and not in the worker. The reference kept
     * the payout maths in its cron and a second copy elsewhere, and the two
     * drifted.
     */
    settle: asyncHandler(async (req, res) => response.ok(res, await service.settle({ raceId: req.params.id }))),

    listBoats: asyncHandler(async (_req, res) => response.ok(res, await service.listBoats())),
    addBoat: asyncHandler(async (req, res) => response.created(res, await service.addBoat(req.body))),
    updateBoat: asyncHandler(async (req, res) =>
      response.ok(res, await service.updateBoat({ id: req.params.id, ...req.body }))
    ),
    removeBoat: asyncHandler(async (req, res) => response.ok(res, await service.removeBoat(req.params))),
  };
}

module.exports = { createControllers };
