import { cx } from "../../lib/carousel";

/**
 * A rank's mark, optionally with its name — reference `VipBadge` + `VipIcon`.
 *
 * Both scss modules are in the capture and both are tiny: the badge is a flex
 * row with a `--spacing-sm4` gap, the icon a positioned wrapper the badge can
 * sit other things on top of. They are already compiled into
 * `shuffle-home.css` as `VipBadge_root` / `VipIcon_root`.
 *
 * `label` is optional because the reference omits it in the levels table,
 * where the rank's name is already the row's first column.
 */
export default function VipBadge({ icon, label, className }) {
  return (
    <span className={cx("VipBadge_root", className)}>
      <span className="VipIcon_root">
        <img alt="vip icon" width="16" height="16" src={icon} />
      </span>
      {label && <span>{label}</span>}
    </span>
  );
}
