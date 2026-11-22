import { useState } from "react";
import { cx } from "../../lib/carousel";
import { navigate } from "../../lib/router";
import { race as raceApi, site } from "../../lib/endpoints";
import { promotionHref } from "../../lib/promotions";
import { useGate } from "../../lib/gates";
import { useApi } from "../../lib/useResource";
import { formatAmount } from "../../lib/adapters";
import { currencyIcon } from "../../lib/currencies";
import { useSession } from "../../lib/sessionContext";
import { alertFromError, alertSuccess } from "../../lib/alerts";
import Modal from "../ui/Modal";
import Countdown from "../ui/Countdown";

/**
 * "$100,000 Weekly Race" dialog — reference `RaceInfoModal`, opened from the
 * How it works button on the Weekly Race board and from the pinned race link in
 * the rail. The banner is a background image on the header wrapper, which bleeds
 * past the modal padding through negative margins, as the reference does.
 *
 * The pool, the end time and the caller's own line (`me`, null signed out or
 * before a first bet) are the current weekly race, `GET /user/race/weekly/leaderboard`.
 * Daily / monthly tabs come from `GET /user/race` (enabled races only); a signed-in
 * player's prizes are `GET /user/race/rewards`, each paid by `POST .../:id/claim`.
 */

function Field({ label, icon, value, placeholder }) {
  return (
    <div className="RaceInfoModal_field">
      <span className="RaceInfoModal_label">{label}</span>
      <div className={cx("RaceInfoModal_value", placeholder && "RaceInfoModal_placeholder")}>
        {icon && <img alt="" className="RaceInfoModal_icon" src={icon} />}
        <span>{value}</span>
      </div>
    </div>
  );
}

