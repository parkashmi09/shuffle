import { displayBalance, displayFiat } from "./adapters";
import { currencyLabel } from "./currencies";

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
 */
export function currencyOptions(balances, { displayCurrency, rates, fiatEquivalent = true } = {}) {
  return Object.entries(balances || {})
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
      right: fiatEquivalent && rates
        ? displayFiat(amount, code, displayCurrency, rates)
        : displayBalance(amount, code),
    }));
}
