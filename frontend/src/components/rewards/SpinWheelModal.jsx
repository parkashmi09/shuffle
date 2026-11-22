import { useState } from "react";
import { spinWheel as spinApi } from "../../lib/endpoints";
import { useApi } from "../../lib/useResource";
import { formatAmount } from "../../lib/adapters";
import { alertFromError, alertInfo, alertSuccess } from "../../lib/alerts";
import Modal from "../ui/Modal";

/** Slice colours when the admin left one blank: the site's own accent and panel tones. */
const FALLBACK = ["var(--accent)", "var(--color-gray700)"];
const SPIN_MS = 4000;

/**
 * The spin wheel — opened from the account menu (owner `spin_wheel`).
 *
 * `GET /user/spin-wheel/slices` is the wheel, `GET .../eligibility` whether a spin is free now (and the unused
 * code already won), `POST .../spin` the draw and `GET .../claims` the caller's past spins. A win is a deposit
 * bonus percentage applied to the next deposit; nothing is paid here.
 */
export default function SpinWheelModal({ onClose }) {
  const { data: wheel, loading, error } = useApi("spin:slices", () => spinApi.slices());
  const { data: state, reload: reloadState } = useApi("spin:eligibility", () => spinApi.eligibility());
  const { data: claims, reload: reloadClaims } = useApi("spin:claims", () => spinApi.claims({ limit: 10 }));
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const slices = wheel?.slices ?? [];
  const seg = slices.length ? 360 / slices.length : 360;
  const gradient = slices
    .map((s, i) => `${s.color || FALLBACK[i % 2]} ${i * seg}deg ${(i + 1) * seg}deg`)
    .join(", ");

  const spin = async () => {
    setSpinning(true);
    try {
      const r = await spinApi.spin();
      // Land the won slice's centre under the pointer at the top, after five full turns.
      const centre = (r.winIndex + 0.5) * seg;
      setAngle((a) => a - (a % 360) + 360 * 5 + (360 - centre));
      setTimeout(() => {
        setSpinning(false);
        if (r.isBadLuck) alertInfo("No luck this time.");
        else alertSuccess(`You won ${formatAmount(r.rewardPct)}% on your next deposit.`);
        reloadState();
        reloadClaims();
      }, SPIN_MS);
    } catch (e) {
      setSpinning(false);
      alertFromError(e, "The wheel could not spin.");
      reloadState();
    }
  };

  const bonus = state?.activeBonus;
  const list = Array.isArray(claims) ? claims : [];

  return (
    <Modal onClose={onClose} labelledBy="spin-title">
      <div className="RaceInfoModal_root">
        <div className="RaceInfoModal_headerWrapper RewardModal_plainHeader">
          <h2 className="RaceInfoModal_header" id="spin-title">Spin Wheel</h2>
          {slices.length > 0 && (
            <div className="SpinWheel_frame">
              <span className="SpinWheel_pointer" aria-hidden="true" />
              <div
                className="SpinWheel_wheel"
                style={{ background: `conic-gradient(${gradient})`, transform: `rotate(${angle}deg)`, transitionDuration: `${SPIN_MS}ms` }}
              >
                {slices.map((s, i) => (
                  <span key={s.id} className="SpinWheel_label" style={{ transform: `rotate(${(i + 0.5) * seg}deg)` }}>
                    <span>{s.label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {loading && <p className="RaceInfoModal_text">Loading…</p>}
        {((error && !wheel) || wheel?.disabled) && <p className="RaceInfoModal_text">The spin wheel is not available right now.</p>}

        {slices.length > 0 && (
          <>
            <p className="RaceInfoModal_text">
              {state?.eligible
                ? "Your spin is ready."
                : state?.code === "COOLDOWN_ACTIVE" && state.nextEligibleAt
                  ? `Next spin from ${new Date(state.nextEligibleAt).toLocaleString()}.`
                  : state?.reason || ""}
              {wheel.maxBonus ? ` A win adds a percentage to your next deposit, up to ${wheel.maxBonus} ${wheel.currency}.` : ""}
            </p>
            <div className="RaceInfoModal_raceForm">
              {bonus && (
                <div className="MiniList_root">
                  <div className="MiniList_row">
                    <span>Waiting for your next deposit</span>
                    <span>{bonus.pct}% up to {bonus.maxBonus} {bonus.currency}</span>
                  </div>
                </div>
              )}
              <button
                type="button"
                className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary RaceInfoModal_cta"
                disabled={spinning || !state?.eligible}
                onClick={spin}
              >
                <span className="ButtonVariants_buttonContent">{spinning ? "Spinning…" : "Spin"}</span>
              </button>
              {list.length > 0 && (
                <div className="MiniList_root">
                  <p className="MiniList_heading">Your spins</p>
                  {list.map((c) => (
                    <div key={c.id} className="MiniList_row">
                      <span>{c.sliceLabel}</span>
                      <span className="MiniList_meta">{c.claimedAt ? new Date(c.claimedAt).toLocaleDateString() : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
