import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "../../lib/carousel";
import { useMobileSheet } from "../../lib/useMobileSheet";

/**
 * Every dialog on the site — reference `ModalContent` above 768px and
 * `MobileSheet` below it.
 *
 * ── TWO CHROMES, ONE CONTENT ─────────────────────────────────────────────
 *
 * The reference does not shrink its centred modal down to phone width. Below
 * 768px it swaps the whole shell for a bottom sheet: pinned to the bottom edge,
 * full width, dragged up by a handle rather than dismissed by a close button,
 * and animated in with Vaul's `slideFromBottom` over 0.5s. Measured on the live
 * site, which opens a sheet at 767px and a centred modal at 768px.
 *
 * Only the chrome changes — `children` is the same in both. That is why the
 * close button lives here and not in the nine dialogs that use this: the sheet
 * has no close button at all, so a dialog that rendered its own would put one
 * over the handle on every phone.
 *
 * ── CLOSING IS DEFERRED ──────────────────────────────────────────────────
 *
 * A sheet that unmounts the moment it is dismissed never plays `slideToBottom`,
 * so the affordances here (handle, overlay, close button, Escape) flip
 * `data-state` to "closed" and only call `onClose` once the animation has run.
 * Content that closes itself — the logout dialog after it logs out — still
 * calls `onClose` directly and unmounts at once, which is what the reference
 * does when the action itself navigates away.
 *
 * @param {Function} onClose
 * @param {string} [label]        `aria-label` for the dialog.
 * @param {string} [labelledBy]   `aria-labelledby`, for a dialog whose heading
 *   is part of `children`. Takes precedence over `label`.
 * @param {string} [bodyClass]    Extra class on the desktop modal body — the
 *   width modifiers (`GlobalModal_walletModalBody` and friends).
 * @param {string} [contentClass] Extra class on the scrolling content element,
 *   in both chromes.
 * @param {string} [sheetClass]   Extra class on the sheet, for the handful of
 *   `MobileSheet_*` modifiers (`MobileSheet_hideDismiss`, the dark overlay).
 * @param {boolean} [darkOverlay] The blurred, darker scrim the signed-out
 *   dialogs use — `ModalContent_overlayUnauth` / `MobileSheet_darkOverlayBackground`.
 */

/** Vaul's animation duration, and the reference's — keep in step with the CSS. */
const ANIMATION_MS = 500;

/* ── Drag-to-dismiss ──────────────────────────────────────────────────────
   Vaul's own thresholds: let go past a quarter of the sheet's height, or flick
   downwards faster than 0.4px/ms, and it goes; anything less springs back.
   ------------------------------------------------------------------------ */

/** Travel before a press becomes a drag, so a tap on a field is still a tap. */
const ENGAGE_PX = 6;
/** Fraction of the sheet's height that dismisses on release. */
const DISMISS_RATIO = 0.25;
/** px/ms downwards that dismisses however short the drag was. */
const DISMISS_VELOCITY = 0.4;
/** Upwards drag is resisted rather than followed — the sheet has nowhere to go. */
const OVERDRAG_DAMPING = 4;

