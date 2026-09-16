import { useState } from "react";

import { auth as authApi } from "../../lib/endpoints";
import Modal from "../ui/Modal";

/**
 * Settings → Security → Change Password — reference `ChangePasswordModal`.
 *
 * Three password fields, each with the eye toggle the auth modal already uses,
 * and a Forgot Password link under the first. The reference keeps this dialog
 * in the page rather than in the shell, so it lives beside the panel that opens
 * it.
 *
 * `POST /user/auth/change-password` takes `{ currentPassword, newPassword }`
 * and signs every other session out, which is what the subheader promises.
 */

function PasswordField({ label, name, placeholder, value, onChange, children }) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <div className="FormControlWrapper_root">
        <label className="Label_root" htmlFor={`pw-${name}`}>{label}</label>
        <div className="InputWrapper_root">
          <input
            id={`pw-${name}`}
            name={name}
            type={shown ? "text" : "password"}
            className="Input_root Input_hasRightIcon"
            placeholder={placeholder}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <button
            type="button"
            aria-label={shown ? "Hide password" : "Show password"}
            className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_icon Icon_root"
            onClick={() => setShown((s) => !s)}
          >
            <span className="ButtonVariants_buttonContent Icon_backgroundColor">
              <img alt="eye" src="/icons/eye-outline.svg" />
            </span>
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function ChangePasswordModal({ onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("The two new passwords do not match.");
      return;
    }
    setPending(true);
    try {
      await authApi.changePassword({ currentPassword: current, newPassword: next });
      setDone(true);
    } catch (err) {
      setError(err?.message || "That did not go through.");
    } finally {
      setPending(false);
    }
  };

  const ready = current && next && confirm && !pending;

  return (
    <Modal onClose={onClose} label="Change Password">
      <h3 className="Header_root">Change Password</h3>
      <p className="Subheader_root">
        <span>Changing your password will sign you out on all other devices</span>
      </p>

      {done ? (
        <p className="VerificationCard_text">Your password has been changed.</p>
      ) : (
        <form className="ChangePasswordModal_root" onSubmit={submit}>
          <PasswordField label="Current Password*" name="password" placeholder="Enter Your Password" value={current} onChange={setCurrent}>
            <button type="button" className="PasswordInput_forgotPasswordText">Forgot Password?</button>
          </PasswordField>
          <PasswordField label="New Password" name="newPassword" placeholder="Enter New Password" value={next} onChange={setNext} />
          <PasswordField label="Confirm New Password" name="confirmNewPassword" placeholder="Confirm New Password" value={confirm} onChange={setConfirm} />

          {error && (
            <div className="WarningMessage_container">
              <img alt="warning" className="WarningMessage_icon" src="/icons/exclamation.svg" />
              <span className="WarningMessage_content">{error}</span>
            </div>
          )}

          <button type="submit" disabled={!ready} className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary ChangePasswordModal_button">
            <span className="ButtonVariants_buttonContent">Change password</span>
          </button>
        </form>
      )}
    </Modal>
  );
}
