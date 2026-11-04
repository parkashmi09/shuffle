import { useSiteFeatures } from "./useSiteFeatures";
import { usePublicSiteConfig } from "./usePublicSiteConfig";
import { capOk, useSiteVersion } from "./siteLive";

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
  originals: { flag: "originals" },
  slotsgames: { flag: "slotsgames" },
  livegames: { flag: "livegames" },
  provablyfair: { flag: "provablyfair" },
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
  tips: { feature: "tips" },
};

/**
 * Gate → the signed-in player's capability behind it (`/auth/me` → `capabilities`, lib/siteLive.js).
 * An agent's player has these false and the backend refuses them (`*_NOT_FOR_AGENT_USERS`).
 */
const CAPABILITY = {
  vip: "promotions",
  promotions: "promotions",
  bonus: "promotions",
  affiliate: "promotions",
  races: "promotions",
  challenges: "promotions",
  vault: "vault",
  swap: "swap",
  deposit: "deposit",
  withdraw: "withdraw",
  tips: "tips",
};

const WALLET_TABS = ["deposit", "withdraw", "tips"];

export function makeGate({ features, flags }) {
  const listed = features?.list?.length ? new Set(features.list.map((f) => f.feature)) : null;
  const b2b = features?.policy?.("business_model") === "b2b";
  const on = (key) => {
    // The wallet exists while any of its tabs does — an agent's player has none, so no wallet at all.
    if (key === "wallet") return WALLET_TABS.some(on);
    if (CAPABILITY[key] && !capOk(CAPABILITY[key])) return false;
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
  useSiteVersion("caps"); // re-render when the player's capabilities change
  return makeGate({ features, flags });
}
