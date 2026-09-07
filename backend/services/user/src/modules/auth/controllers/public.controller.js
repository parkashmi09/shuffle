'use strict';

const { response, asyncHandler } = require('@ibitplay/common');

/** Unauthenticated auth endpoints — the ones that MINT a session. */
function createPublicController({ service }) {
  const context = (req) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

  return {
    login: asyncHandler(async (req, res) => {
      const result = await service.login(req.body, context(req));
      return response.ok(res, result);
    }),

    refresh: asyncHandler(async (req, res) => {
      const result = await service.refresh(req.body, context(req));
      return response.ok(res, result);
    }),

    /**
     * Create an account.
     *
     * `201`, because this is the one endpoint in the module that makes a row.
     * The service answers `{ id, name, email }` and deliberately no password
     * and no session — legacy returned the password to the client that had
     * just typed it, and registering does not sign you in here. The client
     * calls `login` next, which is also what the socket flow did.
     *
     * `id` is serialised because it is a bigint: `JSON.stringify` turns a JS
     * number past 2^53 into something that is not the id. Every other id on
     * this service's wire is a string for the same reason.
     */
    register: asyncHandler(async (req, res) => {
      const created = await service.register(req.body, context(req));
      return response.created(res, { ...created, id: String(created.id) });
    }),

    /**
     * Begin a password reset.
     *
     * THE REPLY IS THE SAME WHETHER OR NOT THE ADDRESS IS REGISTERED, and the
     * service computes it before it branches so the two paths cost the same
     * time as well. Passing that value straight through is the point — any
     * shaping here (a 404 for an unknown address, a different message) would
     * turn this into an account-enumeration oracle and undo that care.
     */
    requestPasswordReset: asyncHandler(async (req, res) => {
      const result = await service.requestPasswordReset(req.body, context(req));
      return response.ok(res, result);
    }),

    /** Finish a reset. The token is the credential, so there is no session. */
    completePasswordReset: asyncHandler(async (req, res) => {
      const result = await service.completePasswordReset(req.body);
      return response.ok(res, result);
    }),
  };
}

module.exports = { createPublicController };
