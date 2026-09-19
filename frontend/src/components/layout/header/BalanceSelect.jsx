import { useEffect, useRef, useState } from "react";
import { cx } from "../../../lib/carousel";
import { displayBalance, displayFiat } from "../../../lib/adapters";
import { MASKED_AMOUNT } from "../../../lib/playerPreferences";
import BalancePopup, { CoinIcon } from "./BalancePopup";

/**
 * The balance pill and its currency popup — reference
 * `Header/Balance/BalanceSelect`.
 *
 * The figure is the wallet's worth in the player's display currency when Fiat
 * View is on; otherwise the coin's own amount. Streamer Mode masks it. See
 * Settings → Preferences.
 *
 * Two spans for the amount, **not a `<p>`** — `.balanceBtn p` would add 16px.
 * The Wallet button is a child of `BalanceSelect_root` so the gap and popup
 * anchor match the live header.
 */
export default function BalanceSelect({
  balances,
  currency,
  onCurrencyChange,
  displayCurrency,
  rates,
  fiatView = true,
  hideZeroBalances = false,
  hideBalance = false,
  loading = false,
  children,
}) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!root.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const amount = balances?.[currency] ?? "0";
  const figure = hideBalance
    ? MASKED_AMOUNT
    : fiatView
      ? displayFiat(amount, currency, displayCurrency, rates)
      : displayBalance(amount, currency);

  return (
    <div className="BalanceSelect_root" ref={root}>
      <div className="BalanceSelect_selectContainer">
        <button
          type="button"
          id="balance-button"
          className="BalanceSelect_balanceBtn"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Select currency"
          onClick={() => setOpen((o) => !o)}
        >
          <CoinIcon code={currency} />
          {loading ? (
            <span className="SkeletonPlaceholder_root BalanceSelect_skeleton" />
          ) : (
            <span className="IconValue_root">
              <span
                className="FormattedAmount_root BalanceSelect_amount formatted-amount-value"
                data-testid="balance"
              >
                {figure}
              </span>
            </span>
          )}
          <img
            alt="arrow"
            className={cx("BalanceSelect_arrow", open && "BalanceSelect_arrowDown")}
            src="/icons/chevron.svg"
          />
        </button>

        <div>
          {open && (
            <BalancePopup
              balances={balances}
              currency={currency}
              hideZeroBalances={hideZeroBalances}
              hideBalance={hideBalance}
              search
              onSelect={(next) => {
                onCurrencyChange(next);
                setOpen(false);
              }}
            />
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
