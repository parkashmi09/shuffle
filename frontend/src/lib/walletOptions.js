import { displayBalance, displayFiat } from "./adapters";
import { currencyLabel } from "./currencies";
import { MASKED_AMOUNT } from "./playerPreferences";

/**
 * Currency options built from the player's own wallet.
 *
 * The reference lists the coins it supports; this lists the ones the wallet
 * actually returns, which is the same idea against a different catalogue.
 * Funded currencies sort first — the same ordering the header's picker uses,
 * and for the same reason.
 *
 * @param {boolean} [fiatEquivalent] Show each balance converted to the display
 *   currency (what the live modal does) rather than the coin's own amount.
 * @param {boolean} [hideZeroBalances] Drop unfunded rows (active `keep` stays).
 * @param {boolean} [hideBalance] Streamer Mode — mask the right-hand figure.
 * @param {string}  [keep] Always include this code even when its balance is 0.
 */
export function currencyOptions(
  balances,
  {
    displayCurrency,
    rates,
    fiatEquivalent = true,
    hideZeroBalances = false,
    hideBalance = false,
    keep,
  } = {}
) {
  return Object.entries(balances || {})
    .filter(([code, amount]) => {
      if (!hideZeroBalances) return true;
      if (keep && code === keep) return true;
      return Number(amount) > 0;
    })
    .sort(([aCode, aVal], [bCode, bVal]) => {
      const aHeld = Number(aVal) > 0;
      const bHeld = Number(bVal) > 0;
      if (aHeld !== bHeld) return aHeld ? -1 : 1;
      if (aHeld && bHeld) return Number(bVal) - Number(aVal);
      return aCode.localeCompare(bCode);
    })
    .map(([code, amount]) => ({
      value: code,
      // `Ethereum (ETH)`, as the reference writes it — not the bare ticker.
      label: currencyLabel(code),
      icon: code,
      right: hideBalance
        ? MASKED_AMOUNT
        : fiatEquivalent && rates
          ? displayFiat(amount, code, displayCurrency, rates)
          : displayBalance(amount, code),
    }));
}
