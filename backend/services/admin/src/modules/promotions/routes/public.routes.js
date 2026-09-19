'use strict';

const { Router } = require('express');
const { validate } = require('@ibitplay/common');

const v = require('../promotions.validators');
const { PromotionsService } = require('../promotions.service');
const { createControllers } = require('../controllers');

module.exports = function publicRoutes(deps) {
  const ctrl = createControllers({ service: new PromotionsService(deps) });
  const router = Router();

  router.get('/sidebar', validate(v.sidebarList), ctrl.sidebar);
  router.get('/', validate(v.list), ctrl.list);
  router.get('/slug/:segment/:slug', validate(v.bySlug), ctrl.bySlug);
  router.get('/:id/image', validate(v.byId), ctrl.image);
  router.get('/:id', validate(v.byId), ctrl.byId);

  return router;
};
