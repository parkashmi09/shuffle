import { useApi } from "./useResource";
import { site } from "./endpoints";
import { get } from "./api";
import { useSiteVersion } from "./siteLive";

const DEFAULT_COMMISSION = "10";

/** One re-read per pushed version, shared by every caller. */
let fresh = null;
const loadFresh = (v) => (fresh?.v === v ? fresh : (fresh = { v, p: get("/admin/site-config/public", { auth: false }) })).p;

/** Reads `GET /admin/site-config/public` — feature flags and advertised rates. */
export function usePublicSiteConfig() {
  // A live admin/owner change (`siteConfigUpdated`, lib/siteLive.js) re-reads past `site.config`'s page-long cache.
  const v = useSiteVersion("flags");
  const { data } = useApi(`site:public:${v}`, () => (v === 0 ? site.config() : loadFresh(v)));
  return {
    loading: !data,
    /** Every site-admin switch, raw — `lib/gates.js` reads these. `null` until answered. */
    flags: data ?? null,
    /** The owner's languages (codes); null until answered = show every language. */
    languages: Array.isArray(data?.languages) ? data.languages : null,
    defaultCurrency: typeof data?.defaultCurrency === "string" ? data.defaultCurrency.toUpperCase() : null,
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
