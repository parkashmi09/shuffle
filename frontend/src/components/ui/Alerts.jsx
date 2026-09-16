import { useCallback, useEffect, useState } from "react";
import { cx } from "../../lib/carousel";

/**
 * The toast stack — reference `Alerts` → `AlertAction` → `Alert`.
 *
 * Mounted once by the shell. It listens for the `shuffle:alert` events
 * `lib/alerts.js` raises and renders one toast per message.
 *
 * ── HOW A TOAST ENDS ─────────────────────────────────────────────────────
 *
 * Not on a timer. The draining bar is a 5s CSS animation and the component
 * listens for its `animationend`, which is why `Alert_root:hover` pausing the
 * animation genuinely holds the toast open while the pointer is on it. The
 * dismissal then plays the exit animation and only removes the row on *its*
 * `animationend` — so nothing disappears mid-slide.
 *
 * The whole toast is a `<button>`: clicking anywhere on it dismisses.
 */

const COLOR = {
  success: "var(--color-success)",
  "error-fill": "var(--color-error)",
  warning: "var(--color-warning)",
  "info-fill": "var(--color-info)",
  notification: "var(--color-primaryViolet)",
};

function Alert({ item, onExited }) {
  const [exiting, setExiting] = useState(false);
  const dismiss = useCallback(() => setExiting(true), []);

  return (
    <div
      className={cx("AlertAction_root", exiting && "AlertAction_exiting")}
      onAnimationEnd={exiting ? onExited : undefined}
    >
      <button className="Alert_root" onClick={dismiss} aria-label="dismiss alert" type="button">
        <div
          className="Alert_leftContainer"
          aria-label={item.type}
          style={{ backgroundColor: COLOR[item.type] || COLOR["info-fill"] }}
        >
          <img alt={item.type} src={`/icons/${item.type}.svg`} />
        </div>
        <div className="Alert_rightContainer">
          <div>
            <span className="Alert_percentageBar Alert_startPercentageAnimation" onAnimationEnd={dismiss} />
            <p className="Alert_text">{item.message}</p>
          </div>
          <img src="/icons/white-cross.svg" alt="close" />
        </div>
      </button>
    </div>
  );
}

export default function Alerts() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const onAlert = (event) => {
      const { type, message } = event.detail || {};
      if (!message) return;
      setItems((current) => [
        // The reference drops an identical message rather than stacking two —
        // a form submitted twice should not leave two of the same toast.
        ...current.filter((item) => item.message !== message),
        { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type, message },
      ]);
    };
    window.addEventListener("shuffle:alert", onAlert);
    return () => window.removeEventListener("shuffle:alert", onAlert);
  }, []);

  const remove = useCallback((id) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="Alerts_root">
      {items.map((item) => (
        <Alert key={item.id} item={item} onExited={() => remove(item.id)} />
      ))}
    </div>
  );
}
