'use strict';

const { Router } = require('express');
const { z } = require('zod');
const { validate, response, asyncHandler } = require('@ibitplay/common');

const { VipService } = require('../vip.service');

/**
 * VIP side-effects for the services that settle wagers.
 *
 * Mounted at `/internal/user/vip`. casino-service posts here after every stake
 * that moves `userwager`, so the rakeback rate and level-up credits stay in
 * lockstep with the ladder the player actually holds.
 */
const wagerDecimal = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, 'wager must be a non-negative decimal');

const onWager = {
  body: z
    .object({
      userId: z.coerce.number().int().positive(),
      previousWager: wagerDecimal,
      newWager: wagerDecimal,
    })
    .strict(),
};

const awardPeriodic = {
  body: z
    .object({
      userId: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().positive().max(5000).optional(),
    })
    .strict()
    .default({}),
};

module.exports = function internalRoutes(deps) {
  const service = new VipService(deps);
  const router = Router();

  router.post(
    '/on-wager',
    validate(onWager),
    asyncHandler(async (req, res) => response.ok(res, await service.onWager(req.body)))
  );

  /**
   * Manual / test trigger for the same work the worker runs on an interval.
   * Restricted to internal callers; useful so E2E tests do not need a worker
   * process spinning.
   */
  router.post(
    '/award-periodic',
    validate(awardPeriodic),
    asyncHandler(async (req, res) =>
      response.ok(res, await service.awardPeriodic(req.body ?? {}))
    )
  );

  return router;
};
