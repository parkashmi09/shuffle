/**
 * What this site offers — the same file in every CFZ site.
 *
 * GENERATED FROM admins/frontend-kit/siteFeatures.js by agents/push-frontend-kit.mjs.
 *
 * Reads `GET /api/v1/admin/features/public` once per page load. Use it to
 * decide what to DRAW — the Register button, the manual-deposit tab, a
 * feature's page. It is not a guard: the backend refuses whatever its policy
 * does not allow, with a message a player can read, whether or not the
 * button was hidden.
 *
 *   const site = await loadSiteFeatures({ apiBase })
 *   site.policy('business_model')   // 'b2c' | 'b2b' | 'hybrid'
 *   site.canSignUp()                // false on a B2B site
 *   site.depositRoutes()            // { manual: bool, automatic: bool }
 *   site.withdrawalRoutes()         // { manual: bool, automatic: bool }
 *   site.variant('vip')             // 'stake' | 'bcgame' | … | null when off
 */

const DEFAULTS = { business_model: 'hybrid', deposit_mode: 'both', withdrawal_mode: 'both' };

let cached = null;

const routes = (mode) => ({
  manual: mode === 'manual' || mode === 'both',
  automatic: mode === 'automatic' || mode === 'both',
});

function wrap(list) {
  const byKey = new Map(list.map((f) => [f.feature, f]));
  const policy = (key) => byKey.get(key)?.variant ?? DEFAULTS[key];
  return {
    list,
    policy,
    variant: (key) => byKey.get(key)?.variant ?? null,
    config: (key) => byKey.get(key)?.config ?? {},
    canSignUp: () => policy('business_model') !== 'b2b',
    depositRoutes: () => routes(policy('deposit_mode')),
    withdrawalRoutes: () => routes(policy('withdrawal_mode')),
  };
}

/**
 * Never throws. A backend that is down reads as today's behaviour — every
 * route open — so a page never hides a working cashier because a read failed.
 */
export function loadSiteFeatures({ apiBase = '' } = {}) {
  if (cached) return cached;
  cached = fetch(`${String(apiBase).replace(/\/+$/, '')}/api/v1/admin/features/public`, { credentials: 'omit' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => wrap(Array.isArray(j?.data) ? j.data : []))
    .catch(() => wrap([]));
  return cached;
}
