import { cx } from "../../lib/carousel";
import { medals as medalsApi } from "../../lib/endpoints";
import { useApi } from "../../lib/useResource";

/**
 * Settings → Account → Medals — `GET /user/medals`. Cosmetic: a medal pays nothing.
 * Unlocked medals first; a locked one shows its rule and progress where the platform can measure it.
 */
export default function MedalStrip() {
  const { data, error } = useApi("settings:medals", () => medalsApi.mine());
  if (error || !data?.medals?.length) return null;
  const list = [...data.medals].sort((a, b) => Number(b.unlocked) - Number(a.unlocked));
  return (
    <div className="Panel_panelWrapper">
      <h2 className="Panel_panelHeading">Medals · {data.medalCount}/{data.total}</h2>
      <div className="MedalStrip_grid">
        {list.map((m) => (
          <div key={m.key} className={cx("MedalStrip_medal", m.unlocked && "MedalStrip_unlocked")} title={m.rule?.description || m.unavailableReason || ""}>
            <strong>{m.title}</strong>
            <span>
              {m.unlocked
                ? `Unlocked ${new Date(m.unlockedAt).toLocaleDateString()}`
                : m.progress
                  ? `${Number(m.progress.current).toLocaleString("en-US")} / ${Number(m.progress.target).toLocaleString("en-US")}`
                  : "Locked"}
            </span>
            {!m.unlocked && m.progress && (
              <div className="MiniList_bar"><span style={{ width: `${Math.min(100, (m.progress.current / m.progress.target) * 100)}%` }} /></div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
