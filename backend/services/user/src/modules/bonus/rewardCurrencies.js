'use strict';

const { BONUS_CURRENCY } = require('./bonus.constants');
const { RAKEBACK_CURRENCY } = require('../rakeback/rakeback.constants');

/**
 * Resolve the wallet currencies VIP bonuses and Instant Rakeback credit into.
 *
 * Those values live on `siteconfig` (admin-owned). user-service does not load
 * the admin model domain, so it asks over the internal API — same shape as
 * sports-service's sports-enabled flag. A short TTL cache keeps overview /
 * claim bursts from hammering admin-service; on failure the historical
 * constants are used so a claim is never blocked by an unrelated outage.
 */

const DEFAULT_TTL_MS = 5_000;
const INTERNAL_PATH = '/internal/admin/site-config/rewards';

const DEFAULTS = Object.freeze({
  bonusCurrency: BONUS_CURRENCY,
  rakebackCurrency: RAKEBACK_CURRENCY,
});

function createRewardCurrencyResolver({ clients, logger, ttlMs = DEFAULT_TTL_MS } = {}) {
  let cached = { value: { ...DEFAULTS }, expires: 0 };
  let inFlight = null;

  async function read() {
    if (!clients?.admin) return { ...DEFAULTS };
    if (cached.expires > Date.now()) return cached.value;
    if (inFlight) return inFlight;

    inFlight = clients.admin
      .get(INTERNAL_PATH)
      .then((body) => {
        const value = {
          bonusCurrency: String(body?.bonusCurrency || DEFAULTS.bonusCurrency).toUpperCase(),
          rakebackCurrency: String(body?.rakebackCurrency || DEFAULTS.rakebackCurrency).toUpperCase(),
        };
        cached = { value, expires: Date.now() + ttlMs };
        return value;
      })
      .catch((error) => {
        logger?.warn({ err: error }, 'Could not read reward currencies — using defaults');
        cached = { value: { ...DEFAULTS }, expires: Date.now() + ttlMs };
        return { ...DEFAULTS };
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  }

  return {
    bonusCurrency: async () => (await read()).bonusCurrency,
    rakebackCurrency: async () => (await read()).rakebackCurrency,
    all: read,
    /** Test helper — drop the cache between cases. */
    _reset() {
      cached = { value: { ...DEFAULTS }, expires: 0 };
      inFlight = null;
    },
  };
}

/** Module-level resolver filled once from a service that has `clients`. */
let shared = null;

function rewardCurrencies(deps) {
  if (deps?.clients) {
    shared = createRewardCurrencyResolver(deps);
  }
  if (!shared) {
    shared = createRewardCurrencyResolver(deps || {});
  }
  return shared;
}

module.exports = {
  createRewardCurrencyResolver,
  rewardCurrencies,
  DEFAULTS,
  INTERNAL_PATH,
};
