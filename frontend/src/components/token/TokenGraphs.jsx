import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SHFL } from "./tokenData";
import { PercentageText } from "./TokenSections";

/**
 * The four cards under the site stats — reference `TokenGraphs`.
 *
 * SHFL Price, SHFL Wager Volume, SHFL Supply, SHFL Lottery. The first two
 * carry a Daily / Weekly / Monthly select; the last two do not.
 *
 * ── RECHARTS, BECAUSE THE REFERENCE USES RECHARTS ────────────────────────
 *
 * The live page's chart markup is `recharts-responsive-container` >
 * `recharts-wrapper`, so this is not a library chosen for taste: picking the
 * same one means the DOM, the class names and the rendered SVG line up with
 * the original instead of approximating it.
 *
 * ── WHY THE CHART HEIGHT IS A NUMBER AND NOT `100%` ──────────────────────
 *
 * `.TokenChartContainer_chart` is `height: 100%; flex: 1 1 0%` inside a card
 * that is a grid item in an auto-sized row — so the percentage has nothing
 * definite to resolve against, `ResponsiveContainer` measures 0×0, and
 * recharts logs "The width(0) and height(0) of chart should be greater than
 * 0" once per card. It did exactly that here.
 *
 * The reference ends up with a 144px plot because its own grid resolves the
 * chain differently; rather than reverse-engineer that cascade, the height is
 * pinned to the figure measured off the live page. Card heights come out at
 * the reference's 302 / 302 / 323 / 323.
 *
 * ── THE SERIES ARE SHAPED, NOT REAL ──────────────────────────────────────
 *
 * There is no price feed on this backend and no token module, so there is no
 * history to plot. `series()` generates a smooth walk that ENDS on the real
 * published figure in `tokenData.js`, seeded off the card so it is stable
 * across renders rather than jittering on every state change.
 *
 * This is the one place on the page where invented data is drawn as though it
 * were measured, so each card says so in its support text. A chart with no
 * disclaimer reads as history, and this is not history. Wire a feed and delete
 * `series()`.
 */

/** The plot height measured on the live page, in px. See the note above. */
const PLOT_HEIGHT = 144;

/** A deterministic pseudo-random walk of `n` points ending at `end`. */
function series(seed, n, end, spread) {
  const points = [];
  let state = seed * 9301 + 49297;
  let value = end * (1 - spread);
  for (let i = 0; i < n; i += 1) {
    state = (state * 9301 + 49297) % 233280;
    const drift = (state / 233280 - 0.45) * end * spread * 0.6;
    value = Math.max(end * (1 - spread * 1.5), value + drift + (end - value) / (n - i));
    points.push({ i, value: Number(value.toFixed(6)) });
  }
  points[points.length - 1] = { i: n - 1, value: end };
  return points;
}

const PERIODS = ["Daily", "Weekly", "Monthly"];

/** `$0.3071` → `0.3071`. The cards store display strings, charts want numbers. */
const numeric = (text) => Number(String(text).replace(/[^0-9.]/g, "")) || 0;

function CardShell({ subHeading, heading, support, period, children }) {
  return (
    <section className="TokenChartContainer_root">
      <header className="TokenChartContainer_header">
        <div className="TokenChartContainer_title">
          <p className="TokenChartContainer_subHeading">{subHeading}</p>
          <h3 className="TokenChartContainer_heading">{heading}</h3>
          <div className="TokenChartContainer_supportText">{support}</div>
        </div>
        {period && (
          <div className="TokenChartContainer_action">
            <div className="TokenChartContainer_actionPanel">{period}</div>
          </div>
        )}
      </header>
      {children}
    </section>
  );
}

function AreaCard({ subHeading, heading, support, seed, end, spread, colour, chartClass }) {
  const [period, setPeriod] = useState("Weekly");
  const data = useMemo(() => series(seed, 32, end, spread), [seed, end, spread]);

  return (
    <CardShell
      subHeading={subHeading}
      heading={heading}
      support={support}
      period={
        <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label={`${subHeading} period`}>
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      }
    >
      <div className={`TokenChartContainer_chart${chartClass ? ` ${chartClass}` : ""}`}>
        <ResponsiveContainer width="100%" height={PLOT_HEIGHT}>
          <AreaChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`shfl-fill-${seed}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colour} stopOpacity={0.35} />
                <stop offset="100%" stopColor={colour} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="i" hide />
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Tooltip
              cursor={{ stroke: "var(--color-gray700)" }}
              contentStyle={{
                background: "var(--color-gray900)",
                border: "1px solid var(--color-gray700)",
                borderRadius: "var(--radius-sm1)",
                fontSize: "var(--text-md)",
              }}
              labelFormatter={() => ""}
              formatter={(v) => [v, subHeading]}
            />
            <Area type="monotone" dataKey="value" stroke={colour} strokeWidth={2} fill={`url(#shfl-fill-${seed})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </CardShell>
  );
}

/**
 * The supply breakdown.
 *
 * Not a chart — the reference draws it as a list whose rows carry a 1px bar
 * across the top, `TokenGraphs_supplyBar` in one of three colours, widened to
 * that slice's share.
 */
function SupplyCard() {
  return (
    <CardShell subHeading="SHFL Supply" heading={SHFL.maxSupply} support="(Max. Supply)">
      <div className="TokenChartContainer_chart TokenGraphs_content">
        <ul className="TokenGraphs_progress">
          {SHFL.supply.map((r) => (
            <li key={r.label} style={{ position: "relative", padding: "var(--spacing-md) 0" }}>
              <span className={`TokenGraphs_supplyBar ${r.cls}`} style={{ width: `${r.pct}%` }} />
              <div className="TokenGraphs_balance">
                <img src={r.icon} alt="" width="16" height="16" />
                {r.label}
                <span className="TokenGraphs_amount" style={{ marginLeft: "auto" }}>
                  {r.amount}
                </span>
                <span>({r.pct}%)</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </CardShell>
  );
}

export default function TokenGraphs() {
  return (
    <section className="TokenGraphs_root">
      <div className="TokenGraphs_graphContainer">
        <AreaCard
          subHeading="SHFL Price"
          heading={SHFL.price}
          support={
            <>
              <PercentageText value={SHFL.change24h} /> <span>· sample series</span>
            </>
          }
          seed={1}
          end={numeric(SHFL.price)}
          spread={0.18}
          colour="var(--color-success)"
          chartClass="TokenGraphs_barChartContainer"
        />

        <AreaCard
          subHeading="SHFL Wager Volume"
          heading={SHFL.wagerVolume}
          support={
            <span className="TokenGraphs_balance">
              <img src="/icons/crypto/shfl.svg" alt="SHFL" width="14" height="14" />
              {SHFL.wagerVolumeShfl} <span>· sample series</span>
            </span>
          }
          seed={2}
          end={numeric(SHFL.wagerVolume)}
          spread={0.4}
          colour="var(--color-primaryViolet)"
        />

        <SupplyCard />

        <AreaCard
          subHeading="SHFL Lottery"
          heading={SHFL.lotteryPrizePool}
          support={
            <>
              {SHFL.lotteryTotalStake} <span>· sample series</span>
            </>
          }
          seed={4}
          end={numeric(SHFL.lotteryPrizePool)}
          spread={0.25}
          colour="var(--color-warning)"
        />
      </div>
    </section>
  );
}
