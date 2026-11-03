import { useEffect, useMemo, useState } from "react";
import { cx } from "../../lib/carousel";
import { UserCell } from "./PromoWidgets";
import { RaceHeader } from "./BoardHeaders";
import { sections } from "../../data/catalog";
import { betHistory, race as raceApi } from "../../lib/endpoints";
import { formatAmount, timeLeft, toBoardRows, toRaceRows } from "../../lib/adapters";
import { useSession } from "../../lib/sessionContext";
import { useGate } from "../../lib/gates";
import { navigate } from "../../lib/router";

/**
 * "My Bets" is the one tab that needs a session. The reference disables it
 * while signed out, which is exactly what `GET /casino/bet-history` requires,
 * so the flag follows the session rather than being hardcoded off.
 */
const tabsFor = (signedIn) => [
  { id: "my-bets", label: "My Bets", disabled: !signedIn },
  { id: "latest-bets", label: "Latest Bets" },
  { id: "high-roller-bets", label: "High Rollers" },
  { id: "race", label: "Weekly Race" },
];

const columns = ["User", "Game", "Bet Amount", "Multiplier", "Payout"];
const LIMITS = ["0", "10", "20", "30", "40"];

/** How often the live tabs re-read. The reference pushes over a socket; this polls. */
const POLL_MS = 5000;

