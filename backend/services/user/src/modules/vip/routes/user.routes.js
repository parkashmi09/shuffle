'use strict';

const { Router } = require('express');

const { VipService } = require('../vip.service');
const { createControllers } = require('../controllers');

/**
 * A player's own standing.
 *
 * `GET /user/bonus` already carries this under a `vip` key. It is exposed on
 * its own because the VIP page wants the level and the progress bar without
 * also fetching six bonus types and their claim deadlines — and because
 * `/user/bonus` is the wrong thing for a page that is not about bonuses to
 * depend on.
 */
module.exports = function userRoutes(deps) {
  const ctrl = createControllers({ service: new VipService(deps) });
  const router = Router();
  router.get('/', ctrl.standing);
  return router;
};
