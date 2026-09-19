'use strict';

/**
 * Affiliate payout rates from `siteconfig`, via admin-service internal API.
 */

const DEFAULT_TTL_MS = 5_000;
const INTERNAL_PATH = '/internal/admin/site-config/affiliate';

const DEFAULTS = Object.freeze({
  affiliateBonus: '0.00000000',
  commissionPercent: '0.00000000',
  registerBonus: '0.00000000',
  registerBonusCurrency: 'BJB',
  affiliateBonusCurrency: 'BJB',
});

function createAffiliateSettingsResolver({ clients, logger, ttlMs = DEFAULT_TTL_MS } = {}) {
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
          affiliateBonus: String(body?.affiliateBonus ?? DEFAULTS.affiliateBonus),
          commissionPercent: String(body?.commissionPercent ?? DEFAULTS.commissionPercent),
          registerBonus: String(body?.registerBonus ?? DEFAULTS.registerBonus),
          registerBonusCurrency: String(body?.registerBonusCurrency ?? DEFAULTS.registerBonusCurrency).toUpperCase(),
          affiliateBonusCurrency: String(body?.affiliateBonusCurrency ?? DEFAULTS.affiliateBonusCurrency).toUpperCase(),
        };
        cached = { value, expires: Date.now() + ttlMs };
        return value;
      })
      .catch((error) => {
        logger?.warn({ err: error }, 'Could not read affiliate settings — using zeros');
        cached = { value: { ...DEFAULTS }, expires: Date.now() + ttlMs };
        return { ...DEFAULTS };
      })
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  }

  return {
    read,
    _reset() {
      cached = { value: { ...DEFAULTS }, expires: 0 };
      inFlight = null;
    },
  };
}

let shared = null;

function affiliateSettings(deps) {
  if (deps?.clients) {
    shared = createAffiliateSettingsResolver(deps);
  }
  if (!shared) {
    shared = createAffiliateSettingsResolver(deps || {});
  }
  return shared;
}

module.exports = {
  createAffiliateSettingsResolver,
  affiliateSettings,
  DEFAULTS,
  INTERNAL_PATH,
};
