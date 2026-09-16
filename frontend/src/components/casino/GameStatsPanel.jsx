import { useId, useMemo, useState } from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer } from "recharts";
import { cx } from "../../lib/carousel";
import { betHistory } from "../../lib/endpoints";
import { useApi } from "../../lib/useResource";
import { useSession } from "../../lib/sessionContext";
import { formatAmount } from "../../lib/adapters";

/**
 * Live Stats — reference `LiveGameStats`, opened by the control bar's
 * statistics button.
 *
 * ── WHAT IS VERBATIM HERE AND WHAT IS NOT ────────────────────────────────
 *
 * The MARKUP is the reference's, class for class: `Collapse_*` around each
 * section, `LiveGameStats_liveGameStatsRow` / `_Cell` / `_CellHeader` for the
 * 2×2 grid, `LiveGameStatsCellValue_*` for a figure and its win/loss colour,
 * `IconValue_root FormattedAmount_root` for an amount beside its currency
 * mark, and `LiveGameStatsChart_*` around a recharts surface.
 *
 * The `Collapse_*`, `IconValue_*` and `FormattedAmount_*` RULES already ship in
 * this clone and style this for free. The `LiveGameStats*` rules do NOT: the
 * reference code-splits this panel and only fetches its chunk when a signed-in
 * player opens it, so a stylesheet captured from a page load never held them.
 * Those few rules are written in `shuffle-game.css` under their own heading and
 * are the one part of this panel to replace when that chunk can be captured.
 *
 * ── WHERE THE NUMBERS COME FROM ──────────────────────────────────────────
 *
 * There is no per-game statistics route. `GET /casino/bet-history` answers the
 * caller's own rounds across all four sources and every row carries a
 * `game_uid`, so this reads a page of that history and keeps the rows for THIS
 * game. Profit, wagered, wins and losses are counted from those rows.
 *
 * `search` on that route matches the transaction reference, not the game, so
 * the filter cannot be pushed into the query. A `gameRef` filter on the
 * listing is the change to make if these numbers start being leaned on.
 */
const PAGE = 200;

