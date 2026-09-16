import { useEffect, useMemo, useState } from "react";
import { cx } from "../../lib/carousel";
import { UserCell } from "./PromoWidgets";
import { AirdropHeader, RaceHeader } from "./BoardHeaders";
import { sections } from "../../data/catalog";
import { betHistory } from "../../lib/endpoints";
import { toBoardRows, toStandingRows } from "../../lib/adapters";
import { useSession } from "../../lib/sessionContext";

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
  { id: "airDropRace", label: "SHFL Airdrop" },
];

const columns = ["User", "Game", "Bet Amount", "Multiplier", "Payout"];
const LIMITS = ["0", "10", "20", "30", "40"];

/** How often the live tabs re-read. The reference pushes over a socket; this polls. */
const POLL_MS = 5000;

const game = (sectionId, name) => {
  const s = sections.find((x) => x.id === sectionId);
  return s?.games.find((g) => g.name === name) || s?.games[0];
};

/** Sample feed rows modelled on the reference's live-bets table. */
const latest = [
  { user: { name: "Tenkinek", vip: "bronze" }, game: game("shuffle-games", "Blackjack"), coin: "sol", bet: "0.06568787", mult: 0, payout: "-0.06568787" },
  { user: { name: "RileyD", vip: "gold" }, game: game("slots", "Shuffle Spinman"), coin: "usdt", bet: "5.40932025", mult: 0, payout: "-5.40932025" },
  { user: null, game: game("slots", "3 Wildos"), coin: "usdc", bet: "16.00000000", mult: 0.93, payout: "-1.16000000" },
  { user: { name: "boldropfr", vip: "sapphire" }, game: game("live-casino", "Blackjack Italia Tricolore"), coin: "eth", bet: "150.98192000", mult: 1.54, payout: "232.27987693" },
  { user: { name: "Zephyr_88", vip: "opal" }, game: game("shuffle-games", "Dice"), coin: "btc", bet: "0.00120000", mult: 1.98, payout: "0.00117600" },
  { user: null, game: game("shuffle-games", "Plinko"), coin: "shfl", bet: "250.00000000", mult: 0, payout: "-250.00000000" },
  { user: { name: "mikaelsson", vip: "gold" }, game: game("game-shows", "Crazy Time"), coin: "usdt", bet: "40.00000000", mult: 5.0, payout: "160.00000000" },
  { user: { name: "Lunaria", vip: "bronze" }, game: game("shuffle-games", "Mines"), coin: "sol", bet: "1.20000000", mult: 2.06, payout: "1.27200000" },
  { user: null, game: game("latest-releases"), coin: "eth", bet: "0.05000000", mult: 0, payout: "-0.05000000" },
  { user: { name: "goldenhand", vip: "sapphire" }, game: game("shuffle-picks"), coin: "usdc", bet: "75.00000000", mult: 12.4, payout: "855.00000000" },
];

const highRollers = latest.map((r, i) => ({ ...r, bet: (Number(r.bet) * 40 + i).toFixed(8), payout: (Number(r.payout) * 40).toFixed(8) }));

const names = ["Benwarner", null, "GOATZK", "vladz", null, "apabapanapa", "Zephyr_88", null, "mikaelsson", "Lunaria"];
const vips = ["opal", null, "opal", "gold", null, "sapphire", "platinum", null, "gold", "bronze"];
const standings = (prizes, coin, amounts) =>
  names.map((n, i) => ({ rank: i + 1, user: n ? { name: n, vip: vips[i] } : null, amount: amounts[i], prize: prizes[i], coin }));

/** Weekly race: wagered in USD, prizes paid in BTC. */
const race = standings(
  ["$25,000.00", "$15,000.00", "$7,000.00", "$5,000.00", "$4,000.00", "$3,500.00", "$3,000.00", "$2,500.00", "$2,000.00", "$1,750.00"],
  "btc",
  ["$13,486,927.14", "$13,228,488.27", "$11,971,228.62", "$11,138,400.00", "$7,733,245.47", "$6,821,551.74", "$4,784,527.19", "$4,443,999.96", "$4,068,726.46", "$3,902,118.30"]
);

/** SHFL airdrop race: points earned, prizes in SHFL. */
const airdropRace = standings(
  ["50,000.00", "30,000.00", "20,000.00", "16,500.00", "14,150.00", "11,720.00", "9,800.00", "8,250.00", "7,100.00", "6,400.00"],
  "shfl",
  ["4,094,348.92", "2,751,753.00", "1,659,194.43", "1,638,210.84", "1,345,963.50", "1,111,125.72", "566,265.26", "512,004.10", "488,730.55", "401,220.00"]
);

const ordinal = (n) => `${n}${n % 100 > 10 && n % 100 < 14 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;

const boards = {
  race: { columns: ["Rank", "User", "Wagered", "Prize"], widths: [null, null, null, null], tableClass: "Race_table", rows: race, header: <RaceHeader /> },
  airDropRace: { columns: ["Rank", "User", "Points", "Allocation"], widths: ["25%", "25%", "25%", "25%"], wrap: true, rows: airdropRace, header: <AirdropHeader /> },
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
        {/* A live leaderboard row has no prize: the platform has no prize-table
            module, so the column is left empty rather than given a made-up
            figure. The captured rows still carry theirs. */}
        {r.prize == null ? null : kind === "race" ? (
          <span className="IconValue_root FormattedAmount_root Race_racePrizeText">
            <img alt="BTC" className="CryptoIcon_root CryptoIcon_image" height="16" src="/icons/crypto/btc.svg" width="16" />
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

function Row({ r, index }) {
  const lose = r.mult < 1;
  return (
    <tr role="button" aria-label="View detail" tabIndex={0} className="ActivityBoard_rowEnter" style={{ "--row-i": index }}>
      <td>
        <UserCell user={r.user} />
      </td>
      <td>
        <button type="button" value={r.game.href} className="ActivityBaseTable_gameTitle">
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
  const [selected, setSelected] = useState(initialTab);
  const [limit, setLimit] = useState("10");
  const [limitOpen, setLimitOpen] = useState(false);
  const tabs = tabsFor(signedIn);

  // Signing out while "My Bets" is open leaves a tab the session no longer
  // allows. Derived from the session rather than corrected by an effect, so
  // there is no render showing a signed-out player somebody's bet history.
  const active = !signedIn && selected === "my-bets" ? "latest-bets" : selected;
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
  const [live, setLive] = useState({ latest: null, high: null, mine: null, race: null });

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
          const board = await betHistory.leaderboard({ limit: size });
          if (!cancelled) setLive((s) => ({ ...s, race: toStandingRows(board?.rows) }));
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

  /** Live rows if the read found any, the capture otherwise. An empty array is not "some". */
  const pick = (fetched, captured) => (fetched && fetched.length ? fetched : captured);

  const feeds = {
    latest: pick(live.latest, latest.map((r, i) => ({ ...r, key: `s${i}` }))),
    high: pick(live.high, highRollers.map((r, i) => ({ ...r, key: `s${i}` }))),
    // A signed-in player with no bets yet has an empty history, and that is the
    // honest answer for their own tab — no capture stands in for it.
    mine: live.mine || [],
  };

  const feed = feeds[feedKey];
  const staticBoard = boards[active];
  const board = staticBoard && active === "race" ? { ...staticBoard, rows: pick(live.race, staticBoard.rows) } : staticBoard;
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
                {tabs.filter((t) => !hideTabs.includes(t.id)).map((t) => (
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
