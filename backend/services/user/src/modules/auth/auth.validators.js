'use strict';

const { z } = require('@ibitplay/common');

/**
 * Auth request schemas.
 *
 * The password rule is length-first. Composition rules ("one uppercase, one
 * symbol") push people toward `Password1!` — predictable to an attacker and
 * hard for the person to remember — so the floor is 10 characters with no
 * character-class requirement, which is both stronger and kinder.
 */
const password = z
  .string({ required_error: 'password is required' })
  .min(10, 'password must be at least 10 characters')
  .max(200, 'password must be at most 200 characters');

/** Login accepts a username, an email or a phone number in one field. */
const identifier = z.string().trim().min(1, 'username or email is required').max(255);

const login = {
  body: z
    .object({
      identifier,
      password: z.string().min(1, 'password is required'),
      // Present only when the account has 2FA enabled.
      twoFactorCode: z.string().trim().regex(/^\d{6}$/, 'the code is 6 digits').optional(),
      deviceLabel: z.string().trim().max(100).optional(),
    })
    .strict(),
};

const refresh = {
  body: z.object({ refreshToken: z.string().min(20, 'refreshToken is required') }).strict(),
};

const logout = {
  body: z
    .object({
      refreshToken: z.string().min(20).optional(),
      // "Sign out everywhere" after a suspected compromise.
      allSessions: z.boolean().default(false),
    })
    .strict(),
};

const changePassword = {
  body: z
    .object({
      currentPassword: z.string().min(1, 'currentPassword is required'),
      newPassword: password,
    })
    .strict()
    .refine((v) => v.currentPassword !== v.newPassword, {
      message: 'The new password must be different from the current one',
      path: ['newPassword'],
    }),
};

/**
 * Registration.
 *
 * `username` is `min(3).max(60)`, which is the rule the admin players module
 * already applies to the same column — duplicated rather than shared for the
 * reason `registration.constants.js` gives about those two services.
 *
 * The socket handler coerces every field (`String(x ?? '').trim()`) because a
 * socket payload is untyped. A validated body does not need that, so the
 * controller passes `req.body` through and the coercion stays where it is
 * needed. `email` is lower-cased HERE rather than in the service, matching
 * what the socket did before calling it.
 *
 * `.strict()` like every other schema in this file: an unexpected key is a
 * client bug and silently dropping it is how a typo'd `referalCode` becomes a
 * referral that never happened.
 */
const register = {
  body: z
    .object({
      username: z.string().trim().min(3, 'username must be at least 3 characters').max(60),
      password,
      email: z.string().trim().toLowerCase().email('a valid email is required').max(255),
      // Nullable rather than absent: `register` writes `phone ?? null`.
      phone: z.string().trim().max(30).optional(),
      referredBy: z.string().trim().max(60).optional(),
      country: z.string().trim().max(60).optional(),
    })
    .strict(),
};

/**
 * Begin a password reset.
 *
 * Only an address, and the service answers identically whether or not it is
 * registered — so this schema must not become the thing that distinguishes
 * them. Keep it to a shape check: rejecting a malformed address is fine,
 * rejecting an unregistered one would undo the service's own care.
 */
const requestPasswordReset = {
  body: z
    .object({ email: z.string().trim().toLowerCase().email('a valid email is required').max(255) })
    .strict(),
};

/**
 * Finish a reset with the token from the email.
 *
 * `newPassword` takes the same floor as every other password here. No
 * `currentPassword` and no session: holding the token IS the proof, which is
 * why the token is single-use and short-lived in the service.
 */
const completePasswordReset = {
  body: z
    .object({
      token: z.string().trim().min(1, 'token is required').max(512),
      newPassword: password,
    })
    .strict(),
};

/** The session id is a bigint on the wire, so it arrives as a digit string. */
const revokeSession = {
  params: z.object({ sessionId: z.string().trim().regex(/^\d+$/, 'sessionId must be numeric') }),
};

module.exports = {
  login,
  refresh,
  logout,
  changePassword,
  register,
  requestPasswordReset,
  completePasswordReset,
  revokeSession,
  password,
  identifier,
};
