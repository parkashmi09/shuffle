import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "../../lib/carousel";
import { CoinIcon } from "../ui/CoinIcon";

/**
 * The currency and network pickers at the top of every wallet form — reference
 * `CurrencySelect` inside `CurrencyNetworkSelectOptionsWrapper`.
 *
 * The reference renders a real `<select>` for assistive tech and a styled
 * button beside it, which is the same pair the rest of this clone already uses
 * for `Select_*` (see the activity board's row-limit picker). Kept identical.
 *
 * The row shows the coin's name on the left and its balance on the right, in
 * the display fiat — `Ethereum (ETH)` … `₹0.00` on the live modal.
 */

/**
 * Re-exported so the wallet keeps importing `CoinIcon` from here.
 *
 * The implementation moved to `components/ui/CoinIcon.jsx` because there were
 * two of them and they disagreed about where fiat marks live — see the note
 * in that file.
 */
export { CoinIcon };

/**
 * A styled dropdown over a native `<select>`.
 *
 * @param {string} label       Field label — the reference marks required ones with `*`.
 * @param {Array}  options     `[{ value, label, right?, icon?, iconSrc? }]`.
 * @param {string} value
 * @param {Function} onChange
 * @param {"currency"|"plain"} [variant]  `plain` is the vault modal's direction
 *   picker: one mark from `iconSrc` and the label, with no balance column. The
 *   live vault renders exactly that inside the same `Select_*` chrome.
 * @param {string} [buttonClass]  The trigger's classes. Defaults to the
 *   `Select_button` chrome; the notification rail's filter passes
 *   `ButtonVariants_*` instead, which is what the reference does there.
 * @param {import("react").ReactNode} [trigger]  Replaces the label-and-chevron
 *   contents entirely — for a trigger that is only an icon.
 * @param {number} [menuMinWidth]  Portalled list width floor (px). Icon triggers
 *   are narrower than their labels — the notification filter uses this.
 */
export default function WalletSelect({
  label,
  options,
  value,
  onChange,
  disabled = false,
  variant = "currency",
  buttonClass = "Select_button",
  trigger,
  placeholder,
  menuMinWidth,
  portalClassName,
}) {
  const plain = variant === "plain";
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const btn = useRef(null);
  const [rect, setRect] = useState(null);
  // A select that has not been answered yet shows its placeholder, not the
  // first option — the reference's `Select_placeholder`. Without a placeholder
  // the first option stands in, which is what every currency picker wants.
  const match = options.find((o) => o.value === value);
  const selected = match || (placeholder ? null : options[0]);

  /**
   * The popup is rendered into `document.body`, not inline.
   *
   * `ModalContent_modalContent` is `overflow: auto`, so a panel that opens
   * inside it lengthens the scrollable area and the modal grows a scrollbar —
   * which the live modal never does. It avoids that by rendering its listbox in
   * a portal (`ListBox_root`, outside the modal element entirely), so the same
   * is done here and the position is measured from the button.
   */
  const place = useCallback(() => {
    const b = btn.current?.getBoundingClientRect();
    if (!b) return;
    const min = Number(menuMinWidth) > 0 ? Number(menuMinWidth) : 0;
    const width = min ? Math.max(b.width, min) : b.width;
    const left = width > b.width ? b.right - width : b.left;
    setRect({ top: b.bottom + 4, left, width });
  }, [menuMinWidth]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      // The panel is outside `root` now, so it needs its own hit test.
      if (root.current?.contains(e.target) || e.target.closest?.(".WalletSelect_portal")) return;
      setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="FormControlWrapper_root Select_formWrapper" ref={root}>
      {/* A label-less select (the fiat picker beside Buy Crypto's amount) must
          render no label block at all — an empty one still takes its 18px and
          pushes the control below the field it is meant to sit level with.
          `BuyCrypto_options` already supplies the 22px that aligns them. */}
      {/* A select with its own `trigger` is an icon button — the field label
          would be visible text beside it, which the reference does not render.
          The hidden native control below still carries the name. */}
      {label && !trigger && (
        <div className="LabelBlock_root">
          <label className="Label_root" htmlFor={`wallet-${label}`}>
            {label}
          </label>
        </div>
      )}

      {/* The native control, visually hidden — the reference keeps one so the
          field is reachable by keyboard and screen reader. */}
      <div aria-hidden="true" style={{ border: 0, clip: "rect(0 0 0 0)", height: 1, margin: -1, overflow: "hidden", padding: 0, position: "fixed", width: 1, whiteSpace: "nowrap", top: 0, left: 0 }}>
        <label>
          {label}
          <select id={`wallet-${label}`} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        ref={btn}
        type="button"
        className={buttonClass}
        aria-label={label || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
        {/*
          The live modal's nesting, exactly:

              Select_item
                Select_selectOptionIcon > img
                Select_text
                  CurrencySelect_wrapper        ← the space-between row
                    span                        ← the name
                    CurrencySelect_currencySelectBalance

          The balance is a direct child of that last element, not `> div > span`
          inside it. That matters: the reference's two descendant rules paint a
          `> div > span` grey, and because the real balance is not nested that
          deeply neither rule fires and it inherits white — which is what the
          live modal shows. Wrapping it in a `div` (as a first pass did) turns it
          grey and drops it off centre.
        */}
        {!trigger && !selected && (
          <span className="Select_item Select_placeholder">{placeholder}</span>
        )}
        {!trigger && selected && (
        <span className="Select_item">
          {plain ? (
            <>
              {selected?.iconSrc && (
                <span className="Select_selectOptionIcon">
                  <img alt="" height="16" width="16" src={selected.iconSrc} />
                </span>
              )}
              <span className="Select_text">{selected?.label}</span>
            </>
          ) : (
            <>
              {selected?.icon && (
                <span className="Select_selectOptionIcon">
                  <CoinIcon code={selected.icon} />
                </span>
              )}
              <span className="Select_text">
                <div className="CurrencySelect_wrapper">
                  <span>{selected?.label}</span>
                  {selected?.right && (
                    <span className="CurrencySelect_currencySelectBalance">{selected.right}</span>
                  )}
                </div>
              </span>
            </>
          )}
        </span>
        )}
        {!trigger && (
          <img alt="Toggle dropdown menu" className={cx("Select_chevronIcon", open && "Select_up")} src="/icons/chevron.svg" />
        )}
      </button>

      {open && rect && createPortal(
        <ul
          className={cx("ActivityBoard_selectPopup WalletSelect_portal", portalClassName)}
          role="listbox"
          style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width, margin: 0 }}
        >
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={cx("ActivityBoard_selectOption", o.value === value && "ActivityBoard_selectOptionSelected")}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {plain ? (
                  <>
                    {o.iconSrc && (
                      <span className="Select_selectOptionIcon">
                        <img alt="" height="16" width="16" src={o.iconSrc} />
                      </span>
                    )}
                    <span className="Select_text">{o.label}</span>
                  </>
                ) : (
                  <span className="CurrencySelect_wrapper">
                    <span className="IconValue_root">
                      {o.icon && <CoinIcon code={o.icon} />}
                      <span>{o.label}</span>
                    </span>
                    {o.right && <span className="CurrencySelect_currencySelectBalance">{o.right}</span>}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
}
