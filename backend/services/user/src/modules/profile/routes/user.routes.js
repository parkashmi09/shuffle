'use strict';

const { Router } = require('express');
const { validate } = require('@ibitplay/common');

const v = require('../profile.validators');
const { ProfileService } = require('../profile.service');
/**
 * Changing the address spends a verified code, and issuance and proof both
 * live in the email module. Imported directly rather than injected, which is
 * what `profile/sockets.js` already does for the same reason: the two modules
 * are in the same service and neither is a boundary.
 */
const { EmailService } = require('../../email/email.service');
const { createControllers } = require('../controllers');

module.exports = function userRoutes(deps) {
  const service = new ProfileService(deps);
  const emails = new EmailService(deps);
  const ctrl = createControllers({ service, emails });

  const router = Router();

  router.get('/', ctrl.get);
  router.put('/', validate(v.updateProfile), ctrl.update);
  router.get('/referral', ctrl.referral);
  /**
   * @legacy SOCKET `C.EDIT_ACCOUNT` (the email arm)
   *
   * `ProfileService.changeEmail` has existed and been correct since the port;
   * it simply had no route. `PUT /profile` accepts `username`, `country` and
   * `avatar` and nothing else, so this is its own path rather than a fourth
   * key there — the operation needs a second factor and the others do not.
   */
  router.post('/change-email', validate(v.changeEmail), ctrl.changeEmail);

  return router;
};