const ordinal = (n) => `${n}${n % 100 > 10 && n % 100 < 14 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;

const boards = {
  race: { columns: ["Rank", "User", "Wagered", "Prize"], widths: [null, null, null, null], tableClass: "Race_table", rows: [], header: <RaceHeader /> },
};

function StandingRow({ r, index, kind }) {
  return (
    <tr className="ActivityBoard_rowEnter" style={{ "--row-i": index }}>
      <td>
        <p>{ordinal(r.rank)}</p>
      </td>
      <td>
        <UserCell user={r.user} />
      </td>
      <td>
        {kind === "race" ? (
          <span className="IconValue_root FormattedAmount_root">
            <img alt="USD" height="16" src="/icons/fiat/USD.svg" width="16" />
            {r.amount}
          </span>
        ) : (
          <div className="Flex_root Flex_sm4 PointsCell_root">
            <img alt="rank" height="16" src="/icons/ranks.svg" width="16" />
            <p>{r.amount}</p>
          </div>
        )}
      </td>
      <td>
        {/* `payout` / `payoutCurrency` from the race leaderboard; a row with no payout is left empty. */}
        {r.prize == null ? null : kind === "race" ? (
          <span className="IconValue_root FormattedAmount_root Race_racePrizeText">
            {r.coin && (
              <img alt={r.coin.toUpperCase()} className="CryptoIcon_root CryptoIcon_image" height="16" src={`/icons/crypto/${r.coin}.svg`} width="16" onError={(e) => { e.currentTarget.style.display = "none"; }} />
            )}
            {r.prize}
          </span>
        ) : (
          <span className="IconValue_root FormattedAmount_green">
            <img alt="SHFL" className="CryptoIcon_root CryptoIcon_image" height="16" src="/icons/crypto/shfl.svg" width="16" />
            <span className="Tooltip_trigger">
              <span className="FiatWithTooltip_root fiat-with-tool-tip-text">{r.prize}</span>
            </span>
          </span>
        )}
      </td>
    </tr>
  );
}

function Amount({ coin, value, className }) {
  return (
    <span className="IconValue_root">
      <img alt={coin.toUpperCase()} className="CryptoIcon_root CryptoIcon_image" height="16" src={`/icons/crypto/${coin}.svg`} width="16" />
      <span className={cx("FormattedAmount_root", className, "formatted-amount-value")}>{value}</span>
    </span>
  );
}

/** Only the catalogue's games have a page here; in-house originals stay inert (see GameCarousel). */
const gamePage = (href) => (String(href || "").startsWith("/casino/games/") ? href : null);

function Row({ r, index }) {
  const lose = r.mult < 1;
  const page = gamePage(r.game.href);
  const open = () => page && navigate(page);
  return (
    <tr
      role="button"
      aria-label="View detail"
      tabIndex={0}
      className="ActivityBoard_rowEnter"
      style={{ "--row-i": index, cursor: page ? "pointer" : undefined }}
      onClick={open}
      onKeyDown={(e) => e.key === "Enter" && open()}
    >
      <td>
        <UserCell user={r.user} />
      </td>
      <td>
        <button type="button" value={r.game.href} className="ActivityBaseTable_gameTitle" onClick={open}>
          <img alt={r.game.name} height="16" src={r.game.img} width="16" />
          <span className="GameTitle_root">{r.game.name}</span>
        </button>
      </td>
      <td>
        <Amount coin={r.coin} value={r.bet} />
      </td>
      <td>
        <span className="MultiplierCell_root">
          <img alt={lose ? "decrease" : "increase"} className={cx(lose && "MultiplierCell_greyOut")} height="16" src={`/icons/${lose ? "multi-decrease" : "multi-increase"}.svg`} width="16" />
          <span className={cx(lose && "MultiplierCell_greyOut")}>{r.mult.toFixed(2)}x</span>
        </span>
      </td>
      <td>
        <Amount coin={r.coin} value={r.payout} className={lose ? "PayoutCell_lose" : "PayoutCell_win"} />
      </td>
    </tr>
  );
}

/**
 * Latest bets board — reference `ActivityBoard`. The reference mounts it lazily
 * once the live feed connects; `visible={false}` reproduces the pre-connect state.
 */
export default function ActivityBoard({ visible = true, initialTab = "latest-bets", hideTabs = [] }) {
  const { signedIn } = useSession();
  const on = useGate();
  const [selected, setSelected] = useState(initialTab);
  const [limit, setLimit] = useState("10");
  const [limitOpen, setLimitOpen] = useState(false);
  const tabs = tabsFor(signedIn);

  // Signing out while "My Bets" is open leaves a tab the session no longer
  // allows. Derived from the session rather than corrected by an effect, so
  // there is no render showing a signed-out player somebody's bet history.
  const shownTabs = tabs.filter((t) => !hideTabs.includes(t.id) && (t.id !== "race" || on("races")));
  const wanted = !signedIn && selected === "my-bets" ? "latest-bets" : selected;
  // A tab switched off (home section flags) hands over to the first one still open.
  const active = shownTabs.some((t) => t.id === wanted && !t.disabled) ? wanted : shownTabs.find((t) => !t.disabled)?.id ?? wanted;
  const setActive = setSelected;

  const isFeed = active === "latest-bets" || active === "high-roller-bets" || active === "my-bets";
  const feedKey = active === "high-roller-bets" ? "high" : active === "my-bets" ? "mine" : "latest";

  /**
   * Artwork for the in-house game codes the bet rows carry. Flattened once
   * rather than per row — the board re-renders on every poll.
   */
  const knownGames = useMemo(() => sections.flatMap((s) => s.games || []), []);

  /**
   * The live rows.
   *
   * The reference pushes these down a socket. There is no socket client here
   * yet, so the three live tabs poll their route and the two that have no
   * backend at all (the SHFL airdrop board) keep their capture.
   *
   * Every tab falls back to the captured rows when its read is empty or fails,
   * for the reason in `lib/useResource.js`: a fresh database has four bets in
   * it and an empty board would read as a broken page rather than a quiet one.
   */
  const [live, setLive] = useState({ latest: null, high: null, mine: null, race: null, raceInfo: null });

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;

    const read = async () => {
      try {
        const size = Math.max(Number(limit) || 10, 10);
        if (active === "latest-bets") {
          const rows = await betHistory.live(size);
          if (!cancelled) setLive((s) => ({ ...s, latest: toBoardRows(rows, knownGames) }));
        } else if (active === "high-roller-bets") {
          const rows = await betHistory.topWins(size);
          if (!cancelled) setLive((s) => ({ ...s, high: toBoardRows(rows, knownGames) }));
        } else if (active === "my-bets" && signedIn) {
          const { data } = await betHistory.mine({ limit: size });
          if (!cancelled) setLive((s) => ({ ...s, mine: toBoardRows(data, knownGames) }));
        } else if (active === "race") {
          const board = await raceApi.leaderboard("weekly");
          if (!cancelled) {
            setLive((s) => ({ ...s, race: toRaceRows(board?.leaderboard, board?.payoutCurrency), raceInfo: board }));
          }
        }
      } catch {
        // Leave whatever is on screen. The fallback below covers a null.
      }
    };

    read();
    // The leaderboard is an aggregate over a week and does not move between
    // paints; only the two tickers are worth re-reading.
    const poll = active === "latest-bets" || active === "high-roller-bets";
    const t = poll ? setInterval(read, POLL_MS) : null;
    return () => {
      cancelled = true;
      if (t) clearInterval(t);
    };
  }, [active, limit, visible, signedIn, knownGames]);

  const feeds = {
    // Platform rows only — an empty feed is an empty table, not sample players.
    latest: live.latest || [],
    high: live.high || [],
    // A signed-in player with no bets yet has an empty history, and that is the
    // honest answer for their own tab — no capture stands in for it.
    mine: live.mine || [],
  };

  const feed = feeds[feedKey];
  const staticBoard = boards[active];
  const board = staticBoard && active === "race" ? {
          ...staticBoard,
          rows: live.race || [],
          header: (
            <RaceHeader
              prize={live.raceInfo ? `${formatAmount(live.raceInfo.payoutNetPrizePool)} ${live.raceInfo.payoutCurrency || ""}` : "—"}
              coin={String(live.raceInfo?.payoutCurrency || "").toLowerCase() || null}
              remaining={live.raceInfo ? timeLeft(live.raceInfo.endsAt) || "—" : "—"}
            />
          ),
        } : staticBoard;
  const cols = board ? board.columns : columns;

  const rows = feed.slice(0, Number(limit) || 10);

  const table = (
          <div className="Table_root">
            <table className={cx("Table_table", !board && "Table_split50", board?.tableClass)}>
              <thead>
                <tr>
                  {cols.map((c, i) => (
                    <td key={c} width={board ? board.widths[i] || undefined : "20%"}>
                      {c}
                    </td>
                  ))}
                </tr>
              </thead>
              {isFeed ? (
                <tbody className="TableBody_tbody TableBody_odd TableBody_withClick">
                  {rows.map((r, i) => (
                    <Row key={r.key} r={r} index={i} />
                  ))}
                </tbody>
              ) : board ? (
                <tbody className="TableBody_tbody TableBody_even">
                  {board.rows.slice(0, Number(limit) || 10).map((r, i) => (
                    <StandingRow key={r.rank} r={r} index={i} kind={active} />
                  ))}
                </tbody>
              ) : (
                <tbody className="TableSkeleton_root">
                  {Array.from({ length: Number(limit) || 10 }).map((_, r) => (
                    <tr key={r}>
                      {columns.map((c) => (
                        <td key={c} width="20%">
                          <div className="TableSkeleton_wrapper">
                            <span className="SkeletonPlaceholder_root SkeletonPlaceholder_longAnimationRepeats TableSkeleton_circle" />
                            <span className="SkeletonPlaceholder_root SkeletonPlaceholder_longAnimationRepeats TableSkeleton_rect" />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
  );

  return (
    <div className="Layout_table" id="lazy-component">
      <div>
        <section
          className="LayoutContainer_root ActivityBoard_wrapper LayoutContainer_mobile-top-md2 LayoutContainer_mobile-bottom-md2 LayoutContainer_tablet-top-lg4 LayoutContainer_tablet-bottom-lg4 LayoutContainer_column"
          style={visible ? undefined : { display: "none" }}
        >
          <div className="Flex_root Flex_column Flex_md2 ActivityBoard_actionPanel">
            <div className="Tab_root">
              <div className="Tab_tabsContainer" role="tablist">
                {shownTabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={active === t.id}
                    className={cx("Tab_tab", active === t.id && "Tab_active", t.disabled && "Tab_disabled")}
                    value={t.id}
                    disabled={t.disabled || active === t.id}
                    onClick={() => setActive(t.id)}
                  >
                    <p className="Tab_text">{t.label}</p>
                  </button>
                ))}
              </div>
            </div>
            {active !== "race" && active !== "airDropRace" && (
            <div className="ActivityBoard_selectWrapper ActivityBoard_hideMobile">
              <div className="FormControlWrapper_root Select_formWrapper">
                <div
                  aria-hidden="true"
                  data-testid="hidden-select-container"
                  style={{ border: 0, clip: "rect(0px, 0px, 0px, 0px)", clipPath: "inset(50%)", height: 1, margin: -1, overflow: "hidden", padding: 0, position: "fixed", width: 1, whiteSpace: "nowrap", top: 0, left: 0 }}
                >
                  <label>
                    <select name="activity query limit select" value={limit} onChange={(e) => setLimit(e.target.value)}>
                      {LIMITS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  aria-label="activity query limit select"
                  aria-haspopup="listbox"
                  aria-expanded={limitOpen}
                  className="Select_button ActivityBoard_select"
                  onClick={() => setLimitOpen((o) => !o)}
                >
                  <span className="Select_item">
                    <span className="Select_text">{limit}</span>
                  </span>
                  <img alt="Toggle dropdown menu" className={cx("Select_chevronIcon", limitOpen && "Select_up")} src="/icons/chevron.svg" />
                </button>
                {limitOpen && (
                  <ul className="ActivityBoard_selectPopup" role="listbox">
                    {LIMITS.map((v) => (
                      <li key={v}>
                        <button
                          aria-selected={v === limit}
                          className={cx("ActivityBoard_selectOption", v === limit && "ActivityBoard_selectOptionSelected")}
                          role="option"
                          type="button"
                          onClick={() => { setLimit(v); setLimitOpen(false); }}
                        >
                          {v}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            )}
          </div>

          {board?.wrap ? (
            <div className="Flex_root Flex_column AirDropRaceTable_root">
              {board.header}
              {table}
            </div>
          ) : (
            <>
              {board?.header}
              {table}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
