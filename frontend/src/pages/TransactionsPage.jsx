import { useMemo, useState } from "react";
import { cx } from "../lib/carousel";
import { navigate, usePath } from "../lib/router";
import { useApi } from "../lib/useResource";
import { useSession } from "../lib/sessionContext";
import { displayBalance } from "../lib/adapters";
import { betHistory, history, sportsBets, wallet } from "../lib/endpoints";
import WalletSelect, { CoinIcon } from "../components/wallet/CurrencySelect";
import TableSkeleton from "../components/ui/TableSkeleton";

/**
 * `/transactions` — reference `pages/transactions/[tab]`.
 *
 * Rebuilt against the live page. The previous pass invented the whole thing:
 * a `TransactionsReference_*` class family that exists nowhere in the
 * reference, a hand-rolled tab strip and filter popover, and a POST to
 * `/api/v1/transactions/history`, a route no service serves. None of that
 * survives. What the live page actually is:
 *
 *   LayoutContainer_column
 *     Transactions_flexCell            title + the mobile-only filter icon
 *     Transactions_transactionViewTabsWrapper
 *       Tab_root                       the six tabs, the same `Tab_*` the
 *                                      affiliate and wallet pages use
 *       Transactions_selectRowWrapper  the desktop Filter button
 *     TransactionFilterOptions_filterWrapper   coin + page size, when open
 *     Table_root                       the table, one class per tab
 *
 * The tab is the URL, not component state: `/transactions` is Deposits and the
 * other five are `/transactions/<id>`, which is what the reference links.
 *
 * ── WHAT EACH TAB READS ──────────────────────────────────────────────────
 *
 * Five of the six have a real endpoint behind them. Tip / Rain does not —
 * there is no tipping module in any of the four services
 * (`docs/MISSING-AND-UNWIRED.md` §4) — so it renders the reference's own empty
 * state rather than a fabricated list. A tab whose service is down (sports-bets
 * when `sports-service` is not running) does the same.
 */

const TABS = [
  { id: "deposits", label: "Deposits" },
  { id: "withdrawals", label: "Withdrawals" },
  { id: "bets", label: "Casino Bets" },
  { id: "sports-bets", label: "Sports Bets" },
  { id: "tip-rain", label: "Tip / Rain" },
  { id: "other", label: "Other" },
];

/** Deposits is the bare `/transactions`; the rest carry their id. */
const pathFor = (id) => (id === "deposits" ? "/transactions" : `/transactions/${id}`);

const PAGE_SIZES = [
  { value: "10", label: "10 Positions" },
  { value: "25", label: "25 Positions" },
  { value: "50", label: "50 Positions" },
];

/**
 * The six tables.
 *
 * `skeleton` is the loading row's shape, read off the live page: `r` is a bar,
 * `cr` a circle and a bar — the cells that hold a coin mark or an avatar. Ten
 * rows, as the reference renders.
 */
const VIEWS = {
  deposits: {
    table: "DepositTransactions_table",
    header: "DepositTransactions_header",
    columns: ["Date", "Method", "Amount", "Transaction ID", "Status"],
    skeleton: ["r", "r", "cr", "cr", "r"],
  },
  withdrawals: {
    table: "WithdrawalTransactions_table",
    header: "WithdrawalTransactions_header",
    columns: ["Date", "Method", "Amount", "Transaction ID", "Status", { label: "", className: "WithdrawalTransactions_row" }],
    skeleton: ["r", "r", "cr", "cr", "r", "r"],
  },
  bets: {
    table: "BetTransactions_table",
    header: "BetTransactions_header",
    columns: ["Game", "Date", "Amount", "Multiplier", "Bet ID"],
    skeleton: ["r", "r", "cr", "cr", "r"],
  },
  "sports-bets": {
    table: "SportsBetsTransactions_table",
    header: "SportsBetsTransactions_header",
    columns: ["Status", "Event", "Date Placed", "Odds", "Stake", "Payout", "Bet ID"],
    skeleton: ["r", "cr", "r", "r", "cr", "cr", "r"],
  },
  "tip-rain": {
    table: "TipRainTransactions_table",
    header: "TipRainTransactions_header",
    columns: ["Type", "User", "Date", "Amount"],
    skeleton: ["r", "cr", "r", "cr"],
  },
  other: {
    table: "OtherTransactions_table",
    header: "OtherTransactions_header",
    columns: ["Type", "Date", "Amount", { label: "Status", className: "OtherTransactions_row" }],
    skeleton: ["r", "r", "cr", "r"],
  },
};

