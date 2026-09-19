/**
 * Client-side preference blob for the Preferences tab.
 *
 * Three switches also map to `/user/preferences` (`emailNotifications`,
 * `pushNotifications`, `hideBalance`) — see SettingsPreferences. Everything
 * else here has no column, so the browser is the store. Session reads
 * `fiatView` and `hideZeroBalances` from the same key so the header and wallet
 * pickers stay in sync with the tab.
 */

const KEY = "shuffle.preferences";

export const PREF_DEFAULTS = {
  odds: "decimal",
  privateMode: false,
  emailMarketing: true,
  promotionNotifications: true,
  streamerMode: false,
  hideZeroBalances: false,
  /** When false, balances show in the coin's own units instead of display fiat. */
  fiatView: true,
};

/** What Streamer Mode / hideBalance puts where a figure would be. */
export const MASKED_AMOUNT = "********";

export function readStoredPreferences() {
  try {
    return { ...PREF_DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...PREF_DEFAULTS };
  }
}

export function writeStoredPreferences(patch) {
  const next = { ...readStoredPreferences(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode — in-memory session still holds the choice for this visit */
  }
  return next;
}
