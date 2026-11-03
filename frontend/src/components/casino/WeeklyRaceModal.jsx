import { useEffect, useState } from "react";
import { cx } from "../../lib/carousel";
import { navigate } from "../../lib/router";
import { race as raceApi } from "../../lib/endpoints";
import { useApi } from "../../lib/useResource";
import { formatAmount } from "../../lib/adapters";
import { currencyIcon } from "../../lib/currencies";
import Modal from "../ui/Modal";

/**
 * "$100,000 Weekly Race" dialog — reference `RaceInfoModal`, opened from the
 * How it works button on the Weekly Race board and from the pinned race link in
 * the rail. The banner is a background image on the header wrapper, which bleeds
 * past the modal padding through negative margins, as the reference does.
 *
 * The pool, the end time and the caller's own line (`me`, null signed out or
 * before a first bet) are the current weekly race, `GET /user/race/weekly/leaderboard`.
 */

const PRIZE_ROUTE = "/promotions/100000-weekly-race";
function useCountdown(target) {
  const end = target ? Date.parse(target) : 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.floor((end - now) / 1000));
  return [
    [Math.floor(left / 86400), "Days"],
    [Math.floor((left % 86400) / 3600), "Hours"],
    [Math.floor((left % 3600) / 60), "Minutes"],
    [left % 60, "Seconds"],
  ];
}

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

export default function WeeklyRaceModal({ onClose }) {
  const { data: board } = useApi("race:weekly", () => raceApi.leaderboard("weekly"));
  const parts = useCountdown(board?.endsAt);
  const coin = board?.payoutCurrency || "USDT";
  const title = board ? `${formatAmount(board.payoutNetPrizePool)} ${coin} Weekly Race` : "Weekly Race";
  const me = board?.me;
  return (
    <Modal onClose={onClose} label={title}>
      <div className="RaceInfoModal_root">
        <div className="RaceInfoModal_headerWrapper">
          <img alt="" height="80" src="/icons/race.svg" width="80" />
          <h2 className="RaceInfoModal_header">{title}</h2>
          <div className="RaceInfoModal_countDown">
            <div className="TournamentCounter_countDown">
              {parts.map(([value, label]) => (
                <div key={label} className="TournamentCounter_countDownItem">
                  <span>{value}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
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
          <button
            className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary RaceInfoModal_cta"
            type="button"
            onClick={() => { onClose(); navigate(PRIZE_ROUTE); }}
          >
            <span className="ButtonVariants_buttonContent">Learn More</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