const label = (column) => (typeof column === "string" ? column : column.label);
const columnClass = (column) => (typeof column === "string" ? undefined : column.className);

/** `Sep 12, 2026, 11:04` — the reference's own shortening. */
function shortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** A coin mark and its amount, the pairing every money cell on this page uses. */
function Money({ amount, coin }) {
  return (
    <span className="IconValue_root FormattedAmount_root">
      <CoinIcon code={coin} />
      {displayBalance(amount ?? "0", coin)}
    </span>
  );
}

function shorten(value) {
  const text = String(value ?? "");
  return text.length > 18 ? `${text.slice(0, 8)}…${text.slice(-6)}` : text || "—";
}

/**
 * One tab's rows.
 *
 * Each entry returns the endpoint to read and how to turn a row into cells, so
 * the table below stays one component rather than six near-copies.
 */
const SOURCES = {
  /*
   * Both money tabs come from `transaction-history`, which merges every rail
   * server-side and hands back one row shape. Reading `/user/deposits/fiat`
   * here (as an earlier pass did) showed fiat only, so a crypto deposit was
   * absent from the player's own history — and the Method column printed the
   * currency, because fiat-only rows have no rail to name.
   */
  deposits: {
    fetch: ({ limit, coin }) => history.deposits({ limit, ...(coin ? { currency: coin } : {}) }),
    key: (row) => `${row.method}-${row.id}`,
    cells: (row) => [
      shortDate(row.date),
      row.type || row.method || "—",
      <Money amount={row.amount} coin={row.currency} />,
      shorten(row.reference || row.id),
      row.status || "—",
    ],
  },
  withdrawals: {
    fetch: ({ limit, coin }) => history.withdrawals({ limit, ...(coin ? { currency: coin } : {}) }),
    key: (row) => `${row.method}-${row.id}`,
    cells: (row) => [
      shortDate(row.date),
      row.type || row.method || "—",
      <Money amount={row.amount} coin={row.currency} />,
      shorten(row.reference || row.id),
      row.status || "—",
      "",
    ],
  },
  bets: {
    fetch: ({ limit, coin }) => betHistory.mine({ limit, ...(coin ? { currency: coin } : {}) }).then((r) => r?.data ?? []),
    key: (row) => row.betId || row.id,
    cells: (row) => [
      row.gameName || row.game || "—",
      shortDate(row.createdAt),
      <Money amount={row.betAmount ?? row.amount} coin={row.currency} />,
      `${Number(row.multiplier ?? 0).toFixed(2)}×`,
      shorten(row.betId || row.id),
    ],
  },
  "sports-bets": {
    fetch: ({ limit }) => sportsBets.mine({ limit }).then((r) => r?.data ?? []),
    key: (row) => row.betId || row.id,
    cells: (row) => [
      row.status || "—",
      <span className="SportsBetsTransactions_fixtureName">{row.eventName || row.matchName || "—"}</span>,
      shortDate(row.createdAt || row.placedAt),
      row.odds ?? "—",
      <Money amount={row.stake} coin={row.currency} />,
      <Money amount={row.payout} coin={row.currency} />,
      shorten(row.betId || row.id),
    ],
  },
  "tip-rain": null,
  other: {
    fetch: ({ limit, coin }) => wallet.ledger({ limit, ...(coin ? { currency: coin } : {}) }).then((r) => r?.data ?? []),
    key: (row) => row.id,
    cells: (row) => [
      row.reason || row.type || "—",
      shortDate(row.createdAt),
      <Money amount={row.amount} coin={row.currency} />,
      <span className={row.direction === "credit" ? "OtherTransactions_success" : undefined}>
        {row.direction === "credit" ? "Credit" : "Debit"}
      </span>,
    ],
  },
};

