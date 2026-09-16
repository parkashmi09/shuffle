import { useEffect, useRef, useState } from "react";
import { cx } from "../../../lib/carousel";
import { displayFiat } from "../../../lib/adapters";
import BalancePopup, { CoinIcon } from "./BalancePopup";

/**
 * The balance pill and its currency popup — reference
 * `Header/Balance/BalanceSelect`.
 *
 * The markup below is the live header's, read off shuffle.com rather than
 * inferred. One detail matters more than it looks:
 *
 *     <span class="IconValue_root">
 *       <span class="FormattedAmount_root BalanceSelect_amount …">₹0.00</span>
 *     </span>
 *
 * Two spans, **not a `<p>`**. The reference's own stylesheet carries
 * `.balanceBtn p { margin-right: var(--spacing-md2) }`, so rendering the amount
 * as a paragraph silently adds 16px inside the pill — which is exactly what
 * made this 126px wide against the live header's 118px, and pushed the whole
 * centre group out of alignment. The rule is real; it simply never fires on the
 * live site because nothing inside that button is a `<p>`.
 *
 * The figure itself is the wallet's worth in the player's display currency,
 * not the coin's own amount: the live bar reads `₹0.00` beside an ETH mark.
 * See `displayFiat` in `lib/adapters.js`.
 *
 * ── THE WALLET BUTTON BELONGS IN HERE ────────────────────────────────────
 *
 * `children` is the Wallet button, and it is rendered as a sibling of
 * `selectContainer` **inside** `BalanceSelect_root` — which is where the live
 * DOM puts it. Measured there, `BalanceSelect_root` is 217.8px wide against a
 * 117.5px pill and a 92px button: 117.5 + 8 + 92. Two things follow, and both
 * were wrong while the button sat outside as a sibling in `btnContainer`:
 *
 *   · **The gap is 8px, not 10.** It comes from this element's own
 *     `gap: var(--spacing-sm4)`, not from `btnContainer`'s
 *     `column-gap: var(--spacing-sm5)`, which never gets to apply because
 *     `btnContainer` ends up with a single child.
 *
 *   · **The popup centres over the pill *and* the button.** It is absolutely
 *     positioned at `left: 50%` against the nearest positioned ancestor, and
 *     that is `BalanceSelect_root`. At 217.8px wide the midpoint is 108.9px —
 *     which is exactly what the live site computes. With the button outside,
 *     the root is only as wide as the pill and the panel hangs to the left.
 *
 * @param {object}   balances
 * @param {string}   currency         The wallet the pill spends from — names the icon.
 * @param {Function} onCurrencyChange
 * @param {string}   displayCurrency  The fiat the figure is written in.
 * @param {object[]} rates            USD-per-unit price table; null falls back to the coin amount.
 * @param {boolean}  loading          The wallet read has not answered yet.
 * @param {React.ReactNode} children  The Wallet button.
 */
export default function BalanceSelect({
  balances,
  currency,
  onCurrencyChange,
  displayCurrency,
  rates,
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
                {displayFiat(amount, currency, displayCurrency, rates)}
              </span>
            </span>
          )}
          <img
            alt="arrow"
            className={cx("BalanceSelect_arrow", open && "BalanceSelect_arrowDown")}
            src="/icons/chevron.svg"
          />
        </button>

        {/* The live DOM wraps the panel in a bare div beside the button; it is
            unstyled, and the positioning comes from `BalanceSelect_root` above. */}
        <div>
          {open && (
            <BalancePopup
              balances={balances}
              currency={currency}
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
