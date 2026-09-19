import { useEffect, useState } from "react";
import { cx } from "../../../lib/carousel";
import { displayBalance, displayFiat } from "../../../lib/adapters";
import { MASKED_AMOUNT } from "../../../lib/playerPreferences";
import BalancePopup, { CoinIcon } from "./BalancePopup";

/**
 * The balance strip under the header on phones — reference
 * `HeaderBalanceSelector.module.scss`.
 *
 * Currently unused in the site header (the pill stays on the bar to 320px);
 * kept for the in-game header where the reference does mount it. Honours the
 * same Preferences as BalanceSelect: Fiat View, Hide zero balances, Streamer Mode.
 */
export default function MobileBalanceBar({
  balances,
  currency,
  onCurrencyChange,
  displayCurrency,
  rates,
  fiatView = true,
  hideZeroBalances = false,
  hideBalance = false,
  loading = false,
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const amount = balances?.[currency] ?? "0";
  const figure = hideBalance
    ? MASKED_AMOUNT
    : fiatView
      ? displayFiat(amount, currency, displayCurrency, rates)
      : displayBalance(amount, currency);

  return (
    <div className={cx("HeaderBalanceSelector_root", open && "HeaderBalanceSelector_open")}>
      <button
        type="button"
        className="HeaderBalanceSelector_balanceBtn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select currency"
        onClick={() => setOpen((o) => !o)}
      >
        <CoinIcon code={currency} />
        {loading ? (
          <span className="SkeletonPlaceholder_root HeaderBalanceSelector_skeleton" />
        ) : (
          <p className="HeaderBalanceSelector_content">&nbsp;{figure}</p>
        )}
        <img
          alt=""
          className={cx("HeaderBalanceSelector_arrow", open && "HeaderBalanceSelector_arrowDown")}
          src="/icons/chevron.svg"
        />
      </button>

      {open && (
        <BalancePopup
          className="HeaderBalanceSelector_popup"
          balances={balances}
          currency={currency}
          hideZeroBalances={hideZeroBalances}
          hideBalance={hideBalance}
          onSelect={(next) => {
            onCurrencyChange(next);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
