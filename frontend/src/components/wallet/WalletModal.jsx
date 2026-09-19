import { useEffect, useState } from "react";
import { cx } from "../../lib/carousel";
import { navigate } from "../../lib/router";
import { useSession } from "../../lib/sessionContext";
import DepositTab from "./DepositTab";
import WithdrawTab from "./WithdrawTab";
import { BuyCryptoTab, TipTab } from "./UnbuiltTabs";
import Modal from "../ui/Modal";

/**
 * The wallet modal — reference `WalletModal`.
 *
 * ── WHERE THIS CAME FROM ─────────────────────────────────────────────────
 *
 * Nothing about this modal is in `assets/`. It is a lazily-loaded chunk that a
 * signed-out visitor never fetches, so the capture holds neither its SCSS nor
 * its markup. The structure below was read element by element off the live
 * signed-in modal at `shuffle.com/?modal=wallet`, and its stylesheet off
 * `document.styleSheets` — see `src/styles/shuffle-wallet.css`.
 *
 * Measured there: a 540px body on `--color-gray900` with an 8px radius and no
 * padding of its own, `ModalContent_modalContent` supplying a 40px inset, and
 * four tabs in the same `TabViewOutline` the auth modal uses.
 *
 * ── THE TAB IS IN THE URL ────────────────────────────────────────────────
 *
 * The reference drives it from the query string — `?modal=wallet&md-tab=withdraw`
 * — so a deposit link can be shared and the back button steps through tabs.
 * That is reproduced: the modal reads `md-tab` and writes it as it changes.
 */

const TABS = [
  { id: "deposit", label: "Deposit" },
  { id: "withdraw", label: "Withdraw" },
  { id: "buy-crypto", label: "Buy Crypto" },
  { id: "tip", label: "Tip" },
];

/** The tab named in the query string, defaulting to Deposit. */
function tabFromUrl() {
  const id = new URLSearchParams(window.location.search).get("md-tab");
  return TABS.some((t) => t.id === id) ? id : "deposit";
}

export default function WalletModal({ onClose }) {
  const {
    balances,
    currency: headerCurrency,
    displayCurrency,
    rates,
    fiatView,
    hideZeroBalances,
    hideBalance,
  } = useSession();
  const [tab, setTab] = useState(tabFromUrl);
  /**
   * The wallet the modal is working on.
   *
   * Seeded from the header's selection so opening the modal continues what the
   * player was already looking at, then independent of it — changing the coin
   * to deposit into should not silently change what the bar reads.
   */
  const [coin, setCoin] = useState(headerCurrency);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /**
   * Keep `md-tab` in the URL without adding a history entry per tab.
   *
   * `replaceState`, not `pushState`: the reference lets Escape close the modal
   * and the back button leave the page, not walk back through four tabs.
   */
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("modal", "wallet");
    url.searchParams.set("md-tab", tab);
    window.history.replaceState(null, "", url);
  }, [tab]);

  const openHistory = (path) => {
    onClose();
    navigate(path);
  };

  const shared = {
    coin,
    onCoinChange: setCoin,
    balances,
    displayCurrency,
    rates,
    fiatView,
    hideZeroBalances,
    hideBalance,
    onDepositHistory: () => openHistory("/transactions"),
    onWithdrawalHistory: () => openHistory("/transactions/withdrawals"),
  };

  return (
    <Modal onClose={onClose} label="Wallet" bodyClass="GlobalModal_walletModalBody">
      <div className="WalletModal_tabsGap">
        <div className="TabViewOutline_root">
          <div className="TabViewOutline_tabOutlineWrapper" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                data-text={t.label}
                className={cx(
                  "TabViewOutline_tabOutline TabViewOutline_tabOutlineFullWidth TabViewOutline_tabOutlineSm",
                  tab === t.id && "TabViewOutline_tabOutlineActive"
                )}
                onClick={() => setTab(t.id)}
              >
                <span className="TabViewOutline_tabName">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === "deposit" && <DepositTab {...shared} />}
      {tab === "withdraw" && <WithdrawTab {...shared} />}
      {tab === "buy-crypto" && <BuyCryptoTab {...shared} />}
      {tab === "tip" && <TipTab {...shared} />}
    </Modal>
  );
}
