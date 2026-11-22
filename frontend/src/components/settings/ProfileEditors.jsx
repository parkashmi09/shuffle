import { useState } from "react";
import { cx } from "../../lib/carousel";
import { avatarSrc } from "../../lib/adapters";
import { emailOtp, profile as profileApi } from "../../lib/endpoints";
import { useApi } from "../../lib/useResource";
import Modal from "../ui/Modal";

function Warning({ text }) {
  if (!text) return null;
  return (
    <div className="WarningMessage_container">
      <img alt="warning" className="WarningMessage_icon" src="/icons/exclamation.svg" />
      <span className="WarningMessage_content">{text}</span>
    </div>
  );
}

/**
 * Pick one of the site admin's avatars (`GET /admin/avatars/public`, `POST /user/profile/avatar`).
 * A picture above the player's VIP level is refused with its own message (`AVATAR_LOCKED`).
 */
export function AvatarPickerModal({ current, onClose, onSaved }) {
  const { data, loading, error: loadError } = useApi("settings:avatars", () => profileApi.avatars());
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const list = Array.isArray(data) ? data : [];

  const pick = async (avatar) => {
    setBusy(avatar.id);
    setError(null);
    try {
      await profileApi.setAvatar(avatar.id);
      onSaved();
      onClose();
    } catch (err) {
      setError(err?.message || "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal onClose={onClose} label="Choose Avatar">
      <h3 className="Header_root">Choose Avatar</h3>
      {loading && <p className="VerificationCard_text">Loading…</p>}
      {!loading && !list.length && <p className="VerificationCard_text">{loadError ? "Could not load avatars." : "No avatars are available yet."}</p>}
      {list.length > 0 && (
        <div className="AvatarPicker_grid">
          {list.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={busy != null}
              aria-label={a.minLevel ? `Avatar, VIP level ${a.minLevel}+` : "Avatar"}
              className={cx("AvatarPicker_option", avatarSrc(a.url) === avatarSrc(current) && "AvatarPicker_active")}
              onClick={() => pick(a)}
            >
              <img alt="" width="56" height="56" src={avatarSrc(a.url)} />
              {a.minLevel > 0 && <span className="AvatarPicker_level">Lv {a.minLevel}+</span>}
            </button>
          ))}
        </div>
      )}
      <Warning text={error} />
    </Modal>
  );
}

/**
 * Change email: a code is mailed to the NEW address (`POST /user/email/otp`, purpose
 * `change-email`), then `POST /user/profile/change-email` with that code and the current password.
 */
export function ChangeEmailModal({ onClose, onSaved }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err?.message || "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!sent) return run(async () => {
      await emailOtp.request(email.trim(), "change-email");
      setSent(true);
    });
    return run(async () => {
      await profileApi.changeEmail(email.trim(), code, password);
      setDone(true);
      onSaved();
    });
  };

  const ready = sent ? code.length === 6 && password : /\S+@\S+\.\S+/.test(email.trim());

  return (
    <Modal onClose={onClose} label="Change Email">
      <h3 className="Header_root">Change Email</h3>
      {done ? (
        <p className="VerificationCard_text">Your email has been changed.</p>
      ) : (
        <form className="ChangePasswordModal_root" onSubmit={submit}>
          <p className="Subheader_root">
            <span>{sent ? `Enter the 6-digit code we sent to ${email.trim()}, and your current password.` : "We will send a code to the new address."}</span>
          </p>
          <div className="FormControlWrapper_root">
            <label className="Label_root" htmlFor="new-email">New Email*</label>
            <div className="InputWrapper_root">
              <input id="new-email" type="email" autoComplete="email" readOnly={sent} className="Input_root" placeholder="Enter new email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          {sent && (
            <>
              <div className="FormControlWrapper_root">
                <label className="Label_root" htmlFor="email-code">Code*</label>
                <div className="InputWrapper_root">
                  <input id="email-code" className="Input_root" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
                </div>
              </div>
              <div className="FormControlWrapper_root">
                <label className="Label_root" htmlFor="email-password">Current Password*</label>
                <div className="InputWrapper_root">
                  <input id="email-password" type="password" autoComplete="current-password" className="Input_root" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
            </>
          )}
          <Warning text={error} />
          <button type="submit" disabled={busy || !ready} className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary ChangePasswordModal_button">
            <span className="ButtonVariants_buttonContent">{sent ? "Change Email" : "Send Code"}</span>
          </button>
        </form>
      )}
    </Modal>
  );
}
