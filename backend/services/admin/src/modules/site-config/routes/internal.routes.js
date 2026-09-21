'use strict';

const { Router } = require('express');
const { response, asyncHandler } = require('@ibitplay/common');

const { SiteConfigService } = require('../siteConfig.service');
const { FeaturesService } = require('../../features/features.service');

/**
 * How other services read the settings they need.
 *
 * user-service pays the registration bonus and the affiliate commission, but it
 * does not load the `admin` model domain and so cannot read `siteconfig`
 * directly. Rather than widening its domain list — which would hand it every
 * admin table to get three numbers — it asks for the three numbers.
 *
 * Read-only on purpose. A settings CHANGE stays behind a staff token on the
 * admin router, where it is permissioned and audited; there is no internal
 * write path that would let a service skip both.
 */
module.exports = function internalRoutes(deps) {
  const service = new SiteConfigService(deps);
  const featuresService = new FeaturesService(deps);
  const router = Router();

  router.get(
    '/affiliate',
    asyncHandler(async (_req, res) => response.ok(res, await service.affiliateSettings()))
  );

  /**
   * The sports flag, for sports-service.
   *
   * It sits in front of every feed endpoint, so it is read constantly — the
   * caller caches it for a few seconds and fails open if this is unreachable.
   */
  router.get(
    '/sports',
    asyncHandler(async (_req, res) => response.ok(res, await service.sportsEnabled()))
  );

  /**
   * Bonus + rakeback payout currencies, for user-service.
   *
   * Claim and overview paths resolve these on every credit so an operator
   * change on the Site Config screen takes effect without a deploy.
   */
  router.get(
    '/rewards',
    asyncHandler(async (_req, res) => response.ok(res, await service.rewardCurrencies()))
  );

  /**
   * The public flags and the public feature list, in one read — for
   * user-service's `getSiteConfig` socket event, which is how a player page
   * loads its config over the socket instead of two HTTP GETs.
   *
   * Both halves are the SAME allow-lists `GET /admin/site-config/public` and
   * `GET /admin/features/public` serve, so the socket can never carry more
   * than HTTP does.
   */
  router.get(
    '/public',
    asyncHandler(async (_req, res) => {
      const [flags, features] = await Promise.all([service.publicSettings(), featuresService.publicList()]);
      return response.ok(res, { flags, features });
    })
  );

  return router;
};
