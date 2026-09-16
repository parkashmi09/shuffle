import { useEffect, useRef, useState } from "react";
import { cx } from "../../lib/carousel";

/**
 * The two toolbar dropdowns, actually opening.
 *
 * ── WHY THE PANEL MARKUP IS OURS AND THE BUTTON'S IS THE REFERENCE'S ─────
 *
 * Both controls were captured as buttons and nothing else: `SelectButton_root`,
 * `SelectMultiple_select`, `Select_button` and their open-state classes are all
 * in the captured CSS, but no panel is — the reference renders it in a portal,
 * lazily, on a real pointer event, so the capture never saw one open and there
 * is no `SelectMultiple_dropdown` rule to copy.
 *
 * So the button keeps the reference's classes exactly, including
 * `SelectButton_open`, `SelectMultiple_labelTextOpen` and the `_up` chevron
 * flip, and the panel below is the smallest thing that behaves correctly, built
 * from the same tokens. When someone captures the real panel it replaces this
 * one without touching a call site.
 *
 * Before this, "All Providers" was a `<button>` with no handler and Sort was a
 * button that CYCLED to the next option on each click — so neither read as a
 * dropdown and the sort could only be reached by clicking through the list.
 */
function useDismiss(open, onClose) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointer = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    // Escape as well as a click away: a dropdown that can only be closed by
    // clicking elsewhere is a trap for anyone on a keyboard.
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return ref;
}

/**
 * The filter control — reference `SelectMultiple`.
 *
 * Single-select, because `GET /casino/games` takes one `provider`. `value` of
 * `""` is the unfiltered state and reads as the label ("All Providers").
 */
export function FilterSelect({ label, value, options, onChange, className }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const chosen = options.find((o) => o.value === value);

  return (
    <div className={cx("SelectMultiple_root", className)} ref={ref}>
      <button
        type="button"
        className={cx("SelectButton_root SelectMultiple_select", open && "SelectButton_open")}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="SelectMultiple_filterLabelWrapper">
          <span className={cx("SelectMultiple_labelText", open && "SelectMultiple_labelTextOpen")}>
            {chosen?.label || label}
          </span>
        </div>
        <img
          alt="arrow"
          className={cx("SelectMultiple_chevronIcon", open && "SelectMultiple_up")}
          src="/icons/chevron.svg"
        />
      </button>

      {open && (
        <ul className="SelectMenu_panel" role="listbox" aria-label={label}>
          {/* The unfiltered option first, so clearing a filter is one click
              and not a hunt for the top of the list. */}
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className={cx("SelectMenu_option", !value && "SelectMenu_optionActive")}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {label}
            </button>
          </li>
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={cx("SelectMenu_option", o.value === value && "SelectMenu_optionActive")}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
                {o.count != null && <span className="SelectMenu_optionCount">{o.count}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The sort control — reference `Select` inside `FormControlWrapper_root`.
 *
 * Keeps the reference's "Sort by:<value>" lockup, and the native `<select>`
 * stays in the tree as the accessible control: a screen reader gets a real
 * listbox, and the styled button is what everyone else sees.
 */
export function SortSelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const label = options.find(([v]) => v === value)?.[1];

  return (
    <div className="FormControlWrapper_root Select_formWrapper" ref={ref}>
      <label className="sr-only">
        Sort
        <select name="sort" value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        aria-label="sort"
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cx("Select_button GamesToolbar_select", open && "Select_openBtn")}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="Select_item">
          <div className="Flex_root Flex_sm2 Select_labelPrefixWrapper">
            Sort by:<span className="Select_labelValue">{label}</span>
          </div>
        </span>
        <img
          alt="Toggle dropdown menu"
          className={cx("Select_chevronIcon", open && "Select_up")}
          src="/icons/chevron.svg"
        />
      </button>

      {open && (
        <ul className="SelectMenu_panel SelectMenu_panelRight" role="listbox" aria-label="Sort by">
          {options.map(([v, l]) => (
            <li key={v}>
              <button
                type="button"
                role="option"
                aria-selected={v === value}
                className={cx("SelectMenu_option", v === value && "SelectMenu_optionActive")}
                onClick={() => {
                  onChange(v);
                  setOpen(false);
                }}
              >
                {l}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