/** The History tab: each settled race's pool, podium and the caller's own place. */
function RaceHistory({ races, loading, error }) {
  const list = Array.isArray(races) ? races : [];
  if (loading) return <p className="RaceInfoModal_text">Loading…</p>;
  if (error) return <p className="RaceInfoModal_text" role="alert">{error.message || "Could not load past races."}</p>;
  if (!list.length) return <p className="RaceInfoModal_text">No finished races yet.</p>;
  return (
    <div className="RaceInfoModal_raceForm">
      {list.map((r) => (
        <div key={r.raceId} className="MiniList_root">
          <div className="MiniList_row">
            <span className="MiniList_heading">{RACE_LABEL[r.type] || r.type} race</span>
            <span className="MiniList_meta">{r.endsAt ? new Date(r.endsAt).toLocaleDateString() : ""}</span>
          </div>
          <div className="MiniList_row">
            <span>Prize pool</span>
            <span>{formatAmount(r.prizePool)} {r.currency}</span>
          </div>
          {(r.winners || []).map((w) => (
            <div key={`${w.rank}-${w.name}`} className="MiniList_row">
              <span>#{w.rank} {w.name || "Hidden"}</span>
              <span className="MiniList_meta">{formatAmount(w.amount)} {w.currency}</span>
            </div>
          ))}
          {r.me && (
            <div className="MiniList_row">
              <span><strong>You · #{r.me.rank}</strong></span>
              <span>{formatAmount(r.me.amount)} {r.me.currency}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const RACE_LABEL = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

export default function WeeklyRaceModal({ onClose }) {
  const on = useGate();
  const { signedIn, refreshBalances } = useSession();
  const racesOn = on.ready && on("races");
  // Daily / monthly tabs only for the races the site runs (`GET /user/race`); weekly stays the default.
  const { data: configs } = useApi("race:configs", () => raceApi.configs(), { enabled: racesOn });
  const types = (Array.isArray(configs) ? configs : []).filter((c) => c.enabled).map((c) => c.type);
  const [picked, setPicked] = useState("weekly");
  const historyOn = picked === "history" && racesOn;
  const type = types.length && !types.includes(picked) ? types[0] : historyOn ? "weekly" : picked;
  const tabs = racesOn ? [...(types.length ? types : ["weekly"]), "history"] : types;
  // Settled races, newest first (`GET /user/race/history`); `me` is the caller's own place, signed in.
  const { data: past, loading: pastLoading, error: pastError } = useApi("race:history", () => raceApi.history({ limit: 10 }), { enabled: historyOn });
  const { data: board } = useApi(`race:${type}`, () => raceApi.leaderboard(type));
  const coin = board?.payoutCurrency || "USDT";
  const label = RACE_LABEL[type] || "Weekly";
  const title = board ? `${formatAmount(board.payoutNetPrizePool)} ${coin} ${label} Race` : `${label} Race`;
  const me = board?.me;
  // The player's settled prizes: a race pays into claimable rows, not the wallet.
  const { data: rewards, reload: reloadRewards } = useApi("race:rewards", () => raceApi.rewards({ limit: 10 }), { enabled: signedIn && racesOn });
  const prizes = Array.isArray(rewards) ? rewards : [];
  const [claiming, setClaiming] = useState(null);
  const claim = async (p) => {
    setClaiming(p.id);
    try {
      const paid = await raceApi.claim(p.id);
      alertSuccess(`${formatAmount(paid?.amount ?? p.amount)} ${paid?.currency || p.currency} added to your balance.`);
      refreshBalances?.();
    } catch (error) {
      alertFromError(error, "Could not claim the prize.");
    } finally {
      setClaiming(null);
      reloadRewards();
    }
  };
  // The admin's own race promotion; without one there is no article to learn more from.
  const { data: promos } = useApi("race:promotion", () => site.promotions({ page: 1, limit: 50 }), { enabled: on.ready && on("promotions") });
  const racePromo = (Array.isArray(promos?.data) ? promos.data : []).find((p) => p.slug && /race/i.test(`${p.slug} ${p.title}`));
  const learnMore = racePromo ? promotionHref(racePromo.segment, racePromo.slug) : null;
  return (
    <Modal onClose={onClose} label={title}>
      <div className="RaceInfoModal_root">
        <div className="RaceInfoModal_headerWrapper">
          <img alt="" height="80" src="/icons/race.svg" width="80" />
          <h2 className="RaceInfoModal_header">{title}</h2>
          {!historyOn && <Countdown target={board?.endsAt} />}
        </div>
        {tabs.length > 1 && (
          <div className="Tab_tabsContainer" role="tablist">
            {tabs.map((t) => {
              const current = t === "history" ? historyOn : !historyOn && type === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={current}
                  className={cx("Tab_tab", current && "Tab_active")}
                  disabled={current}
                  onClick={() => setPicked(t)}
                >
                  <p className="Tab_text">{t === "history" ? "History" : RACE_LABEL[t] || t}</p>
                </button>
              );
            })}
          </div>
        )}
        {historyOn && <RaceHistory races={past} loading={pastLoading} error={pastError} />}
        {!historyOn && <>
        <p className="RaceInfoModal_text">
          Place bets to climb the ranks and make your way into the top {board?.winnerCount ?? 1000} positions to win your share of the prize pool! When the race ends,
          prizes will be instantly added to your VIP rewards in the equivalent {coin} value!
        </p>
        <div className="RaceInfoModal_raceForm">
          <Field label="Your position" placeholder={!me} value={me ? `#${me.rank}` : "Wager to join the race!"} />
          <div className="RaceInfoModal_inputWrapper">
            <Field icon="/icons/fiat/USD.svg" label="Total wagered" value={`$${formatAmount(me?.usdWagered ?? 0)}`} />
            <Field icon={currencyIcon(coin)} label="Current prize" value={`${formatAmount(me?.payout ?? 0)} ${coin}`} />
          </div>
          {prizes.map((p) => (
            <div key={p.id} className="RaceInfoModal_inputWrapper">
              <Field
                icon={currencyIcon(p.currency)}
                label={`${RACE_LABEL[p.type] || ""} race · #${p.rank}`}
                value={`${formatAmount(p.amount)} ${p.currency}`}
              />
              <button
                type="button"
                className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary RaceInfoModal_cta"
                disabled={p.claimed || claiming != null}
                style={{ alignSelf: "end" }}
                onClick={() => claim(p)}
              >
                <span className="ButtonVariants_buttonContent">{p.claimed ? "Claimed" : claiming === p.id ? "Claiming…" : "Claim"}</span>
              </button>
            </div>
          ))}
          {learnMore && (
            <button
              className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary RaceInfoModal_cta"
              type="button"
              onClick={() => { onClose(); navigate(learnMore); }}
            >
              <span className="ButtonVariants_buttonContent">Learn More</span>
            </button>
          )}
        </div>
        </>}
      </div>
    </Modal>
  );
}
