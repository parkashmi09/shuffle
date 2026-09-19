import { useMemo, useState } from "react";
import { cx } from "../lib/carousel";
import { navigate, usePath } from "../lib/router";
import { useApi } from "../lib/useResource";
import { useSession } from "../lib/sessionContext";
import { displayFiat, resolveGame } from "../lib/adapters";
import { betHistory, history, sportsBets, wallet } from "../lib/endpoints";
import { sections } from "../data/catalog";
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

const KNOWN_GAMES = sections.flatMap((s) => s.games || []);

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
    columns: [
      { label: "Game", className: "BetTransactions_data" },
      { label: "Date", className: "BetTransactions_dateTooltipTrigger" },
      { label: "Amount", className: "BetTransactions_currency" },
      "Multiplier",
      { label: "Bet ID", className: "BetTransactions_row" },
    ],
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

/** A coin mark and its amount in the player's display fiat, as on the reference. */
function Money({ amount, coin }) {
  const { displayCurrency, rates } = useSession();
  return (
    <span className="IconValue_root FormattedAmount_root">
      <CoinIcon code={coin} />
      {displayFiat(amount ?? "0", coin, displayCurrency, rates)}
    </span>
  );
}

function shorten(value) {
  const text = String(value ?? "");
  return text.length > 18 ? `${text.slice(0, 8)}…${text.slice(-6)}` : text || "—";
}

/** `Cf36otA...` — the reference's bet-id shortening. */
function shortenBetId(value) {
  const text = String(value ?? "");
  if (!text) return "—";
  if (text.length <= 10) return text;
  return `${text.slice(0, 7)}...`;
}

function BetGameCell({ title, knownGames }) {
  const game = resolveGame(title, knownGames);
  return (
    <span className="ActivityBaseTable_gameTitle BetTransactions_gameTitle">
      <img alt={game.name} className="nimg-contain" height="16" src={game.img} width="16" />
      <span className="GameTitle_root">{game.name}</span>
    </span>
  );
}

function BetMultiplierCell({ row }) {
  const mult = betMultiplier(row);
  const lose = mult < 1;
  return (
    <span className="MultiplierCell_root">
      <img
        alt=""
        className={cx(lose && "MultiplierCell_greyOut")}
        height="16"
        src={`/icons/${lose ? "multi-decrease" : "multi-increase"}.svg`}
        width="16"
      />
      <span className={cx(lose && "MultiplierCell_greyOut")}>{mult.toFixed(2)}x</span>
    </span>
  );
}

function BetIdCell({ id }) {
  const [copied, setCopied] = useState(false);
  const full = String(id ?? "");
  return (
    <button
      type="button"
      className="BetTransactions_betIdLink"
      aria-label="Copy bet id"
      onClick={() => {
        if (!full) return;
        navigator.clipboard?.writeText(full).then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => {}
        );
      }}
    >
      <img alt="" height="16" width="16" src={copied ? "/icons/tick-circle-green.svg" : "/icons/copy.svg"} />
      <span>{shortenBetId(full)}</span>
    </button>
  );
}

/** In-house rounds carry stake and win on one row; separate BET/WIN legs do not. */
function betMultiplier(row) {
  const stake = Number(row.amount) || 0;
  if (stake <= 0) return 0;
  const profit = Number(row.profit) || 0;
  if (row.transaction_type === "ROUND") return (stake + profit) / stake;
  return 0;
}

/** Player-facing labels for `credits_ledger.reason` (and a few module-specific codes). */
const LEDGER_REASON_LABELS = {
  BET_STAKE: "Casino bet",
  BET_PAYOUT: "Casino win",
  BET_REFUND: "Bet refund",
  BET_ROLLBACK: "Bet rollback",
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  WITHDRAWAL_REVERSAL: "Withdrawal reversal",
  ADMIN_CREDIT: "Admin credit",
  ADMIN_DEBIT: "Admin debit",
  TRANSFER_IN: "Transfer in",
  TRANSFER_OUT: "Transfer out",
  BONUS: "Bonus",
  BONUS_REVERSAL: "Bonus reversal",
  rakeback_claim: "Rakeback",
  p2p_sell_hold: "P2P sell hold",
  p2p_sell_refund: "P2P refund",
  p2p_buy_release: "P2P buy release",
};

function formatLedgerReasonCode(code) {
  if (!code) return "—";
  return String(code)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/** Prefer operator-written descriptions (vault, transfers), then known reason codes. */
function ledgerTypeLabel({ reason, description }) {
  const desc = String(description ?? "").trim();
  if (desc && desc !== reason) return desc;
  const key = String(reason ?? "");
  if (LEDGER_REASON_LABELS[key]) return LEDGER_REASON_LABELS[key];
  if (LEDGER_REASON_LABELS[key.toUpperCase()]) return LEDGER_REASON_LABELS[key.toUpperCase()];
  return formatLedgerReasonCode(key);
}

/** `GET /user/wallet/ledger` returns raw `credits_ledger` columns. */
function mapLedgerRow(row) {
  const amount = Number(row.amount) || 0;
  const reason = row.reason;
  const description = row.description;
  return {
    id: row.id,
    reason,
    description,
    type: ledgerTypeLabel({ reason, description }),
    createdAt: row.created_at,
    amount: Math.abs(amount),
    currency: row.currency,
    direction: amount >= 0 ? "credit" : "debit",
  };
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
    fetch: ({ limit, coin }) =>
      history
        .deposits({ limit, ...(coin ? { currency: coin } : {}) })
        .then((rows) => (Array.isArray(rows) ? rows : [])),
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
    fetch: ({ limit, coin }) =>
      history
        .withdrawals({ limit, ...(coin ? { currency: coin } : {}) })
        .then((rows) => (Array.isArray(rows) ? rows : [])),
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
    // Player history is `.strict()` on the casino route — `currency` is not a
    // valid query key and would 422. Filter client-side after the page fetch.
    fetch: ({ limit, coin }) =>
      betHistory.mine({ limit, page: 1 }).then((r) => {
        const rows = r?.data ?? [];
        if (!coin) return rows;
        return rows.filter((row) => String(row.currency_code || "").toUpperCase() === coin);
      }),
    key: (row) => row.transaction_id || row.round_id || row.id,
    cells: (row) => [
      <BetGameCell title={row.game_title || row.gameName || row.game} knownGames={KNOWN_GAMES} />,
      shortDate(row.transaction_timestamp || row.createdAt),
      <Money amount={row.amount} coin={row.currency_code || row.currency} />,
      <BetMultiplierCell row={row} />,
      <BetIdCell id={row.transaction_id || row.round_id || row.betId || row.id} />,
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
    fetch: ({ limit, coin }) =>
      wallet
        .ledger({ limit, ...(coin ? { currency: coin } : {}) })
        .then((r) => (r?.data ?? []).map(mapLedgerRow)),
    key: (row) => row.id,
    cells: (row) => [
      row.type || ledgerTypeLabel(row) || "—",
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
  const active =
    TABS.find((t) => pathFor(t.id) === path)?.id ||
    (path === "/transactions/deposits" ? "deposits" : null) ||
    "deposits";
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
    <section className="LayoutContainer_root LayoutContainer_mobile-top-lg1 LayoutContainer_mobile-bottom-lg1 LayoutContainer_tablet-top-lg2 LayoutContainer_tablet-bottom-lg2 LayoutContainer_column Transactions_root">
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
            <tbody className="TableBody_tbody TableBody_even" data-testid="table-body">
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
