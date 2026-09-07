'use strict';

const { Router } = require('express');
const { validate, createRateLimiter } = require('@ibitplay/common');

const v = require('../auth.validators');
const { AuthService } = require('../auth.service');
const { createPublicController } = require('../controllers/public.controller');

/**
 * Unauthenticated auth routes.
 *
 * The only `public` router in the platform so far, and the one place a rate
 * limiter is declared per-route rather than left to the global one: login is
 * where a password list gets tried, and the global budget is far too generous
 * for that.
 */
module.exports = function publicRoutes(deps) {
  const service = new AuthService(deps);
  const ctrl = createPublicController({ service });

  const router = Router();

  const loginLimiter = createRateLimiter({
    name: 'auth:login',
    windowMs: 15 * 60_000,
    max: 20,
    enabled: deps.config.RATE_LIMIT_ENABLED !== false,
  });

  /**
   * Registration and reset each send mail to an address the CALLER names, and
   * registration makes a row. Both were metered on the socket at 5 an hour
   * (`limit: { windowMs: 60 * 60_000, max: 5 }`) and carry the same budget
   * here — unmetered, `forgot-password` is a way to have this platform email
   * somebody repeatedly, and `register` is a way to fill `users`.
   *
   * ONE LIMITER SHARED BY THE TWO RESET ROUTES, not one each: they are two
   * halves of one flow, and giving `reset-password` its own budget would let a
   * caller burn through tokens it obtained under the first.
   */
  const signupLimiter = createRateLimiter({
    name: 'auth:register',
    windowMs: 60 * 60_000,
    max: 5,
    enabled: deps.config.RATE_LIMIT_ENABLED !== false,
  });

  const resetLimiter = createRateLimiter({
    name: 'auth:reset',
    windowMs: 60 * 60_000,
    max: 5,
    enabled: deps.config.RATE_LIMIT_ENABLED !== false,
  });

  router.post('/login', loginLimiter, validate(v.login), ctrl.login);
  router.post('/refresh', validate(v.refresh), ctrl.refresh);

  /**
   * @legacy SOCKET `C.REGISTER_USER` / `C.RESET_PASSWORD`
   *
   * The three below are HTTP over service methods that already existed and
   * were reachable only from `sockets.js`. Nothing about the logic is new —
   * `AuthService.register`, `.requestPasswordReset` and `.completePasswordReset`
   * are unchanged. Until these existed a browser client could not create an
   * account at all, which made every other player route unreachable for a new
   * visitor.
   *
   * The paths are the ones the front-end already declares in
   * `src/services/endpoints.js`.
   */
  router.post('/register', signupLimiter, validate(v.register), ctrl.register);
  router.post(
    '/forgot-password',
    resetLimiter,
    validate(v.requestPasswordReset),
    ctrl.requestPasswordReset
  );
  router.post(
    '/reset-password',
    resetLimiter,
    validate(v.completePasswordReset),
    ctrl.completePasswordReset
  );

  return router;
};
