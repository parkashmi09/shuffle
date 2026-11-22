import { useState } from "react";
import { useApi } from "../../lib/useResource";
import { betHistory } from "../../lib/endpoints";
import { cx } from "../../lib/carousel";

const PERIODS = [
  { id: "daily", label: "Today" },
  { id: "weekly", label: "This Week" },
  { id: "monthly", label: "This Month" },
];

const num = (v) => (v == null ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 }));

function Figure({ title, value }) {
  return (
    <div className="StatisticsPanel_infoItem">
      <div className="StatisticsPanel_betValueWrapper">
        <span className="StatisticsPanel_infoTitle">{title}</span>
        <span className="StatisticsPanel_infoValue">{value}</span>
      </div>
    </div>
  );
}

/**
 * Settings → Account: lifetime casino counts (`GET /casino/bet-history/stats` → `{ bets, wins }`) and
 * the caller's place on the wager board (`GET /casino/bet-history/leaderboard/me?period=` →
 * `{ rank|null, total, bets, wagered, won }`; wagered/won are summed across coins, so no symbol).
 * Never mounted for an agent's player (SettingsAccount returns early for them).
 */
export default function PlayStats() {
  const [period, setPeriod] = useState("weekly");
  const { data: life, error: lifeError } = useApi("settings:casino-stats", () => betHistory.stats());
  const { data: me, loading, error } = useApi(`settings:rank:${period}`, () => betHistory.myPosition({ period }));

  const rank = loading ? "—" : error ? "Unavailable" : me?.rank ? `#${me.rank} of ${me.total}` : "Not ranked";

  return (
    <div className="Panel_panelWrapper">
      <h2 className="Panel_panelHeading">Your Stats</h2>
      <div className="Flex_root Flex_column Flex_md2">
        <section className="StatisticsPanel_root">
          <div className="StatisticsPanel_statisticsInfo">
            <Figure title="Casino bets (lifetime)" value={lifeError ? "Unavailable" : num(life?.bets)} />
            <Figure title="Casino wins (lifetime)" value={lifeError ? "Unavailable" : num(life?.wins)} />
          </div>
        </section>

        <div className="Tab_root">
          <div className="Tab_tabsContainer" role="tablist">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={period === p.id}
                className={cx("Tab_tab", period === p.id && "Tab_active")}
                disabled={period === p.id}
                onClick={() => setPeriod(p.id)}
              >
                <p className="Tab_text">{p.label}</p>
              </button>
            ))}
          </div>
        </div>

        <section className="StatisticsPanel_root" aria-busy={loading}>
          <div className="StatisticsPanel_statisticsInfo">
            <Figure title="Your rank" value={rank} />
            <Figure title="Bets" value={loading || error ? "—" : num(me?.bets)} />
            <Figure title="Wagered" value={loading || error ? "—" : num(me?.wagered)} />
            <Figure title="Won" value={loading || error ? "—" : num(me?.won)} />
          </div>
        </section>
      </div>
    </div>
  );
}