/** A section, with the reference's own collapse markup. */
function Collapse({ title, open, onToggle, children }) {
  const id = useId();
  return (
    <div className="Collapse_collapseRoot LiveGameStats_collapse" aria-expanded={open}>
      <div className="Collapse_collapseHeader LiveGameStats_collapseHeader" aria-expanded={open}>
        {/* The reference's header button is an empty absolutely-positioned
            overlay — the whole header is the hit target, and the title beside
            it is `pointer-events: none`. */}
        <button
          type="button"
          className="Collapse_collapseHeaderButton"
          aria-expanded={open}
          aria-controls={id}
          aria-labelledby={`${id}-title`}
          data-testid="collapse"
          onClick={onToggle}
        />
        <div id={`${id}-title`} className="Collapse_collapseTitle">
          {title}
        </div>
        <div className="Collapse_collapseRightContent">
          <span className="CollapseToggleButton_collapseToggle">
            <img
              alt="chevron"
              className={cx("Collapse_chevronIcon", open ? "Collapse_chevronOpen" : "Collapse_chevronClosed")}
              src="/icons/chevron.svg"
            />
          </span>
        </div>
      </div>
      {open && children ? (
        <div id={id} className="Collapse_container">
          <div>
            <div className="Collapse_collapseBody LiveGameStats_collapseBody">{children}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** An amount beside its currency mark — the reference's `IconValue`. */
function Amount({ code, value }) {
  return (
    <span className="IconValue_root FormattedAmount_root">
      <img alt={code} height="16" src={`/icons/fiat/${code}.svg`} width="16" />
      {formatAmount(value)}
    </span>
  );
}

/** One cell of the 2×2 grid. `tone` is the reference's win / loss colouring. */
function Cell({ label, children, tone, side, pad }) {
  return (
    <div
      className={cx(
        "LiveGameStats_liveGameStatsCell",
        side === "left" ? "LiveGameStats_liveGameStatsCellHasBorder" : "LiveGameStats_liveGameStatsCellNoBorder",
        pad === "bottom"
          ? "LiveGameStats_liveGameStatsCellBottomPadding"
          : "LiveGameStats_liveGameStatsCellTopPadding"
      )}
    >
      <div
        className={cx(
          "LiveGameStats_liveGameStatsCellHeader",
          pad === "bottom"
            ? "LiveGameStats_liveGameStatsCellHeaderHasBorder"
            : "LiveGameStats_liveGameStatsCellHeaderNoBorder"
        )}
      >
        {label}
      </div>
      <div
        className={cx(
          "LiveGameStatsCellValue_liveGameStatsCellValue",
          tone === "win" && "LiveGameStatsCellValue_liveGameStatsCellValueWin",
          tone === "loss" && "LiveGameStatsCellValue_liveGameStatsCellValueLoss"
        )}
      >
        {children}
      </div>
    </div>
  );
}

export default function GameStatsPanel({ game }) {
  const { signedIn } = useSession();
  const [statsOpen, setStatsOpen] = useState(true);
  const [promosOpen, setPromosOpen] = useState(false);

  const { data } = useApi(`game-stats:${game.uuid}`, () => betHistory.mine({ limit: PAGE }), {
    enabled: signedIn,
  });

  const stats = useMemo(() => {
    // `betHistory.mine` is a `withMeta` read, so it resolves `{ data, meta }`
    // and the rows are one level down. Both shapes are accepted so the panel
    // does not break if that route stops being paginated.
    const all = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : (data?.rows ?? []);
    // Oldest first, so the running total below reads left to right.
    const mine = all
      .filter((r) => String(r.game_uid ?? "") === String(game.uuid))
      .slice()
      .reverse();

    let wagered = 0;
    let profit = 0;
    let wins = 0;
    let losses = 0;
    const series = [];
    for (const r of mine) {
      const p = Number(r.profit) || 0;
      wagered += Number(r.amount) || 0;
      profit += p;
      if (p > 0) wins += 1;
      else if (p < 0) losses += 1;
      series.push({ profit });
    }

    // The rounds are one currency in practice — the launch is per-currency —
    // so the first row names the unit rather than mixing marks in a column.
    const code = mine.find((r) => r.currency_code)?.currency_code || "INR";
    return { wagered, profit, wins, losses, series, code };
  }, [data, game.uuid]);

  const tone = stats.profit > 0 ? "win" : stats.profit < 0 ? "loss" : null;

  return (
    <section className="LiveGameStats_root" id="live-game-stats">
      <Collapse title="Stats" open={statsOpen} onToggle={() => setStatsOpen((v) => !v)}>
        {/* The reference's range select. One option until there is a second
            thing to scope by — the backend has no per-game window filter, so a
            populated list here would be a control with no query behind it. */}
        <div className="FormControlWrapper_root Select_formWrapper" data-testid="live game select">
          <label className="sr-only">
            live game select
            <select name="live game select" defaultValue="ALL">
              <option value="ALL">All</option>
            </select>
          </label>
          <button type="button" aria-label="live game select" className="Select_button LiveGameStats_liveGameSelect">
            <span className="Select_item">
              <span className="Select_text">All</span>
            </span>
            <img alt="Toggle dropdown menu" className="Select_chevronIcon" src="/icons/chevron.svg" />
          </button>
        </div>

        <div className="LiveGameStats_liveGameStatsBody">
          <div className="LiveGameStats_liveGameStatsRow LiveGameStats_liveGameStatsRowHasBorder">
            <Cell label="Profit" side="left" pad="bottom" tone={tone}>
              <Amount code={stats.code} value={stats.profit} />
            </Cell>
            <Cell label="Wins" side="right" pad="bottom" tone={stats.wins ? "win" : null}>
              {stats.wins}
            </Cell>
          </div>
          <div className="LiveGameStats_liveGameStatsRow">
            <Cell label="Wagered" side="left" pad="top">
              <Amount code={stats.code} value={stats.wagered} />
            </Cell>
            <Cell label="Losses" side="right" pad="top" tone={stats.losses ? "loss" : null}>
              {stats.losses}
            </Cell>
          </div>
        </div>

        <div className="LiveGameStatsChart_liveGameStatsChartContainer">
          <div
            className={cx(
              "LiveGameStatsCellValue_liveGameStatsCellValue",
              "LiveGameStatsCellValue_liveGameStatsCellValueMarginLeft",
              tone === "win" && "LiveGameStatsCellValue_liveGameStatsCellValueWin",
              tone === "loss" && "LiveGameStatsCellValue_liveGameStatsCellValueLoss"
            )}
          >
            <Amount code={stats.code} value={stats.profit} />
          </div>
          <div className="LiveGameStatsChart_liveGameStatsChartWrapper">
            <ProfitChart series={stats.series} />
          </div>
        </div>
      </Collapse>

      {/* Collapsed, and empty when opened: there is no per-game promotion
          object in any of the four services to list. The section is here
          because the reference's panel has it and it is one read away from
          being real; it says so rather than showing nothing at all. */}
      <Collapse title="Promotions" open={promosOpen} onToggle={() => setPromosOpen((v) => !v)}>
        <p className="LiveGameStats_note">No promotions are running on this game.</p>
      </Collapse>
    </section>
  );
}

/**
 * The running-profit line.
 *
 * The reference splits the stroke at the zero line — green above, red below —
 * with two gradients whose stops both sit at the crossing point. The same
 * trick is used here, with the offset computed from the series so the colour
 * changes exactly where the profit does.
 *
 * With no rounds the reference draws the zero line and a single dot at the
 * centre, which is what an empty series produces here too.
 */
function ProfitChart({ series }) {
  const points = series.length ? series : [{ profit: 0 }];
  const values = points.map((p) => p.profit);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  // Where zero sits between the extremes, as a 0–1 offset from the top.
  const zero = max === min ? 0.5 : max / (max - min);

  return (
    <ResponsiveContainer height={125} width="100%">
      <AreaChart data={points} margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
        <defs>
          <linearGradient id="strokeSplitColor" x1="0" x2="0" y1="0" y2="1">
            <stop offset={zero} stopColor="#3DD179" />
            <stop offset={zero} stopColor="#F1323E" />
          </linearGradient>
          <linearGradient id="bgSplitColor" x1="0" x2="0" y1="0" y2="1">
            <stop offset={zero} stopColor="#3DD179" stopOpacity="0.7" />
            <stop offset={zero} stopColor="#F1323E" stopOpacity="0.7" />
          </linearGradient>
        </defs>
        <ReferenceLine stroke="#828998" strokeWidth={2} y={0} />
        <Area
          dataKey="profit"
          dot={{ r: 5, fill: "#FFFFFF", stroke: "#FFFFFF", strokeWidth: 2 }}
          fill="url(#bgSplitColor)"
          fillOpacity={0.15}
          isAnimationActive={false}
          stroke="url(#strokeSplitColor)"
          strokeWidth={2}
          type="linear"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
