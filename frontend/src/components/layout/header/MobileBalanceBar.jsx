import { useEffect, useState } from "react";
import { cx } from "../../../lib/carousel";
import { displayFiat } from "../../../lib/adapters";
import BalancePopup, { CoinIcon } from "./BalancePopup";

/**
 * The balance strip under the header on phones — reference
 * `HeaderBalanceSelector.module.scss`.
 *
 * It exists because the pill on the bar has nowhere to go once the logo and the
 * account button have taken the width, so below `sm` the balance moves to its
 * own sticky row. The stylesheet hides this at `sm-and-up`, which is why there
 * is no breakpoint logic here: the markup is always rendered and CSS decides.
 * It sticks to `--height-header`, directly beneath the bar.
 */
export default function MobileBalanceBar({ balances, currency, onCurrencyChange, displayCurrency, rates, loading = false }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const amount = balances?.[currency] ?? "0";

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
          <p className="HeaderBalanceSelector_content">&nbsp;{displayFiat(amount, currency, displayCurrency, rates)}</p>
        )}
        <img
          alt=""
          className={cx("HeaderBalanceSelector_arrow", open && "HeaderBalanceSelector_arrowDown")}
          src="/icons/chevron.svg"
        />
      </button>

      {/* No filter box: the strip is the full width of a phone and the list is
          already the whole wallet. The header pill is where searching belongs. */}
      {open && (
        <BalancePopup
          className="HeaderBalanceSelector_popup"
          balances={balances}
          currency={currency}
          onSelect={(next) => {
            onCurrencyChange(next);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
