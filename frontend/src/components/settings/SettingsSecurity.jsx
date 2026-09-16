import { useState } from "react";
import { cx } from "../../lib/carousel";
import { useApi } from "../../lib/useResource";
import { twoFactor as twoFactorApi } from "../../lib/endpoints";
import ChangePasswordModal from "./ChangePasswordModal";
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
  const { data: totp } = useApi("settings:2fa", () => twoFactorApi.status().catch(() => null));
  const enabled = Boolean(totp?.enabled);

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
            <button type="button" className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_primary">
              <span className="ButtonVariants_buttonContent">{enabled ? "Disable" : "Enable"}</span>
            </button>
          </div>
        </div>
      </form>

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
