import { useEffect, useMemo, useState } from "react";
import { cx } from "../../../lib/carousel";
import { displayBalance } from "../../../lib/adapters";
import { MASKED_AMOUNT } from "../../../lib/playerPreferences";
import { CoinIcon } from "../../ui/CoinIcon";

/**
 * The currency list — reference `Header/Balance/BalancePopup` + `BalanceItem`.
 *
 * Rendered only while open, which is what makes the enter transition work: the
 * panel's CSS starts at `opacity: 0` and a scaled transform, and
 * `BalancePopup_animate` lands it. If the component stayed mounted across
 * closes, `entered` would already be true on the next open and the panel would
 * appear rather than fade. Unmounting is the reset.
 *
 * Shared by the header pill and the mobile strip, which show the same list in
 * two different places.
 */

/** Re-exported so the header keeps importing `CoinIcon` from here. */
export { CoinIcon };

/**
 * Held currencies first, then the rest alphabetically.
 *
 * `/user/wallet/balances` answers ~30 codes and almost all are zero. A player
 * with two funded coins should not scroll past `ADA 0.00000000` to reach their
 * money. `hideZeroBalances` drops the zeros (the active wallet always stays).
 */
function useSortedBalances(balances, query = "", { hideZeroBalances = false, keep } = {}) {
  return useMemo(() => {
    const needle = query.trim().toUpperCase();
    return Object.entries(balances || {})
      .filter(([code, amount]) => {
        if (needle && !code.includes(needle)) return false;
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
      });
  }, [balances, query, hideZeroBalances, keep]);
}

/** One currency row. */
function BalanceItem({ code, amount, active, onSelect, hideBalance = false }) {
  return (
    <button
      type="button"
      className={cx("BalanceItem_root", active && "BalanceItem_active")}
      onClick={() => onSelect(code)}
    >
      <div className="BalanceItem_cryptoIconWrapper">
        <CoinIcon code={code} />
        <p className="BalanceItem_currencyText">{code}</p>
      </div>
      <p className="BalanceItem_amount">{hideBalance ? MASKED_AMOUNT : displayBalance(amount, code)}</p>
    </button>
  );
}

/** The filter box. With ~30 codes the list is always worth filtering. */
function BalanceTypeSearch({ value, onChange }) {
  return (
    <div className="BalanceTypeSearch_root">
      <div className="BalanceTypeSearch_wrapper">
        <img alt="" className="BalanceTypeSearch_searchIcon" src="/icons/search.svg" />
        <input
          className="Input_root"
          placeholder="Search"
          aria-label="Search currencies"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          aria-label="Clear search"
          className={cx("BalanceTypeSearch_cleanButton", !value && "BalanceTypeSearch_hideButton")}
          onClick={() => onChange("")}
        >
          <img alt="" src="/icons/times.svg" />
        </button>
      </div>
    </div>
  );
}

/**
 * @param {object}   balances
 * @param {string}   currency   The active code, shown selected.
 * @param {Function} onSelect
 * @param {boolean}  [search]
 * @param {boolean}  [hideZeroBalances]
 * @param {boolean}  [hideBalance] Streamer Mode.
 * @param {string}   [className]
 */
export default function BalancePopup({
  balances,
  currency,
  onSelect,
  search = false,
  hideZeroBalances = false,
  hideBalance = false,
  className,
}) {
  const [entered, setEntered] = useState(false);
  const [query, setQuery] = useState("");
  const rows = useSortedBalances(balances, search ? query : "", {
    hideZeroBalances,
    keep: currency,
  });

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 20);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={cx("BalancePopup_root", className, entered && "BalancePopup_animate")} role="listbox">
      {search && <BalanceTypeSearch value={query} onChange={setQuery} />}
      <div className="BalancePopup_container">
        {rows.map(([code, value]) => (
          <BalanceItem
            key={code}
            code={code}
            amount={value}
            active={code === currency}
            onSelect={onSelect}
            hideBalance={hideBalance}
          />
        ))}
        {!rows.length && (
          <div className="BalanceTypeSearch_root">
            <p className="BalanceItem_amount">No currency matches “{query}”.</p>
          </div>
        )}
      </div>
    </div>
  );
}
