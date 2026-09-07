import { useEffect, useState } from "react";
import { cx } from "../../lib/carousel";
import { navigate } from "../../lib/router";

/**
 * "$100,000 Weekly Race" dialog — opened from the How it works button on the
 * Weekly Race board and from the pinned race link in the rail. The reference
 * only renders it for a signed-in player, so the layout here follows the
 * dialog as it appears in the product: banner, countdown, the player's
 * position and totals, and a link through to the promotion.
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

export default function WeeklyRaceModal({ onClose }) {
  const [entered, setEntered] = useState(false);
  const parts = useCountdown(ENDS_AT);
  useEffect(() => {
    // A timer rather than an animation frame: background tabs throttle rAF and the
    // dialog would stay in its pre-enter (scaled down) state.
    const id = setTimeout(() => setEntered(true), 16);
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return (
    <div className={cx("ModalContent_root defaultTheme", entered ? "ModalContent_show" : "ModalContent_hide")} role="dialog" aria-modal="true" aria-label="$100,000 Weekly Race">
      <div className={cx("ModalContent_overlay", entered && "ModalContent_overlayShow ModalContent_showBgCover")} onClick={onClose} />
      <div>
        <div className={cx("ModalContent_modalBody ModalContent_hideModalBody WeeklyRaceModal_body", entered && "ModalContent_showModalBody ModalContent_animationCompleted")}>
          <button aria-label="close" className="WeeklyRaceModal_close" type="button" onClick={onClose}>
            <img alt="close" height="16" src="/icons/times.svg" width="16" />
          </button>
          <div className="WeeklyRaceModal_banner">
            <img alt="$100,000 Weekly Race" className="WeeklyRaceModal_bannerImage" src="/images/modal-race-image.png" />
            <div className="WeeklyRaceModal_bannerInner">
              <h2 className="WeeklyRaceModal_title">$100,000 Weekly Race</h2>
              <div className="WeeklyRaceModal_countdown">
                {parts.map(([value, label]) => (
                  <div key={label} className="WeeklyRaceModal_countdownItem">
                    <span className="WeeklyRaceModal_countdownValue">{value}</span>
                    <span className="WeeklyRaceModal_countdownLabel">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="WeeklyRaceModal_content">
            <p className="WeeklyRaceModal_text">
              Place bets to climb the ranks and make your way into the top 1000 positions to win your share of the prize pool! When the race ends,
              prizes will be instantly added to your VIP rewards in the equivalent BTC value!
            </p>
            <div className="WeeklyRaceModal_field">
              <span className="WeeklyRaceModal_label">Your position</span>
              <div className="WeeklyRaceModal_value WeeklyRaceModal_placeholder">Wager to join the race!</div>
            </div>
            <div className="WeeklyRaceModal_row">
              <div className="WeeklyRaceModal_field">
                <span className="WeeklyRaceModal_label">Total wagered</span>
                <div className="WeeklyRaceModal_value">
                  <img alt="USD" height="20" src="/icons/fiat/USD.svg" width="20" />
                  <span>$0.00</span>
                </div>
              </div>
              <div className="WeeklyRaceModal_field">
                <span className="WeeklyRaceModal_label">Current prize</span>
                <div className="WeeklyRaceModal_value">
                  <img alt="BTC" height="20" src="/icons/crypto/btc.svg" width="20" />
                  <span>$0.00</span>
                </div>
              </div>
            </div>
            <button
              className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary WeeklyRaceModal_cta"
              type="button"
              onClick={() => { onClose(); navigate(PRIZE_ROUTE); }}
            >
              <span className="ButtonVariants_buttonContent">Learn More</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
