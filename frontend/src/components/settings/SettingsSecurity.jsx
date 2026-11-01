import { useState } from "react";
import { cx } from "../../lib/carousel";
import { useApi } from "../../lib/useResource";
import { twoFactor as twoFactorApi } from "../../lib/endpoints";
import ChangePasswordModal from "./ChangePasswordModal";
import Modal from "../ui/Modal";
import Switch from "./Switch";

/**
 * Settings → Security — reference `PasswordAndSecurity`.
 *
 * A two-column grid: Change Password and Two-Factor Authentication across the
 * top, Linked Accounts below. `LinkedAccountsPanel` spans both columns when it
 * is the only thing on its row, which is the reference's own `:only-child` rule.
 *
 * ── LINKED ACCOUNTS ──────────────────────────────────────────────────────
 *
 * Rendered, and deliberately inert. There is no OAuth link or unlink route in
 * any of the four services, so the switches carry the reference's own
 * `LinkAccountCard_disabled` state rather than pretending to toggle something.
 */

const PROVIDERS = [
  { id: "google", label: "Google", icon: "/icons/brands/google.svg" },
  { id: "telegram", label: "telegram", icon: "/icons/brands/telegram.svg" },
  { id: "line", label: "line", icon: "/icons/brands/line.svg" },
];

export default function SettingsSecurity() {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const { data: totp, reload } = useApi("settings:2fa", () => twoFactorApi.status().catch(() => null));
  const enabled = Boolean(totp?.isEnabled);
  // `setup` holds `{ qrCode, secret }` while enabling; `disabling` asks for the code + password.
  const [setup, setSetup] = useState(null);
  const [disabling, setDisabling] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err?.message || "That did not go through.");
    } finally {
      setBusy(false);
    }
  };
  const done = () => {
    setSetup(null);
    setDisabling(false);
    setCode("");
    setPassword("");
    reload();
  };
  const onToggle = () =>
    enabled ? setDisabling(true) : run(async () => setSetup(await twoFactorApi.begin()));
  const onConfirm = (event) => {
    event.preventDefault();
    run(async () => {
      if (setup) await twoFactorApi.confirm(code.trim());
      else await twoFactorApi.disable(code.trim(), password);
      done();
    });
  };

  return (
    <div className="PasswordAndSecurity_passwordAndSecurityPageWrapper">
      <form className="Panel_panelWrapper" onSubmit={(event) => event.preventDefault()}>
        <h2 className="Panel_panelHeading">Change Password</h2>
        <p className="ChangePassword_passwordAndSecurityDescriptionText">Last changed -</p>
        <button type="button" className="FeatureCard_passwordAndSecurityCardWrapper" onClick={() => setPasswordOpen(true)}>
          <div className="FeatureCard_passwordAndSecurityCardBody">
            <img alt="list" src="/icons/list.svg" />
            <p className="FeatureCard_passwordAndSecurityCardTitle">Change Password</p>
          </div>
          <img alt="arrow right" className="FeatureCard_right" src="/icons/chevron.svg" />
        </button>
      </form>

      <form className="Panel_panelWrapper" onSubmit={(event) => event.preventDefault()}>
        <h2 className="Panel_panelHeading">Two-Factor Authentication</h2>
        <p className="TwoFactorAuthentication_descriptionText">
          Enhance your security by utilizing 2-factor verification using an authenticator app for all
          future logins, withdrawals, and tipping.
        </p>
        <div className="TwoFactorAuthentication_featureCard">
          <div className="TwoFactorAuthentication_iconTextWrapper">
            <img className="TwoFactorAuthentication_verifyIcon" alt="verify" width="80" height="80" src="/icons/verify.svg" />
            <p className="TwoFactorAuthentication_totpStatusText">{enabled ? "Enabled" : "Disabled"}</p>
          </div>
          <div className="TwoFactorAuthentication_buttonWrapper">
            <button type="button" disabled={busy || !totp} onClick={onToggle} className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_primary">
              <span className="ButtonVariants_buttonContent">{enabled ? "Disable" : "Enable"}</span>
            </button>
          </div>
        </div>
        {error && !setup && !disabling && <p className="TwoFactorAuthentication_descriptionText" role="alert">{error}</p>}
      </form>

      {(setup || disabling) && (
        <Modal onClose={done} label="Two-Factor Authentication">
          <h3 className="Header_root">{setup ? "Enable 2FA" : "Disable 2FA"}</h3>
          <form className="ChangePasswordModal_root" onSubmit={onConfirm}>
            {setup && (
              <>
                <p className="Subheader_root"><span>Scan this code with your authenticator app, then enter the 6-digit code.</span></p>
                <img alt="2FA QR code" width="180" height="180" src={setup.qrCode} style={{ alignSelf: "center", background: "#fff" }} />
                <p className="VerificationCard_text" style={{ wordBreak: "break-all" }}>{setup.secret}</p>
              </>
            )}
            <div className="FormControlWrapper_root">
              <label className="Label_root" htmlFor="totp-code">Code*</label>
              <div className="InputWrapper_root">
                <input id="totp-code" className="Input_root" inputMode="numeric" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
            </div>
            {!setup && (
              <div className="FormControlWrapper_root">
                <label className="Label_root" htmlFor="totp-password">Password*</label>
                <div className="InputWrapper_root">
                  <input id="totp-password" type="password" className="Input_root" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
            )}
            {error && (
              <div className="WarningMessage_container">
                <img alt="warning" className="WarningMessage_icon" src="/icons/exclamation.svg" />
                <span className="WarningMessage_content">{error}</span>
              </div>
            )}
            <button type="submit" disabled={busy || code.trim().length !== 6 || (!setup && !password)} className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary ChangePasswordModal_button">
              <span className="ButtonVariants_buttonContent">{setup ? "Enable" : "Disable"}</span>
            </button>
          </form>
        </Modal>
      )}

      <div className="LinkedAccountsPanel_passwordAndSecurityLinkedAccountsPanel">
        <form className="Panel_panelWrapper" onSubmit={(event) => event.preventDefault()}>
          <h2 className="Panel_panelHeading">Linked Accounts</h2>
          <div className="Spacer_root Spacer_sm5" />
          <div className="Flex_root Flex_column Flex_md2">
            {PROVIDERS.map((provider) => (
              <div key={provider.id} className={cx("LinkAccountCard_passwordAndSecurityAccountCardWrapper", "LinkAccountCard_disabled")}>
                <img alt={provider.label} width="16" height="16" src={provider.icon} />
                <p className="LinkAccountCard_passwordAndSecurityProviderName">{provider.label}</p>
                <Switch checked={false} disabled label="Link Account" className="LinkAccountCard_switch" />
              </div>
            ))}
          </div>
        </form>
      </div>

      {passwordOpen && <ChangePasswordModal onClose={() => setPasswordOpen(false)} />}
    </div>
  );
}
