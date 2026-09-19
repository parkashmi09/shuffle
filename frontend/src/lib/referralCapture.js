const STORAGE_KEY = "shuffle.referral";
const CAMPAIGN_STORAGE_KEY = "shuffle.referral.campaign";

/** Accept a bare code, a username, or a full share URL with `?r=`. */
export function normalizeReferralInput(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const fromQuery = new URL(trimmed).searchParams.get("r")?.trim();
      if (fromQuery) return fromQuery;
    }
  } catch {
    /* ignore */
  }
  return trimmed;
}

/** Read `?r=` from the URL and remember it for later navigation. */
export function captureReferralFromSearch(search = window.location.search) {
  try {
    const params = new URLSearchParams(search);
    const code = params.get("r")?.trim();
    if (code) {
      sessionStorage.setItem(STORAGE_KEY, code);
    }
    const campaign = params.get("c")?.trim();
    if (campaign) {
      sessionStorage.setItem(CAMPAIGN_STORAGE_KEY, campaign.slice(0, 80));
    }
    return code || null;
  } catch {
    /* ignore */
  }
  return null;
}

/** Referral code from the current URL or from a prior capture on this tab. */
export function readStoredReferral() {
  try {
    const fromUrl = captureReferralFromSearch();
    if (fromUrl) return normalizeReferralInput(fromUrl);
    return normalizeReferralInput(sessionStorage.getItem(STORAGE_KEY) || "");
  } catch {
    return "";
  }
}

export function readStoredCampaign() {
  try {
    captureReferralFromSearch();
    return String(sessionStorage.getItem(CAMPAIGN_STORAGE_KEY) || "").trim().slice(0, 80);
  } catch {
    return "";
  }
}

export function clearStoredReferral() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(CAMPAIGN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Build a share link with optional campaign tag for tracking. */
export function buildReferralLink(origin, referralCode, campaign = "") {
  const base = `${String(origin || "").replace(/\/+$/, "")}?r=${encodeURIComponent(referralCode)}`;
  const tag = String(campaign || "").trim();
  if (!tag) return base;
  return `${base}&c=${encodeURIComponent(tag.slice(0, 80))}`;
}
