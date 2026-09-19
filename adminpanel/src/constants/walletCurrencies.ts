/** Matches wallet.constants.js / site-config validators. */
export const WALLET_CURRENCIES = [
  'BTC', 'ETH', 'LTC', 'BCH', 'USDT', 'TRX', 'DOGE', 'ADA', 'XRP', 'BNB',
  'USDP', 'NEXO', 'MKR', 'TUSD', 'USDC', 'BUSD', 'NC', 'INR', 'SHIB', 'MATIC',
  'SC', 'MVR', 'BJB', 'AED', 'NPR', 'PKR', 'EUR', 'BDT',
] as const;

export type WalletCurrency = (typeof WALLET_CURRENCIES)[number];
