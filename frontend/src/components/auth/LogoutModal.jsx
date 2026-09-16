import { useState } from "react";
import Modal from "../ui/Modal";

/**
 * "Are you sure you want to log out?" — reference `GenericModal`.
 *
 * ── WHY THIS IS NOT A LOGOUT-SHAPED COMPONENT ────────────────────────────
 *
 * The live site has no logout modal. The account menu's Logout row opens the
 * one confirmation dialog the whole app shares, configured for the occasion:
 *
 *     setCurrentModal({
 *       type: GENERAL,
 *       config: {
 *         header: t("msgConfirmLogout"),
 *         icon: "logout",
 *         confirmBtnText: t("btnYes"),
 *         cancelBtnText: t("btnNo"),
 *         onConfirm, onCancel,
 *       },
 *     })
 *
 * `GenericModal` maps `icon: "logout"` to `/icons/user-logout.svg` at 80×80 —
 * the same file Settings → Verify and Shuffle Wise use for Need Help — and
 * renders the header through `ModalHeader` and the pair through `ButtonGroup`.
 * An earlier pass here invented `LogoutModal_*` classes with hand-measured
 * pixels; the markup below is the reference's, so the shared rules size it.
 *
 * Keeping the generic shape matters beyond this dialog: the same component
 * answers the success, verification, mail and new-feature prompts, so the next
 * confirmation to be built is this file with a different `icon` and `heading`.
 */
export default function LogoutModal({ onClose, onConfirm }) {
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    setSubmitting(true);
    await onConfirm();
  };

  return (
    <Modal onClose={onClose} labelledBy="logout-title">
      <div className="GenericModal_generalModalContainer">
        <div className="Flex_root Flex_column Flex_md2 ModalHeader_root">
          <img alt="user" height="80" width="80" src="/icons/user-logout.svg" />
          <div>
            <h3 id="logout-title" className="Heading_root Heading_h3 Heading_center ModalHeader_heading">
              Are you sure you want to log out?
            </h3>
            {/* Empty on this dialog — the reference still renders it, and
                it is where a `body` string would go. */}
            <div className="ModalHeader_text" />
          </div>
        </div>
        <div className="ButtonGroup_root">
          <button
            type="button"
            className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_tertiary"
            disabled={submitting}
            onClick={onClose}
          >
            <span className="ButtonVariants_buttonContent">No</span>
          </button>
          <button
            type="button"
            className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary"
            disabled={submitting}
            onClick={confirm}
          >
            <span className="ButtonVariants_buttonContent">Yes</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
