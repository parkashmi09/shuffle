/**
 * Which chains each asset can move on.
 *
 * The wallet's network picker needs options before a provider is configured, so
 * this is the fallback `GET /user/crypto/chains` would otherwise supply. These
 * are public facts about the assets — Tether exists on Ethereum, Tron, BNB
 * Smart Chain and Solana whatever this deployment has switched on — not
 * account data, so listing them invents nothing.
 *
 * ── BUT THEY ARE NOT A PROMISE ───────────────────────────────────────────
 *
 * Which of these an operator actually *accepts* is provider configuration. The
 * wallet therefore uses the live list whenever CCPayment answers and treats
 * this only as the shape of the control, with the field marked unconfigured.
 * See `docs/MISSING-AND-UNWIRED.md`.
 *
 * The ETH list is the reference's own, read off the live modal: Ethereum
 * (ERC20), BNB Smart Chain (BEP20), Base (BASE), Robinhood Chain (RHC).
 */

const ETH_CHAINS = [
  { value: "ERC20", label: "Ethereum (ERC20)" },
  { value: "BEP20", label: "BNB Smart Chain (BEP20)" },
  { value: "BASE", label: "Base (BASE)" },
  { value: "RHC", label: "Robinhood Chain (RHC)" },
];

const STABLE_CHAINS = [
  { value: "ERC20", label: "Ethereum (ERC20)" },
  { value: "TRC20", label: "Tron (TRC20)" },
  { value: "BEP20", label: "BNB Smart Chain (BEP20)" },
  { value: "SOL", label: "Solana (SOL)" },
  { value: "MATIC", label: "Polygon (MATIC)" },
];

const NETWORKS = {
  BTC: [{ value: "BTC", label: "Bitcoin (BTC)" }],
  ETH: ETH_CHAINS,
  LTC: [{ value: "LTC", label: "Litecoin (LTC)" }],
  BCH: [{ value: "BCH", label: "Bitcoin Cash (BCH)" }],
  DOGE: [{ value: "DOGE", label: "Dogecoin (DOGE)" }],
  XRP: [{ value: "XRP", label: "Ripple (XRP)" }],
  ADA: [{ value: "ADA", label: "Cardano (ADA)" }],
  SOL: [{ value: "SOL", label: "Solana (SOL)" }],
  TRX: [{ value: "TRC20", label: "Tron (TRC20)" }],
  BNB: [{ value: "BEP20", label: "BNB Smart Chain (BEP20)" }],
  MATIC: [
    { value: "MATIC", label: "Polygon (MATIC)" },
    { value: "ERC20", label: "Ethereum (ERC20)" },
  ],
  AVAX: [{ value: "AVAXC", label: "Avalanche C-Chain" }],
  TON: [{ value: "TON", label: "TON" }],

  USDT: STABLE_CHAINS,
  USDC: STABLE_CHAINS,
  BUSD: [
    { value: "BEP20", label: "BNB Smart Chain (BEP20)" },
    { value: "ERC20", label: "Ethereum (ERC20)" },
  ],
  TUSD: [{ value: "ERC20", label: "Ethereum (ERC20)" }],
  USDP: [{ value: "ERC20", label: "Ethereum (ERC20)" }],
  DAI: [{ value: "ERC20", label: "Ethereum (ERC20)" }],

  SHIB: [{ value: "ERC20", label: "Ethereum (ERC20)" }],
  MKR: [{ value: "ERC20", label: "Ethereum (ERC20)" }],
  NEXO: [{ value: "ERC20", label: "Ethereum (ERC20)" }],
  SHFL: [{ value: "ERC20", label: "Ethereum (ERC20)" }],
};

/** Chains for an asset; ERC20 for anything unlisted, which is where a new token starts. */
export function networksFor(code) {
  return NETWORKS[String(code || "").toUpperCase()] || [{ value: "ERC20", label: "Ethereum (ERC20)" }];
}

/** The human label for a chain value, for the address field's caption. */
export function networkLabel(code, network) {
  return networksFor(code).find((n) => n.value === network)?.label || network || "";
}
