import { useEffect, useState } from "react";
import { cx } from "../../lib/carousel";
import { navigate } from "../../lib/router";
import Modal from "../ui/Modal";

/**
 * "$100,000 Weekly Race" dialog — reference `RaceInfoModal`, opened from the
 * How it works button on the Weekly Race board and from the pinned race link in
 * the rail. The banner is a background image on the header wrapper, which bleeds
 * past the modal padding through negative margins, as the reference does.
 */

const PRIZE_ROUTE = "/promotions/100000-weekly-race";
const ENDS_AT = "2026-09-13T09:30:00Z";

function useCountdown(target) {
  const end = Date.parse(target);
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
  const parts = useCountdown(ENDS_AT);
  return (
    <Modal onClose={onClose} label="$100,000 Weekly Race">
      <div className="RaceInfoModal_root">
        <div className="RaceInfoModal_headerWrapper">
          <img alt="" height="80" src="/icons/race.svg" width="80" />
          <h2 className="RaceInfoModal_header">$100,000 Weekly Race</h2>
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
          Place bets to climb the ranks and make your way into the top 1000 positions to win your share of the prize pool! When the race ends,
          prizes will be instantly added to your VIP rewards in the equivalent BTC value!
        </p>
        <div className="RaceInfoModal_raceForm">
          <Field label="Your position" placeholder value="Wager to join the race!" />
          <div className="RaceInfoModal_inputWrapper">
            <Field icon="/icons/fiat/USD.svg" label="Total wagered" value="$0.00" />
            <Field icon="/icons/crypto/btc.svg" label="Current prize" value="$0.00" />
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
