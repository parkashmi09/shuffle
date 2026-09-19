'use strict';

const { Router } = require('express');
const { validate, createActivityRecorder, imageUpload } = require('@ibitplay/common');
const { PERMISSIONS } = require('@ibitplay/auth');

const v = require('../promotions.validators');
const { PromotionsService } = require('../promotions.service');
const { createControllers } = require('../controllers');
const errors = require('../promotions.errors');

const single = (field) => imageUpload.singleImage({ field, errors });

module.exports = function adminRoutes(deps) {
  const { auth, clients, logger, config } = deps;
  const ctrl = createControllers({ service: new PromotionsService(deps) });

  const withActivity = createActivityRecorder({
    client: clients.admin,
    logger,
    serviceName: config.SERVICE_NAME,
  });

  const router = Router();
  const canWrite = auth.requirePermission(PERMISSIONS.CONFIG_WRITE);

  router.post(
    '/',
    canWrite,
    ...single('image'),
    validate(v.create),
    withActivity({
      action: 'promotion.create',
      describe: (req) => ({
        targetType: 'PROMOTION',
        targetId: null,
        details: {
          segment: req.body.segment,
          title: req.body.title,
          published: req.body.isPublished === true || req.body.isPublished === 'true',
        },
      }),
    }),
    ctrl.create
  );

  router.patch(
    '/:id',
    canWrite,
    ...single('image'),
    validate(v.update),
    withActivity({
      action: 'promotion.update',
      describe: (req) => ({
        targetType: 'PROMOTION',
        targetId: req.params.id,
        details: { fields: Object.keys(req.body ?? {}) },
      }),
    }),
    ctrl.update
  );

  router.delete(
    '/:id',
    canWrite,
    validate(v.removeById),
    withActivity({
      action: 'promotion.delete',
      describe: (req) => ({ targetType: 'PROMOTION', targetId: req.params.id, details: {} }),
    }),
    ctrl.removeById
  );

  router.delete(
    '/slug/:segment/:slug',
    canWrite,
    validate(v.removeBySlug),
    withActivity({
      action: 'promotion.delete',
      describe: (req) => ({
        targetType: 'PROMOTION',
        targetId: req.params.slug,
        details: { segment: req.params.segment, by: 'slug' },
      }),
    }),
    ctrl.removeBySlug
  );

  return router;
};
