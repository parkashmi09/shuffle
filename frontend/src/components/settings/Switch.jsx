import { cx } from "../../lib/carousel";

/**
 * A toggle — reference `Switch`.
 *
 * A real checkbox with `role="switch"` behind a painted track and knob, which
 * is what the reference ships: the input keeps the keyboard and the label
 * association, and `Switch_checked` on the sibling does the colour. The label
 * is optional because the preference rows put their heading and description in
 * a `SwitchGroup_switchLabelDesc` beside the control instead.
 */
export default function Switch({ checked, onChange, label, disabled = false, className }) {
  return (
    <label className={cx("Switch_switchWrapper", label && "Switch_labelFloat", className)}>
      <input
        type="checkbox"
        role="switch"
        className="Switch_hiddenCheckbox"
        aria-checked={checked}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <div className={cx("Switch_switchElement", checked && "Switch_checked")} aria-hidden="true">
        <span className="Switch_knob" />
      </div>
      {label && <p className="Switch_label">{label}</p>}
    </label>
  );
}
