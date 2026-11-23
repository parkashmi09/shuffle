import { useEffect, useState } from "react";

/** Days / Hours / Minutes / Seconds to `target` (ISO), ticking each second — the race dialog's `TournamentCounter`. */
export default function Countdown({ target }) {
  const end = target ? Date.parse(target) : 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.floor((end - now) / 1000));
  const parts = [
    [Math.floor(left / 86400), "Days"],
    [Math.floor((left % 86400) / 3600), "Hours"],
    [Math.floor((left % 3600) / 60), "Minutes"],
    [left % 60, "Seconds"],
  ];
  return (
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
  );
}
