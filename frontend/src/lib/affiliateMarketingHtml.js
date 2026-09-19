import { formatCommissionPercent } from "./usePublicSiteConfig";

/** Inject the operator commission rate into captured affiliate marketing HTML. */
export function injectAffiliateCommission(html, commissionPercent) {
  const rate = formatCommissionPercent(commissionPercent);
  return String(html).replace(/PromotionTile_amount">10%/g, `PromotionTile_amount">${rate}`);
}
