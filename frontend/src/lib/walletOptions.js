import { displayBalance, displayFiat, isFiat } from "./adapters";
import { funding } from "./endpoints";
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

/**
 * Narrow a currency list to the funding rails this site actually offers.
 *
 * The two rails ARE the two kinds of currency here: fiat is the manual one —
 * a bank transfer the operator settles by hand — and crypto is the automatic
 * one, settled by CCPayment. `DepositTab` and `WithdrawTab` both branch on
 * `isFiat(coin)` for exactly that reason, so switching a rail off is the same
 * thing as taking its currencies out of the picker.
 *
 * The common case is `both`, where this returns the list untouched rather
 * than rebuilding an identical array. `autoFiat` are the fiat codes the
 * automatic gateway (F2Pay) takes, which stay listed with the manual rail off.
 */
export function optionsForRoutes(options, routes, autoFiat = []) {
  if (!routes || (routes.manual && routes.automatic)) return options;
  return options.filter((option) => (isFiat(option.value) ? routes.manual || autoFiat.includes(option.value) : routes.automatic));
}

/** The automatic gateway's offer: `{ methods: [{ method, currency }], payout: ["INR"] }`. Closed or unconfigured reads as empty. */
export const fetchAutoRails = () =>
  funding.paymentMethods("f2pay").then(
    (data) => ({
      methods: Array.isArray(data?.methods) ? data.methods : [],
      payout: Array.isArray(data?.payout) ? data.payout : [],
    }),
    () => ({ methods: [], payout: [] })
  );

/** The rail a fiat cashier form shows: the player's pick when both are open, the open one otherwise, `null` for none. */
export const shownRail = ({ manual, auto, picked }) => (manual && auto ? picked : auto ? "auto" : manual ? "manual" : null);

/** Hash `capabilitiesOf`: a withdraw-locked player keeps the tab so the wallet can say why. An agent's player has no deposit, so never does. */
export const keepsWithdrawTab = (user) =>
  user?.withdraw_locked === true && user?.capabilities?.withdraw === false && user?.capabilities?.deposit !== false;

// shortcut: F2Pay's BANK_INR payout range as hash hard-codes it; read it from the backend if F2Pay changes it.
export const AUTO_PAYOUT = { min: 100, max: 30000 };

if (import.meta.env.DEV) {
  console.assert(shownRail({ manual: true, auto: true, picked: "auto" }) === "auto" && shownRail({ manual: true, auto: false, picked: "auto" }) === "manual", "cashier rail");
  console.assert(shownRail({ manual: false, auto: true, picked: "manual" }) === "auto" && shownRail({ manual: false, auto: false, picked: "manual" }) === null, "cashier rail closed");
  console.assert(keepsWithdrawTab({ withdraw_locked: true, capabilities: { withdraw: false } }), "locked player keeps the tab");
  console.assert(!keepsWithdrawTab({ withdraw_locked: true, capabilities: { withdraw: false, deposit: false } }), "agent player gets no tab");
  const opts = [{ value: "INR" }, { value: "BTC" }];
  console.assert(optionsForRoutes(opts, { manual: false, automatic: true }, ["INR"]).length === 2 && optionsForRoutes(opts, { manual: false, automatic: true }).length === 1, "auto fiat stays listed");
}
