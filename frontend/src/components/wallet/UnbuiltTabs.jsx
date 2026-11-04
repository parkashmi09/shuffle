import { useMemo, useState } from "react";
import { cx } from "../../lib/carousel";
import { displayBalance, displayFiat } from "../../lib/adapters";
import { MASKED_AMOUNT } from "../../lib/playerPreferences";
import { currencyOptions } from "../../lib/walletOptions";
import { ApiError } from "../../lib/api";
import { tips } from "../../lib/endpoints";
import { useSession } from "../../lib/sessionContext";
import WalletSelect, { CoinIcon } from "./CurrencySelect";

/**
 * Tip — sends through `POST /user/tip/send`. The live modal's own layout, read
 * off `?modal=wallet&md-tab=tip`.
 */

/**
 * Tip — reference `Tip`.
 *
 * Currency, username, amount with the balance on the right of its label, a
 * "Public Tip" switch, and Send Tip. Shorter than the other tabs on the live
 * modal too (489px against Deposit's 634).
 */
export function TipTab({
  coin,
  onCoinChange,
  balances,
  displayCurrency,
  rates,
  fiatView = true,
  hideZeroBalances = false,
  hideBalance = false,
}) {
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("");
  /* The live modal opens with the switch off. The backend has no public-tip
     field (a tip is always private), so the switch is visual only. */
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const { refreshBalances } = useSession();

  const options = useMemo(
    () =>
      currencyOptions(balances, {
        displayCurrency,
        rates,
        fiatEquivalent: fiatView,
        hideZeroBalances,
        hideBalance,
        keep: coin,
      }),
    [balances, displayCurrency, rates, fiatView, hideZeroBalances, hideBalance, coin]
  );
  const available = balances?.[coin] ?? "0";
  const ready =
    username.trim() && /^\d+(\.\d{1,8})?$/.test(amount.trim()) && Number(amount) > 0 && Number(amount) <= Number(available);

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      await tips.send({ toUsername: username.trim(), currency: coin, amount: amount.trim() });
      setStatus({ ok: true, message: `Tip of ${amount.trim()} ${coin} sent to ${username.trim()}.` });
      setAmount("");
      refreshBalances?.();
    } catch (error) {
      const fields = error instanceof ApiError ? error.fields.map((f) => f.message).join(" ") : "";
      setStatus({ ok: false, message: fields || error?.message || "Could not send the tip." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="Tip_form" onSubmit={submit}>
      <WalletSelect label="Currency" options={options} value={coin} onChange={onCoinChange} />

      <div className="TextInput_formControlWrapper">
        <div className="TextInput_labelGroup">
          <div className="LabelBlock_root TextInput_labelBlock">
            <label className="TextInput_label" htmlFor="tip-user">
              <span>Username*</span>
            </label>
          </div>
        </div>
        <div className="InputWrapper_root">
          <input
            id="tip-user"
            className="Input_root"
            placeholder="Enter Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
      </div>

      {/* `Tip_switch` is a child of `Tip_amount`, not a sibling of it — the
          live form has four rows, and the switch rides in the amount block 8px
          under its input. Measured: `Tip_amount` y384 h102 = 70 + 8 + 24. */}
      <div className="Tip_amount">
        <div className="CurrencyInput_formControlWrapper">
          <div className="LabelBlock_root CurrencyInputRawLabel_labelBlock">
            <p className="CurrencyInputRawLabel_labelLeft"><span>Amount*</span></p>
            {/* The typed amount's value, as the reference's CurrencyInput shows it; the coin's balance is in the Currency picker. */}
            <p className="CurrencyInputRawLabel_labelRight">
              {hideBalance
                ? MASKED_AMOUNT
                : fiatView && rates
                  ? displayFiat(Number(amount) || 0, coin, displayCurrency, rates)
                  : `${displayBalance(Number(amount) || 0, coin)} ${coin}`}
            </p>
          </div>
          {/* The icon is a sibling of the input's wrapper, not of the input:
              `InputWrapper_root > (icon + CurrencyInput_currencyInput > input)`.
              That nesting is what `.CurrencyInput_currencyInput > input`'s 40px
              inset hangs off, so the placeholder clears the coin mark. */}
          <div className="InputWrapper_root">
            <div className="CurrencyInput_currencyInputIcon">
              <CoinIcon code={coin} />
            </div>
            <div className="CurrencyInput_currencyInput">
              <input
                className="Input_root CurrencyInputElement_root"
                inputMode="decimal"
                placeholder="Enter Value"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/*
          * A `Switch`, not a `Checkbox`.
          *
          * This was built as `Checkbox_root` — a 16px square that fills solid
          * `--color-lightBlue` when ticked. The live modal renders the
          * reference's `Switch` component: a 42x24 track with a sliding knob,
          * on a wrapper that is explicitly transparent. The checkbox is still
          * the input underneath, just visually hidden, so the label click,
          * keyboard focus and change event all keep working.
          */}
        <div className="Tip_switch">
          <label className="Switch_switchWrapper Tip_switchButton">
            <input
              className="Switch_hiddenCheckbox"
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <div className={cx("Switch_switchElement", isPublic && "Switch_checked")}>
              <span className="Switch_knob" />
            </div>
            <p className="Switch_label">Public Tip</p>
          </label>
        </div>
      </div>

      {status && (
        <div className="NoticeMessage_root" role={status.ok ? "status" : "alert"}>
          <span className="NoticeMessage_text" style={{ color: status.ok ? "var(--color-success)" : "var(--color-warning)" }}>
            {status.message}
          </span>
        </div>
      )}

      <button
        type="submit"
        disabled={!ready || busy}
        className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary Tip_button"
      >
        <span className="ButtonVariants_buttonContent">Send Tip</span>
      </button>
    </form>
  );
}
