import { bonusCentre as centreApi, redeem as redeemApi } from "../../lib/endpoints";
import { useApi } from "../../lib/useResource";
import { formatAmount } from "../../lib/adapters";

const DATE = (iso) => (iso ? new Date(iso).toLocaleDateString() : "");
const COUNTER_LABEL = {
  luckyspin: "Lucky spin",
  dailybonus: "Daily bonus",
  weeklybonus: "Weekly bonus",
  monthlybonus: "Monthly bonus",
  depositbonus: "Deposit bonus",
  rollcompetitionbonus: "Roll competition",
  rakebackbonus: "Rakeback bonus",
};

function Block({ title, rows, empty }) {
  return (
    <div className="MiniList_root">
      <p className="MiniList_heading">{title}</p>
      {rows.length ? rows : <span className="MiniList_meta">{empty}</span>}
    </div>
  );
}

/**
 * Bonus centre on /vip-program (owner `bonus_centre`, on top of `bonus`): the player's codes
 * (`GET /user/bonus/codes`), claimed bonuses (`/history`), bonus-game balances (`/games`) and events (`/events`).
 */
export default function BonusCentre() {
  const { data: codes } = useApi("bonus:codes", () => redeemApi.mine({ limit: 10 }));
  const { data: history } = useApi("bonus:history", () => centreApi.history({ limit: 10 }));
  const { data: games } = useApi("bonus:games", () => centreApi.games());
  const { data: events } = useApi("bonus:events", () => centreApi.events({ limit: 10 }));
  const counters = Object.entries(games?.counters ?? {}).filter(([, v]) => Number(v) > 0);
  const list = (v) => (Array.isArray(v) ? v : []);

  return (
    <div className="VipOverviewSectionWrapper_root">
      <div className="VipRewardsCarousel_headingWrapper">
        <img src="/icons/rewards.svg" height="24" width="24" alt="" className="VipRewardsCarousel_headingIcon" />
        <span className="VipSectionTitle_root">Bonus Centre</span>
      </div>
      <div className="MiniList_grid">
        <Block
          title="My codes"
          empty="No codes yet."
          rows={list(codes).map((c) => (
            <div key={c.id} className="MiniList_row">
              <span>{c.code}</span>
              <span className="MiniList_meta">{c.kind === "percentage" ? `${formatAmount(c.bonusPct)}%` : formatAmount(c.amount)} · {c.status}</span>
            </div>
          ))}
        />
        <Block
          title="Bonus history"
          empty="No bonuses claimed yet."
          rows={list(history).map((h) => (
            <div key={h.id} className="MiniList_row">
              <span>{h.type} · ${formatAmount(h.amount)}</span>
              <span className="MiniList_meta">{h.claimed ? DATE(h.claimedAt) : "Unclaimed"}</span>
            </div>
          ))}
        />
        <Block
          title="Bonus games"
          empty="No bonus game balances."
          rows={counters.map(([k, v]) => (
            <div key={k} className="MiniList_row">
              <span>{COUNTER_LABEL[k] || k}</span>
              <span className="MiniList_meta">{formatAmount(v)}</span>
            </div>
          ))}
        />
        <Block
          title="Events"
          empty="No bonus events."
          rows={list(events).map((e) => (
            <div key={e.id} className="MiniList_row">
              <span>{e.event} · {formatAmount(e.amount)}</span>
              <span className="MiniList_meta">{DATE(e.createdAt)}</span>
            </div>
          ))}
        />
      </div>
    </div>
  );
}
