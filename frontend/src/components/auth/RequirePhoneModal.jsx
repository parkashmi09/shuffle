import { useState } from "react";

import { profile as profileApi } from "../../lib/endpoints";
import { useSession } from "../../lib/sessionContext";
import { useSiteFeatures } from "../../lib/useSiteFeatures";
import { cleanPhone, isValidPhone } from "../../lib/phone";
import Modal from "../ui/Modal";

/**
 * The owner's `phone_required` policy (hash f3a287c6 RequirePhone): while it is `required`, a signed-in
 * player who signed up on the site (`/auth/me` `agentTree === false`, so never an agent's player or
 * before `/auth/me` answered) and is not a demo account must add a mobile number first. Nothing else
 * is usable: closing the dialog signs out.
 */
const MESSAGES = {
  PROFILE_PHONE_TAKEN: "That mobile number is already registered to another account.",
  TOO_MANY_REQUESTS: "Too many attempts. Please try again later.",
};

export default function RequirePhoneModal() {
  const { signedIn, user, updateUser, logout, mustChangePassword } = useSession();
  const { policy } = useSiteFeatures();
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const open = signedIn && !mustChangePassword && policy("phone_required") === "required" && user.agentTree === false && user.demo !== true && !user.phone;
  if (!open) return null;

  const bad = phone.trim() !== "" && !isValidPhone(phone);

  const submit = async (event) => {
    event.preventDefault();
    if (!isValidPhone(phone) || pending) return;
    setPending(true);
    setError(null);
    try {
      const saved = await profileApi.setPhone(cleanPhone(phone));
      updateUser({ phone: saved?.phone ?? cleanPhone(phone) });
    } catch (err) {
      // Saved meanwhile (another tab): read the number back and let the player in.
      if (err?.code === "PROFILE_PHONE_ALREADY_SET") {
        const fresh = await profileApi.get().catch(() => null);
        updateUser({ phone: fresh?.phone || true });
        return;
      }
      setError(MESSAGES[err?.code] || err?.fields?.[0]?.message || err?.message || "Could not save your mobile number. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal onClose={logout} label="Add Mobile Number">
      <h3 className="Header_root">Add Mobile Number</h3>
      <p className="Subheader_root">
        <span>A mobile number is required for every account. Add yours to continue — closing this signs you out.</span>
      </p>

      <form className="ChangePasswordModal_root" onSubmit={submit}>
        <div className="FormControlWrapper_root">
          <label className="Label_root" htmlFor="require-phone">Mobile Number*</label>
          <div className="InputWrapper_root">
            <input
              id="require-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              className="Input_root"
              placeholder="Enter Mobile Number"
              value={phone}
              aria-invalid={bad || !!error}
              onChange={(event) => {
                setPhone(event.target.value);
                setError(null);
              }}
            />
          </div>
        </div>

        {(bad || error) && (
          <div className="WarningMessage_container">
            <img alt="warning" className="WarningMessage_icon" src="/icons/exclamation.svg" />
            <span className="WarningMessage_content">{error || "Enter a valid mobile number (10 to 15 digits)"}</span>
          </div>
        )}

        <button type="submit" disabled={!isValidPhone(phone) || pending} className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary ChangePasswordModal_button">
          <span className="ButtonVariants_buttonContent">{pending ? "Saving…" : "Save"}</span>
        </button>
        <button type="button" onClick={logout} className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_secondary ChangePasswordModal_button">
          <span className="ButtonVariants_buttonContent">Sign out</span>
        </button>
      </form>
    </Modal>
  );
}