export default function Modal({
  onClose,
  label,
  labelledBy,
  bodyClass,
  contentClass,
  sheetClass,
  darkOverlay = false,
  children,
}) {
  const isSheet = useMobileSheet();
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const timer = useRef(null);
  const sheetRef = useRef(null);
  const overlayRef = useRef(null);
  const scrollRef = useRef(null);
  const drag = useRef(null);

  /**
   * Send the sheet the rest of the way down from wherever the drag left it.
   *
   * The CSS exit (`slideToBottom`) always starts from 0, so releasing at 200px
   * would snap back up before animating away. Driving the same 0.5s transition
   * that `[data-vaul-drawer]` already carries continues the gesture instead;
   * the inline `animation: none` set when the drag began keeps the keyframes
   * out of it. The overlay still fades through `data-state="closed"`, whose
   * `fadeOut` has no `from`, so it picks up the opacity the drag left behind.
   */
  const settleClosed = useCallback(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.style.transition = "";
    sheet.style.transform = "translate3d(0, 100%, 0)";
  }, []);

  const requestClose = useCallback(
    (fromDrag = false) => {
      if (timer.current) return;
      setClosing(true);
      if (fromDrag) settleClosed();
      timer.current = setTimeout(onClose, ANIMATION_MS);
    },
    [onClose, settleClosed],
  );

  /**
   * Land the enter transition one frame after mount.
   *
   * ── THIS EFFECT MUST NOT DEPEND ON ANYTHING ──────────────────────────────
   *
   * `requestClose` is rebuilt whenever `onClose` changes, and every caller
   * passes an inline arrow — so a single parent re-render would tear this down,
   * clear the timer and reschedule it. While the session is settling that
   * happens repeatedly, the 16ms never elapses, `entered` stays false and the
   * dialog sits at `hide`'s `scale(.95)`/`opacity: .9` forever: 5% small with
   * no transition, which reads exactly like a broken animation.
   *
   * The Escape listener is a separate effect below for that reason.
   */
  useEffect(() => {
    // A timer rather than an animation frame: a background tab throttles rAF
    // and the dialog would stay in its pre-enter state.
    const raise = setTimeout(() => setEntered(true), 16);
    return () => {
      clearTimeout(raise);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && requestClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

  /**
   * Drag the sheet down to dismiss it.
   *
   * Starting on the handle always drags. Starting anywhere else drags only
   * while the content is scrolled to the top and the finger is going down —
   * otherwise the gesture belongs to the scroller, and the browser takes it
   * over and sends us a `pointercancel`.
   */
  const onPointerDown = (event) => {
    if (closing || event.button > 0) return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    drag.current = {
      id: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastT: event.timeStamp,
      offset: 0,
      velocity: 0,
      height: sheet.getBoundingClientRect().height,
      onHandle: !!event.target.closest?.("[data-vaul-handle]"),
      engaged: false,
    };
  };

  const onPointerMove = (event) => {
    const d = drag.current;
    if (!d || event.pointerId !== d.id) return;

    const delta = event.clientY - d.startY;
    if (!d.engaged) {
      if (Math.abs(delta) < ENGAGE_PX) return;
      // An upward flick, or a scrolled list, is not ours to take.
      if (!d.onHandle && (delta < 0 || (scrollRef.current?.scrollTop ?? 0) > 0)) {
        drag.current = null;
        return;
      }
      d.engaged = true;
      sheetRef.current.style.animation = "none";
      sheetRef.current.style.transition = "none";
      // Throws if the pointer has already been released (Safari, and any
      // synthetic event) — capture is an optimisation, not a requirement.
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        /* keep dragging without it */
      }
    }

    const dt = event.timeStamp - d.lastT;
    if (dt > 0) d.velocity = (event.clientY - d.lastY) / dt;
    d.lastY = event.clientY;
    d.lastT = event.timeStamp;

    d.offset = delta > 0 ? delta : delta / OVERDRAG_DAMPING;
    sheetRef.current.style.transform = `translate3d(0, ${d.offset}px, 0)`;
    if (overlayRef.current) {
      overlayRef.current.style.opacity = String(Math.max(0, 1 - Math.max(d.offset, 0) / d.height));
    }
  };

  const endDrag = (event) => {
    const d = drag.current;
    if (!d || (event && event.pointerId !== d.id)) return;
    drag.current = null;

    // A press that never moved: on the handle that is the tap-to-close the
    // reference answers, anywhere else it belongs to whatever was pressed.
    if (!d.engaged) {
      if (d.onHandle && event?.type === "pointerup") requestClose();
      return;
    }

    const dismiss = d.offset > d.height * DISMISS_RATIO || (d.velocity > DISMISS_VELOCITY && d.offset > 0);
    if (dismiss) {
      requestClose(true);
      return;
    }

    // Spring back: dropping `transition: none` and the transform together lets
    // the drawer's own 0.5s curve carry it home.
    sheetRef.current.style.transition = "";
    sheetRef.current.style.transform = "";
    if (overlayRef.current) overlayRef.current.style.opacity = "";
  };

  // The reference marks the body while a sheet is up; its own rule undoes the
  // scroll lock the sheet library applies, so the page behind keeps its
  // scrollbar and does not jump.
  useEffect(() => {
    if (!isSheet) return undefined;
    document.body.classList.add("mobile-sheet-open");
    return () => document.body.classList.remove("mobile-sheet-open");
  }, [isSheet]);

  const labelProps = labelledBy ? { "aria-labelledby": labelledBy } : { "aria-label": label };

  if (isSheet) {
    const state = closing ? "closed" : "open";
    return (
      <>
        <div
          ref={overlayRef}
          className={cx("MobileSheet_overlay", darkOverlay && "MobileSheet_darkOverlayBackground")}
          data-state={state}
          data-vaul-overlay=""
          data-vaul-snap-points="false"
          data-vaul-animate="true"
          onClick={() => requestClose()}
        />
        <div
          ref={sheetRef}
          className={cx("MobileSheet_content defaultTheme", sheetClass)}
          role="dialog"
          aria-modal="true"
          {...labelProps}
          data-state={state}
          data-vaul-drawer=""
          data-vaul-drawer-direction="bottom"
          data-vaul-snap-points="false"
          data-vaul-animate="true"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* Drag it down to dismiss — see the gesture above. The handle is
              also a tap target, which is what the reference's does. */}
          <div className="MobileSheet_handler" data-vaul-handle="" data-vaul-drawer-visible="true">
            <span data-vaul-handle-hitarea="" />
          </div>
          <section ref={scrollRef} className={cx("MobileSheet_container", contentClass)}>
            {children}
          </section>
          <div />
        </div>
      </>
    );
  }

  const open = entered && !closing;

  return (
    <div
      className={cx("ModalContent_root defaultTheme", open ? "ModalContent_show" : "ModalContent_hide")}
      role="dialog"
      aria-modal="true"
      {...labelProps}
    >
      <div
        className={cx(
          "ModalContent_overlay",
          darkOverlay && "ModalContent_overlayUnauth",
          open && "ModalContent_overlayShow ModalContent_showBgCover",
        )}
        onClick={() => requestClose()}
      />
      <div>
        <div
          className={cx(
            "ModalContent_modalBody ModalContent_hideModalBody",
            bodyClass,
            open && "ModalContent_showModalBody ModalContent_animationCompleted",
          )}
        >
          <div className="ModalClose_modalHeader">
            <button type="button" aria-label="Close modal" className="ModalClose_closeButton" onClick={() => requestClose()}>
              <img alt="times" src="/icons/times.svg" />
            </button>
          </div>
          <div className={cx("ModalContent_modalContent", contentClass)}>{children}</div>
        </div>
      </div>
    </div>
  );
}
