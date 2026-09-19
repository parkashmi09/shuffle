const STORAGE_PREFIX = "shuffle.affiliate.campaigns.";

function storageKey(referralCode) {
  return `${STORAGE_PREFIX}${String(referralCode || "").trim().toLowerCase()}`;
}

/** @returns {{ id: string, name: string, createdAt: number }[]} */
export function listAffiliateCampaigns(referralCode) {
  try {
    const raw = localStorage.getItem(storageKey(referralCode));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row.id === "string" && typeof row.name === "string");
  } catch {
    return [];
  }
}

export function generateCampaignId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 10; i += 1) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/** Persist a campaign the referrer created (display name + tracking id for `?c=`). */
export function saveAffiliateCampaign(referralCode, { id, name }) {
  const code = String(referralCode || "").trim();
  const campaignId = String(id || "").trim().slice(0, 80);
  const campaignName = String(name || "").trim().slice(0, 120);
  if (!code || !campaignId || !campaignName) return null;

  const existing = listAffiliateCampaigns(code);
  const next = existing.filter((row) => row.id !== campaignId);
  next.push({ id: campaignId, name: campaignName, createdAt: Date.now() });
  next.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  try {
    localStorage.setItem(storageKey(code), JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export function campaignDisplayName(campaignId, savedCampaigns, fallback) {
  const id = String(campaignId || "").trim();
  if (!id) return fallback;
  const hit = savedCampaigns.find((row) => row.id === id);
  return hit?.name || id;
}