export default function TransactionsPage() {
  const path = usePath();
  const { signedIn, balances } = useSession();
  const active = TABS.find((t) => pathFor(t.id) === path)?.id || "deposits";
  const view = VIEWS[active];
  const source = SOURCES[active];

  const [filterOpen, setFilterOpen] = useState(false);
  const [coin, setCoin] = useState("ALL");
  const [pageSize, setPageSize] = useState("10");

  // `ALL Coins` first, then the wallet's own currencies — the same list the
  // live filter offers, built from what this wallet actually holds.
  const coinOptions = useMemo(
    () => [
      { value: "ALL", label: "All Coins", iconSrc: "/icons/coin-outline.svg" },
      ...Object.keys(balances || {}).map((code) => ({ value: code, label: code, icon: code })),
    ],
    [balances]
  );

  const { data, loading } = useApi(
    `transactions:${active}:${coin}:${pageSize}:${signedIn}`,
    async () => {
      if (!signedIn || !source) return [];
      const limit = Number(pageSize);
      // A service that is down must leave the table empty, not break the page.
      return source.fetch({ limit, coin: coin === "ALL" ? null : coin }).catch(() => []);
    }
  );

  const rows = data || [];

  return (
    <section className="LayoutContainer_root LayoutContainer_mobile-top-lg1 LayoutContainer_mobile-bottom-lg1 LayoutContainer_tablet-top-lg2 LayoutContainer_tablet-bottom-lg2 LayoutContainer_column">
      <div className="Transactions_flexCell">
        <h2 className="Heading_root Heading_h2 TitlePage_root">Transactions</h2>
        {/* Below the desktop breakpoint the Filter button collapses to this
            icon; `Transactions_active` is the reference's own on-state. */}
        <div className="Flex_root Flex_sm4 Transactions_mobileIcons" style={{ justifyContent: "flex-end", alignItems: "center" }}>
          <button
            type="button"
            aria-label="Filter"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((open) => !open)}
            className={cx(
              "ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_icon ButtonVariants_hasIcon Transactions_buttonIcon",
              filterOpen && "Transactions_active"
            )}
          >
            <span className="ButtonVariants_buttonContent">
              <span className="ButtonIcon_root">
                <img alt="filter" src="/icons/filters.svg" />
              </span>
            </span>
          </button>
        </div>
      </div>

      <div className="Flex_root Flex_md2 Transactions_transactionViewTabsWrapper">
        <div className="Tab_root">
          <div className="Tab_tabsContainer" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={tab.id === active}
                className={cx("Tab_tab", tab.id === active && "Tab_active")}
                disabled={tab.id === active}
                value={tab.id}
                onClick={() => navigate(pathFor(tab.id))}
              >
                <p className="Tab_text">{tab.label}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="Transactions_selectRowWrapper">
          <button
            type="button"
            aria-expanded={filterOpen}
            className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_tertiary"
            onClick={() => setFilterOpen((open) => !open)}
          >
            <span className="ButtonVariants_buttonContent">
              Filter
              <img
                alt="collapse-chevron"
                src="/icons/chevron.svg"
                className={cx("Transactions_chevron", filterOpen ? "Transactions_chevronOpen" : "Transactions_chevronClosed")}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Closed, the reference renders no wrapper at all — not a hidden one.
          That matters: the wrapper carries a 16px bottom margin, so leaving it
          mounted pushes the table down by that much with nothing on screen to
          explain it. */}
      {filterOpen && (
      <div className="TransactionFilterOptions_filterWrapper">
        <div className="TransactionFilterOptions_filterContent TransactionFilterOptions_filterContentOpen">
          <div className="Flex_root" style={{ alignItems: "center" }}>
            <h3>Filter by:</h3>
          </div>
          <div className="TransactionFilterOptions_filterTabsWrapper">
            <div className="TransactionFilterOptions_filterOptions">
              <WalletSelect
                options={coinOptions}
                value={coin}
                onChange={setCoin}
                variant={coin === "ALL" ? "plain" : "currency"}
              />
            </div>
            <div className="TransactionFilterOptions_filterOptions">
              <WalletSelect variant="plain" options={PAGE_SIZES} value={pageSize} onChange={setPageSize} />
            </div>
          </div>
        </div>
      </div>
      )}

      <div className="Table_root">
        <table className={cx("Table_table", view.table)}>
          <thead className={view.header}>
            <tr>
              {view.columns.map((column, i) => (
                <td key={label(column) || i} className={columnClass(column)}>
                  {label(column)}
                </td>
              ))}
            </tr>
          </thead>
          {loading && <TableSkeleton cells={view.skeleton} />}
          {!loading && rows.length > 0 && (
            <tbody>
              {rows.map((row) => (
                <tr key={source.key(row)}>
                  {source.cells(row).map((cell, i) => (
                    <td key={label(view.columns[i]) || i} className={columnClass(view.columns[i])}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
        {!loading && rows.length === 0 && (
          <div className="Table_noResult">
            <p>No transactions to show.</p>
          </div>
        )}
      </div>
    </section>
  );
}
