import { useState } from "react";
import { isFiat } from "../../lib/adapters";
import { currencyLabel } from "../../lib/currencies";
import { twoFactor, withdrawWhitelist } from "../../lib/endpoints";
import { useApi } from "../../lib/useResource";
import { useSession } from "../../lib/sessionContext";
import WalletSelect from "../wallet/CurrencySelect";
import Modal from "../ui/Modal";
import Switch from "./Switch";

const EMPTY = { label: "", network: "", address: "", memo: "" };
const when = (iso) => new Date(iso).toLocaleString();

/**
 * Settings → Security → Withdrawal Whitelist — `/user/withdrawals/whitelist`.
 *
 * The player's saved crypto payout addresses, and the switch that limits
 * withdrawals to them. The backend refuses the switch on an empty list and
 * turns it off itself when the last address goes.
 *
 * Adding, removing and switching off need the account password (plus the 2FA
 * code when 2FA is on), so those go through a confirm dialog. A new address is
 * usable from `activeAt` (24h later); switching off lands at `offAt` (24h later).
 */
export default function WithdrawalWhitelist() {
  const { balances } = useSession();
  const { data, error: loadError, reload } = useApi("settings:whitelist", () => withdrawWhitelist.list());
  const coins = Object.keys(balances || {}).filter((c) => !isFiat(c)).map((c) => ({ value: c, label: currencyLabel(c), icon: c }));
  const [currency, setCurrency] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { data: totp } = useApi("whitelist:2fa", () => twoFactor.status().catch(() => null));
  // `{ title, call(creds) }` while the password / 2FA dialog is open.
  const [confirm, setConfirm] = useState(null);
  const [creds, setCreds] = useState({ password: "", code: "" });
  const coin = currency || coins[0]?.value || "";
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      reload();
      return true;
    } catch (err) {
      setError(err?.message || "That did not go through.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const ask = (title, call) => {
    setError(null);
    setCreds({ password: "", code: "" });
    setConfirm({ title, call });
  };

  const onConfirm = async (e) => {
    e.preventDefault();
    const body = { password: creds.password };
    if (totp?.isEnabled) body.code = creds.code.trim();
    if (await run(() => confirm.call(body))) setConfirm(null);
  };

  const add = (e) => {
    e.preventDefault();
    const body = { label: form.label.trim(), currency: coin, address: form.address.trim() };
    if (form.network.trim()) body.network = form.network.trim();
    if (form.memo.trim()) body.memo = form.memo.trim();
    ask("Save Address", async (c) => {
      await withdrawWhitelist.add({ ...body, ...c });
      setForm(EMPTY);
    });
  };

  const addresses = data?.addresses ?? [];
  const ready = form.label.trim() && form.address.trim().length >= 4 && coin;

  return (
    <div className="LinkedAccountsPanel_passwordAndSecurityLinkedAccountsPanel">
      <form className="Panel_panelWrapper Flex_root Flex_column Flex_md2" onSubmit={add}>
        <h2 className="Panel_panelHeading">Withdrawal Whitelist</h2>
        <p className="TwoFactorAuthentication_descriptionText">
          Save the addresses you withdraw to. With whitelist-only on, crypto withdrawals can go to these addresses only.
        </p>

        {loadError && !data && <p className="TwoFactorAuthentication_descriptionText" role="alert">{loadError.message || "Could not load your addresses."}</p>}

        {data && (
          <div className="Flex_root Flex_lg1" style={{ alignItems: "center" }}>
            <Switch
              checked={Boolean(data.whitelistOnly)}
              disabled={busy || (!data.whitelistOnly && addresses.length === 0)}
              onChange={(next) => (next ? run(() => withdrawWhitelist.enforce(true)) : ask("Turn Off Whitelist", (c) => withdrawWhitelist.enforce(false, c)))}
              className="SwitchGroup_switch"
            />
            <div className="SwitchGroup_switchLabelDesc">
              <h5 className="Heading_root Heading_h5 SwitchGroup_heading">Whitelist-only withdrawals</h5>
              <p>
                {data.offAt
                  ? `Turns off at ${when(data.offAt)}`
                  : addresses.length ? "Only the addresses below can receive a withdrawal" : "Add an address to turn this on"}
              </p>
            </div>
          </div>
        )}

        {addresses.length > 0 && (
          <div className="MiniList_root">
            {addresses.map((a) => (
              <div key={a.id} className="MiniList_row">
                <span>
                  <strong>{a.label}</strong> · {a.currency}
                  {a.network ? ` (${a.network})` : ""}
                  <br />
                  <span className="MiniList_meta">{a.address}</span>
                  {a.activeAt && new Date(a.activeAt) > new Date() && (
                    <>
                      <br />
                      <span className="MiniList_meta">Usable from {when(a.activeAt)}</span>
                    </>
                  )}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => ask("Remove Address", (c) => withdrawWhitelist.remove(a.id, c))}
                  className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_secondary"
                >
                  <span className="ButtonVariants_buttonContent">Remove</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {coins.length > 0 && <WalletSelect label="Currency" options={coins} value={coin} onChange={setCurrency} />}
        {[
          { key: "label", label: "Label*", placeholder: "e.g. My cold wallet" },
          { key: "address", label: "Address*", placeholder: "Enter address" },
          { key: "network", label: "Network", placeholder: "e.g. TRC20" },
          { key: "memo", label: "Memo / Tag", placeholder: "Optional" },
        ].map((f) => (
          <div key={f.key} className="FormControlWrapper_root">
            <label className="Label_root" htmlFor={`wl-${f.key}`}>{f.label}</label>
            <div className="InputWrapper_root">
              <input id={`wl-${f.key}`} className="Input_root Input_outline" placeholder={f.placeholder} value={form[f.key]} onChange={set(f.key)} />
            </div>
          </div>
        ))}

        {error && !confirm && (
          <div className="WarningMessage_container">
            <img alt="warning" className="WarningMessage_icon" src="/icons/exclamation.svg" />
            <span className="WarningMessage_content">{error}</span>
          </div>
        )}

        <button type="submit" disabled={busy || !ready} className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary">
          <span className="ButtonVariants_buttonContent">Save Address</span>
        </button>
      </form>

      {confirm && (
        <Modal onClose={() => setConfirm(null)} label={confirm.title}>
          <h3 className="Header_root">{confirm.title}</h3>
          <form className="ChangePasswordModal_root" onSubmit={onConfirm}>
            <p className="Subheader_root"><span>Confirm with your password{totp?.isEnabled ? " and your 2FA code" : ""}.</span></p>
            <div className="FormControlWrapper_root">
              <label className="Label_root" htmlFor="wl-password">Password*</label>
              <div className="InputWrapper_root">
                <input id="wl-password" type="password" autoComplete="current-password" className="Input_root" value={creds.password} onChange={(e) => setCreds((c) => ({ ...c, password: e.target.value }))} />
              </div>
            </div>
            {totp?.isEnabled && (
              <div className="FormControlWrapper_root">
                <label className="Label_root" htmlFor="wl-code">2FA Code*</label>
                <div className="InputWrapper_root">
                  <input id="wl-code" className="Input_root" inputMode="numeric" maxLength={6} placeholder="000000" value={creds.code} onChange={(e) => setCreds((c) => ({ ...c, code: e.target.value }))} />
                </div>
              </div>
            )}
            {error && (
              <div className="WarningMessage_container">
                <img alt="warning" className="WarningMessage_icon" src="/icons/exclamation.svg" />
                <span className="WarningMessage_content">{error}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={busy || !creds.password || (totp?.isEnabled && creds.code.trim().length !== 6)}
              className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary ChangePasswordModal_button"
            >
              <span className="ButtonVariants_buttonContent">Confirm</span>
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
