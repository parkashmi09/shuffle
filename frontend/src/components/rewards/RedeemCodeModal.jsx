import { useEffect, useRef, useState } from "react";

import { navigate } from "../../lib/router";
import { redeem as redeemApi } from "../../lib/endpoints";
import { alertFromError, alertSuccess } from "../../lib/alerts";
import { displayBalance } from "../../lib/adapters";
import { useSession } from "../../lib/sessionContext";
import Modal from "../ui/Modal";

/**
 * The redeem-code dialog — reference `RedeemCodeLookupModal`, opened from the
 * signed-in account menu.
 *
 * Read off the live modal. It is the plain `ModalContent_modalBody` with no size
 * modifier at all (496px wide, 540px cap), the standard `ModalClose_modalHeader`
 * close button, and `ModalContent_modalContent`'s 40px inset around an icon, a
 * heading, a one-field form and a footer.
 *
 * The footer's rule runs the full width of the body, not the inset: it cancels
 * the 40px with a negative margin on three sides. An earlier pass gave this
 * modal a bespoke `RedeemCode_*` shell with its own fixed 463px height and a
 * boxed-in footer; both are gone, and the sizes below are the measured ones.
 *
 * ── WHAT SUBMIT DOES ─────────────────────────────────────────────────────
 *
 * `POST /user/bonus/redeem`. The reference gives no inline error: on either
 * outcome it closes the dialog and raises a toast — checked against the live
 * site with a bogus code, which answered "This bonus code is not found" in an
 * `Alert_root` and left no trace in the modal. This does the same, with the
 * platform's own message (`That redeem code is not valid`), and refreshes the
 * wallet on success because the credit lands in the balance behind the modal.
 */
export default function RedeemCodeModal({ onClose }) {
  const { refreshBalances } = useSession();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef(null);

  // `Modal` runs the enter transition and the Escape key; the field still has
  // to take focus once the dialog has painted.
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => inputRef.current?.focus());
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    const value = code.trim().toUpperCase();
    if (!value || pending) return;
    setPending(true);
    try {
      const result = await redeemApi.code(value);
      onClose();
      // `amount` comes back at full precision ("25.00000000"); `displayBalance`
      // trims it the way the header does.
      alertSuccess(`${displayBalance(result.amount, result.currency)} ${result.currency} added to your balance.`);
      refreshBalances?.();
    } catch (error) {
      onClose();
      alertFromError(error, "That redeem code could not be checked. Please try again.");
    }
  };

  const learnMore = (event) => {
    event.preventDefault();
    onClose();
    navigate("/vip-program");
  };

  return (
    <Modal onClose={onClose} labelledBy="redeem-code-title">
      <div className="IconContainer_root">
        <img alt="" src="/icons/redeem.svg" />
      </div>
      <h3 className="Header_root" id="redeem-code-title">Redeem Code</h3>

      <div className="RedeemCodeLookupModal_promoRedeemModalBody">
        <form className="RedeemCodeForm_root" onSubmit={submit}>
          <div className="TextInput_formControlWrapper">
            <div className="InputWrapper_root">
              <input
                ref={inputRef}
                className="Input_root"
                aria-label="Bonus code"
                autoComplete="off"
                placeholder="Enter bonus code"
                value={code}
                disabled={pending}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary RedeemCodeForm_button"
            disabled={!code.trim() || pending}
          >
            <span className="ButtonVariants_buttonContent">Redeem</span>
          </button>
        </form>
      </div>

      <div className="RedeemCodeLookupModal_redeemCodeLookupFooter">
        <a href="/vip-program" onClick={learnMore}>Learn more about the Shuffle VIP program</a>
      </div>
    </Modal>
  );
}
