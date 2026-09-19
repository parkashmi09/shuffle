import { useApi } from "./useResource";
import { site } from "./endpoints";

const DEFAULT_COMMISSION = "10";

/** Reads `GET /admin/site-config/public` — feature flags and advertised rates. */
export function usePublicSiteConfig() {
  const { data } = useApi("site:public", () => site.config());
  return {
    loading: !data,
    affiliateEnabled: data?.affiliate !== false,
    commissionPercent: data?.comissionpercent ?? DEFAULT_COMMISSION,
    registerBonus: data?.registerbonus,
    registerBonusCurrency: data?.registerBonusCurrency ?? "BJB",
    affiliateBonus: data?.affiliatebonus,
    affiliateBonusCurrency: data?.affiliateBonusCurrency ?? "BJB",
  };
}

export function formatCommissionPercent(raw) {
  const n = Number.parseFloat(String(raw ?? DEFAULT_COMMISSION));
  if (!Number.isFinite(n)) return `${DEFAULT_COMMISSION}%`;
  return `${n}%`;
}
