'use strict';

const { Router } = require('express');
const { validate, response, asyncHandler, createActivityRecorder } = require('@ibitplay/common');
const { PERMISSIONS } = require('@ibitplay/auth');

const v = require('../features.validators');
const { FeaturesService } = require('../features.service');

/**
 * The operator's view of this site's features.
 *
 * Reads need `config:read`; every write needs `config:write` and is audited.
 * The audit line records WHICH secret names changed and never their values —
 * the recorder is handed the body, so `details` is built here by hand rather
 * than passed through.
 */
module.exports = function adminRoutes(deps) {
  const { auth, clients, logger, config } = deps;
  const service = new FeaturesService(deps);
  const withActivity = createActivityRecorder({ client: clients.admin, logger, serviceName: config.SERVICE_NAME });
  const canRead = auth.requirePermission(PERMISSIONS.CONFIG_READ);
  const canWrite = auth.requirePermission(PERMISSIONS.CONFIG_WRITE);
  const router = Router();

  router.get('/catalogue', canRead, (_req, res) => response.ok(res, service.catalogue()));

  router.get('/', canRead, asyncHandler(async (_req, res) => response.ok(res, await service.list())));

  router.put(
    '/template',
    canWrite,
    validate(v.applyTemplate),
    withActivity({
      action: 'features.template',
      describe: (req) => ({ targetType: 'SITE', targetId: req.body.template, details: { enable: req.body.enable } }),
    }),
    asyncHandler(async (req, res) =>
      response.ok(res, await service.applyTemplate({ ...req.body, staff: req.staff }))
    )
  );

  router.put(
    '/:feature',
    canWrite,
    validate(v.update),
    withActivity({
      action: 'features.update',
      describe: (req) => ({
        targetType: 'FEATURE',
        targetId: req.params.feature,
        details: {
          enabled: req.body.enabled,
          variant: req.body.variant,
          config: req.body.config,
          secretsChanged: Object.keys(req.body.secrets ?? {}),
        },
      }),
    }),
    asyncHandler(async (req, res) =>
      response.ok(res, await service.update({ feature: req.params.feature, patch: req.body, staff: req.staff }))
    )
  );

  router.post(
    '/:feature/test',
    canWrite,
    validate(v.test),
    withActivity({
      action: 'features.test',
      describe: (req) => ({ targetType: 'FEATURE', targetId: req.params.feature, details: { userId: req.body.userId ?? null } }),
    }),
    asyncHandler(async (req, res) =>
      response.ok(res, await service.test({ feature: req.params.feature, ...req.body, staff: req.staff }))
    )
  );

  return router;
};
