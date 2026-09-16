/**
 * Display names for the codes the wallet returns.
 *
 * The reference writes a currency as `Ethereum (ETH)` — the asset's name with
 * its ticker in brackets — everywhere it has room, and the bare ticker only
 * where it does not. `GET /user/wallet/balances` answers ticker keys alone, so
 * the names live here.
 *
 * Anything not listed falls back to its own code, which is what the platform's
 * own tokens (`BJB`, `NC`, `SC`) get: inventing a name for somebody else's
 * ledger column would be worse than showing the column.
 */
const NAMES = {
  // Crypto
  BTC: "Bitcoin",
  ETH: "Ethereum",
  LTC: "Litecoin",
  BCH: "Bitcoin Cash",
  DOGE: "Dogecoin",
  TRX: "Tron",
  XRP: "Ripple",
  ADA: "Cardano",
  BNB: "BNB",
  SOL: "Solana",
  MATIC: "Polygon",
  SHIB: "Shiba Inu",
  MKR: "Maker",
  NEXO: "Nexo",
  SHFL: "Shuffle",
  TON: "Toncoin",
  AVAX: "Avalanche",
  DAI: "Dai",

  // Stablecoins
  USDT: "Tether",
  USDC: "USD Coin",
  BUSD: "Binance USD",
  TUSD: "TrueUSD",
  USDP: "Pax Dollar",

  // Fiat
  INR: "Indian Rupee",
  USD: "US Dollar",
  EUR: "Euro",
  AED: "UAE Dirham",
  PKR: "Pakistani Rupee",
  BDT: "Bangladeshi Taka",
  NPR: "Nepalese Rupee",
  MVR: "Maldivian Rufiyaa",
};

/** `ETH` → `Ethereum (ETH)`; an unknown code → `BJB`. */
export function currencyLabel(code) {
  const key = String(code || "").toUpperCase();
  return NAMES[key] ? `${NAMES[key]} (${key})` : key;
}

/** Just the name, for the places the reference uses it without the ticker. */
export function currencyName(code) {
  const key = String(code || "").toUpperCase();
  return NAMES[key] || key;
}

/**
 * Codes whose coin mark lives under `public/icons/fiat/`.
 *
 * Deliberately separate from `isFiat` in `adapters.js`. That one answers "is
 * this funded by bank transfer", which drives the deposit and withdraw
 * branches and lists only the currencies this platform's wallet holds. This one
 * answers "which folder is the icon in", and has to cover the on-ramp's much
 * wider list — BRL, JPY, KRW and the rest, which no wallet here holds but the
 * Buy Crypto tab still offers. Using the funding list for icons sent every one
 * of them to `/icons/crypto/` and they all fell back to the star.

 * The last five have no file shipped yet — they are listed anyway because
 * `/icons/fiat/` is where their mark belongs when one is added; until then they
 * fall back to the star exactly as they would from the wrong folder.
 */
export const FIAT_CODES = [
  "BRL", "CAD", "CNY", "DKK", "EUR", "IDR", "INR", "JPY",
  "KRW", "MXN", "NZD", "PHP", "PLN", "TRY", "USD", "VND",
  "AED", "PKR", "BDT", "NPR", "MVR",
];

const FIAT_ICONS = new Set(FIAT_CODES);

/**
 * The codes a 16px mark actually ships for — `public/icons/fiat/` and
 * `public/icons/crypto/`.
 *
 * ── WHY THIS LIST EXISTS ─────────────────────────────────────────────────
 *
 * `currencyIcon` used to derive a path from the code alone: fiat went to
 * `/icons/fiat/<CODE>.svg`, everything else to `/icons/crypto/<code>.svg`.
 * That is a guess, and for 15 of the 29 currency columns in `credits` it was
 * wrong — the file was not there, so the header and the wallet list asked for
 * a 404 and drew a broken image. `FIAT_CODES` itself named five (AED, PKR,
 * BDT, NPR, MVR) that have never had a file.
 *
 * Those five, and coins like BCH, ADA, SHIB, MKR, NEXO, TUSD and USDP, are
 * currencies this platform carries and the reference does not — its own
 * `/icons/` answers 404 for every one of them — so there is nothing to copy
 * and no mark to ship. The platform's internal tokens (NC, BJB) have no public
 * mark at all by nature.
 *
 * So the list is the ground truth, and anything outside it gets the generic
 * coin rather than a request that cannot succeed. Adding an icon means
 * dropping the file in and adding the code here.
 */
const FIAT_WITH_ICON = new Set([
  "BRL", "CAD", "CNY", "DKK", "EUR", "IDR", "INR", "JPY",
  "KRW", "MXN", "NZD", "PHP", "PLN", "TRY", "USD", "VND",
]);

const CRYPTO_WITH_ICON = new Set([
  "avax", "bnb", "btc", "busd", "dai", "doge", "eth", "gram", "ltc",
  "matic", "pol", "sc", "shfl", "sol", "trx", "usdc", "usdt", "xrp",
]);

/** The mark for a currency we hold no icon for. */
export const COIN_FALLBACK_ICON = "/icons/coin-outline.svg";

/**
 * Where a currency's 16px mark lives, or the generic coin when we have none.
 *
 * Never returns a path that is not on disk, which is what stops the header
 * rendering an empty box for a balance the player actually holds.
 */
export function currencyIcon(code) {
  const key = String(code || "").toUpperCase();
  if (FIAT_ICONS.has(key) && FIAT_WITH_ICON.has(key)) return `/icons/fiat/${key}.svg`;
  const lower = key.toLowerCase();
  if (CRYPTO_WITH_ICON.has(lower)) return `/icons/crypto/${lower}.svg`;
  return COIN_FALLBACK_ICON;
}
