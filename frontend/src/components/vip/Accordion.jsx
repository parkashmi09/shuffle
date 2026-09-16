import { useLayoutEffect, useRef, useState } from "react";
import { cx } from "../../lib/carousel";

/**
 * The reference's `Accordion`, as a component.
 *
 * `shuffle-static.css` already carried the `Accordion_*` rules — they came in
 * with the VIP page's captured HTML, which an effect in `StaticPage.jsx` used
 * to drive by hand: find the button, flip `aria-expanded`, toggle three
 * classes on three different descendants. That worked, but it meant the FAQ
 * could not be reused anywhere React actually renders. This is the same
 * markup and the same class toggles, owned by React instead.
 *
 * ── THE HEIGHT ANIMATION ─────────────────────────────────────────────────
 *
 * `.Accordion_contentHeight` is `overflow: hidden` and nothing else: the
 * reference animates its inline `height` (`0.2s height ease-out`) around an
 * inner wrapper div, which is why the captured markup has a bare `<div>`
 * between it and `.Accordion_content`. That div is not decoration — it keeps
 * its natural height while the parent's is being animated, so there is
 * something to measure.
 *
 * A height transition cannot start from `auto`, so collapsing has to pin a
 * pixel height first, force the browser to adopt it, and only then go to zero.
 * That is what the `offsetHeight` read is for, and it is why the height is
 * written to the node directly rather than kept in state: **the collapse must
 * not depend on a frame ever arriving.** An earlier version scheduled the
 * second step in `requestAnimationFrame`, and a panel closed in a hidden or
 * throttled tab stayed open forever, because rAF does not run there. Writing
 * both values in one synchronous pass makes the end state correct whether or
 * not the transition between them is ever painted.
 *
 * Opening is the safe direction — it goes from a real `0px` — and only the
 * release to `auto` is deferred, so a panel keeps fitting content that reflows
 * while it is open. A late timer there costs nothing: the panel is already at
 * its full height by then.
 *
 * The reference renders one more `.Accordion_content` before this, holding a
 * spinner for its `loading` prop. It is omitted — nothing here loads an
 * accordion's body separately from the page — and it costs nothing: the class
 * is `display: none` until `Accordion_openContent` lands on it.
 *
 * `open`/`onOpenChange` make it controlled; left off, it keeps its own state.
 */
export default function Accordion({
  header,
  children,
  initialOpen = false,
  disabled = false,
  open,
  onOpenChange,
  showLock = false,
  isLocked = false,
  classNameContent,
  classNameHeaderLeft,
}) {
  const [ownOpen, setOwnOpen] = useState(initialOpen);
  const isOpen = open ?? ownOpen;

  const boxRef = useRef(null);
  const innerRef = useRef(null);
  /*
   * The height the panel had while open.
   *
   * Collapsing cannot measure: `isOpen` false puts `display: none` on
   * `.Accordion_content` in the same commit, so by the time this effect runs
   * the content is already 0 tall. The figure to animate down from has to have
   * been taken while the panel was still open.
   */
  const openHeight = useRef(0);
  /* A panel that starts open must appear open, not animate in. */
  const settled = useRef(false);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return undefined;

    if (isOpen) openHeight.current = inner.scrollHeight;

    if (!settled.current) {
      settled.current = true;
      box.style.height = isOpen ? "auto" : "0px";
      return undefined;
    }

    if (!isOpen) {
      box.style.height = `${openHeight.current}px`;
      void box.offsetHeight; // adopt that height before replacing it
      box.style.height = "0px";
      return undefined;
    }

    box.style.height = `${openHeight.current}px`;
    const release = () => {
      openHeight.current = inner.scrollHeight;
      box.style.height = "auto";
    };
    box.addEventListener("transitionend", release, { once: true });
    /* Fallback for the frame that never comes — a background tab, or a
       browser that honours `prefers-reduced-motion` and skips the event. */
    const timer = setTimeout(release, 250);
    return () => {
      box.removeEventListener("transitionend", release);
      clearTimeout(timer);
    };
  }, [isOpen]);

  const toggle = () => {
    if (disabled) return;
    const next = !isOpen;
    if (onOpenChange) onOpenChange(next);
    else setOwnOpen(next);
  };

  return (
    <div className="Accordion_root">
      <div>
        <button
          type="button"
          className="Accordion_accordionHeader"
          onClick={toggle}
          disabled={disabled}
          aria-expanded={isOpen ? "true" : "false"}
        >
          <div className={cx("Accordion_accordionHeaderLeft", classNameHeaderLeft, isOpen && "Accordion_headingOpen")}>
            {header}
          </div>
          {showLock && (
            <img
              className={isLocked ? "Accordion_locked" : "Accordion_unlocked"}
              src={`/icons/${isLocked ? "lock" : "unlock"}.svg`}
              alt={isLocked ? "lock" : "unlock"}
            />
          )}
          <div className={cx("Accordion_chevronWrapper", isOpen && "Accordion_open")}>
            <img src="/icons/chevron.svg" alt="arrow" />
          </div>
        </button>
      </div>
      <div ref={boxRef} className="Accordion_contentHeight" style={{ transition: "0.2s height ease-out", height: 0 }}>
        <div ref={innerRef}>
          <div className={cx("Accordion_content", classNameContent, isOpen && "Accordion_openContent")}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
