import { useSiteFeatures } from "./useSiteFeatures";
import { usePublicSiteConfig } from "./usePublicSiteConfig";

/**
 * What the owner's plan and the site admin's flags switch on — one table, as stake's `api/site.js`.
 *
 *   feature  the owner plan (`GET /admin/features/public`, listed = on)
 *   flag     the site admin's switch (`GET /admin/site-config/public`, `false` = off)
 *   anyOf    at least one of these flags must be `true`
 *   promo    also off on a B2B site
 *
 * Unknown keys and unanswered reads are OPEN — this decides what to draw; the backend refuses the rest.
 */
export const GATES = {
  casino: { flag: "casino" },
  // shuffle's /sports is the native exchange only (no third-party book iframe here).
  sports: { flag: "sports", anyOf: ["sportsexchange"] },
  lottery: { flag: "lotto" },
  vip: { feature: "vip", flag: "vipclub", promo: true },
  promotions: { feature: "promotions", promo: true },
  bonus: { feature: "bonus", flag: "bonus", promo: true },
  affiliate: { feature: "affiliate", flag: "affiliate", promo: true },
  races: { feature: "races", promo: true },
  challenges: { feature: "challenges", promo: true },
  blog: { feature: "blog" },
  banners: { feature: "banners", flag: "home_heroSection" },
  vault: { feature: "vault" },
  notifications: { feature: "notifications" },
  kyc: { feature: "kyc" },
};

export function makeGate({ features, flags }) {
  const listed = features?.list?.length ? new Set(features.list.map((f) => f.feature)) : null;
  const b2b = features?.policy?.("business_model") === "b2b";
  const on = (key) => {
    const gate = GATES[key];
    if (!gate) return true;
    if (gate.promo && b2b) return false;
    if (gate.feature && listed && !listed.has(gate.feature)) return false;
    if (gate.flag && flags && flags[gate.flag] === false) return false;
    if (gate.anyOf && flags && !gate.anyOf.some((k) => flags[k] === true)) return false;
    return true;
  };
  /** Both reads answered — a caller that would REQUEST a gated route waits for this, so an owner-off feature is never asked for. */
  on.ready = Array.isArray(features?.list) && flags != null;
  return on;
}

/** `const on = useGate(); on("vip")`. */
export function useGate() {
  const features = useSiteFeatures();
  const { flags } = usePublicSiteConfig();
  return makeGate({ features, flags });
}
