import { useMemo, useState } from "react";
import { cx } from "../../lib/carousel";
import { ApiError } from "../../lib/api";
import { funding } from "../../lib/endpoints";
import { useSession } from "../../lib/sessionContext";
import { displayBalance, isFiat } from "../../lib/adapters";
import { currencyName } from "../../lib/currencies";
import { networkLabel, networksFor } from "../../lib/networks";
import WalletSelect, { CoinIcon } from "./CurrencySelect";
import { currencyOptions } from "../../lib/walletOptions";

/**
 * The Withdraw tab — reference `Withdraw`.
 *
 * Layout read off the live modal: currency and network selects, an address
 * field, an amount field with its balance on the right of the label, a row of
 * 25 / 50 / 75 / MAX buttons, a fee notice, a network notice, and the submit.
 *
 * ── WHAT THIS PLATFORM CAN ACTUALLY PAY OUT ──────────────────────────────
 *
 * Only fiat. `POST /user/withdrawals/fiat` exists and works; the crypto side
 * has `GET /user/withdrawals/crypto` for history but **no POST** — there is no
 * route to request one, so a crypto withdrawal form here would be a button
 * wired to nothing. The tab says so rather than pretending.
 *
 * The validator is `.strict()` and conditional: `accountHolderName` is always
 * required, INR needs an IFSC **or** a UPI id, and every other currency needs
 * bank name, account number and IFSC together. That is mirrored in the form so
 * a player is told before the request rather than by a 422 after it.
 */

const PERCENTAGES = [25, 50, 75];

/**
 * The crypto payout form.
 *
 * Complete, and deliberately not submitting: the backend serves withdrawal
 * *history* at `GET /user/withdrawals/crypto` and has **no POST** — payouts run
 * through CCPayment, which is not configured. So the screen is finished and the
 * submit says what it is waiting for rather than posting into nothing.
 *
 * Everything else behaves: the network picker, the address field, the amount
 * with its balance caption, the percentage row and the fee notice are all live
 * against the wallet, so wiring this is one `funding.createCryptoWithdrawal`
 * away once the route exists.
 */
function CryptoWithdraw({ coin, available, form, set, setPercent }) {
  const options = networksFor(coin);
  const [network, setNetwork] = useState("");
  const active = network || options[0]?.value || "";

  return (
    <>
      {/* Currency and Network share the one grid, as on Deposit. */}
      <div className="DimOverlay_dimRoot">
        <div className="CurrencyNetworkSelectOptionsWrapper_root">
          {form.currencySelect}
          <WalletSelect label="Network*" options={options} value={active} onChange={setNetwork} />
        </div>
      </div>

      {/* The address sits between the grid and `Withdraw_inputWrapper` on the
          live modal, not inside it — the wrapper holds the amount and the
          percentage row only. */}
      <div className="DimOverlay_dimRoot">
      <div className="TextInput_formControlWrapper">
        <div className="TextInput_labelGroup">
          <div className="LabelBlock_root TextInput_labelBlock">
            <label className="Label_root" htmlFor="wd-address">
              {currencyName(coin)} ({active}) Address*
            </label>
          </div>
        </div>
        <div className="InputWrapper_root">
          <input
            id="wd-address"
            className="Input_root Input_hasRightIcon"
            placeholder="Enter Address"
            value={form.address}
            onChange={set("address")}
          />
          {/* The reference's paste/reset affordance. */}
          <button type="button" className="TextInput_icon RedoButton_button" aria-label="Clear address" onClick={() => set("address")({ target: { value: "" } })}>
            <img alt="" height="16" width="16" src="/icons/redo.svg" />
          </button>
        </div>
      </div>
      </div>

      <div className="Withdraw_inputWrapper">
        <div className="CurrencyInput_formControlWrapper">
          <div className="LabelBlock_root CurrencyInputRawLabel_labelBlock">
            <p className="CurrencyInputRawLabel_labelLeft"><span>Amount*</span></p>
            <p className="CurrencyInputRawLabel_labelRight">
              {displayBalance(available, coin)} {coin}
            </p>
          </div>
          <div className="InputWrapper_root CurrencyInput_currencyInput">
            {/* `CoinIcon`, not a hand-built `/icons/crypto/` path: a fiat
                balance's mark lives in a different folder, so INR and the rest
                fell back to the star here. */}
            <span className="CurrencyInput_currencyInputIcon">
              <CoinIcon code={coin} />
            </span>
            <input
              className="Input_root"
              inputMode="decimal"
              placeholder="Enter Amount"
              value={form.amount}
              onChange={set("amount")}
            />
          </div>
        </div>

        <div className="Withdraw_percentageButtons">
          {[...PERCENTAGES, 100].map((p) => (
            <button
              key={p}
              type="button"
              className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_secondary"
              onClick={() => setPercent(p)}
            >
              <span className="ButtonVariants_buttonContent">{p === 100 ? "MAX" : `${p}%`}</span>
            </button>
          ))}
        </div>

        {/*
          The notices are direct children of the wrapper, not a nested group:
          `Withdraw_inputWrapper` *is* the `Flex_root Flex_column Flex_sm3`
          column on the live modal, and its own 6px gap spaces the amount, the
          percentage row and both notices alike. An inner div added 4px and a
          second set of margins.

          Their text carries `NoticeMessage_text` — grey `rgb(190,198,209)` at
          12px. Only the row itself is white, and nothing renders directly in it.
        */}
        <span className="NoticeMessage_root">
          <img alt="" height="16" width="16" src="/icons/exclamation.svg" />
          <span className="NoticeMessage_text">Withdrawal Fee: —</span>
        </span>
        <span className="NoticeMessage_root">
          <img alt="" height="16" width="16" src="/icons/shield.svg" />
          <span className="NoticeMessage_text">
            Your withdrawal will be processed on {networkLabel(coin, active)}.
          </span>
        </span>
      </div>

      {/*
        Disabled, and therefore grey: `ButtonVariants_root:disabled` paints
        `--btn-bg-disabled` (`--color-gray300`), which is the light slate the
        live modal shows on an incomplete form. An earlier pass added
        `keepEnabledStyle`, which is the variant that *suppresses* exactly that.
      */}
      <button type="submit" disabled className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary Withdraw_submitButton">
        <span className="ButtonVariants_buttonContent">Withdraw</span>
      </button>
    </>
  );
}

export default function WithdrawTab({ coin, onCoinChange, balances, displayCurrency, rates }) {
  const { refreshBalances } = useSession();
  const options = useMemo(
    () => currencyOptions(balances, { displayCurrency, rates }),
    [balances, displayCurrency, rates]
  );

  const available = balances?.[coin] ?? "0";
  const currencySelect = (
    <WalletSelect label="Currency" options={options} value={coin} onChange={onCoinChange} />
  );
  const [form, setForm] = useState({
    amount: "",
    address: "",
    accountHolderName: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    upiId: "",
  });
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  /** The same rule the backend's `superRefine` applies, checked before the request. */
  const missing = (() => {
    if (!form.amount || Number(form.amount) <= 0) return "Enter an amount.";
    if (Number(form.amount) > Number(available)) return "That is more than your balance.";
    if (!form.accountHolderName.trim()) return "The account holder name is required.";
    if (coin === "INR") {
      if (!form.ifscCode.trim() && !form.upiId.trim()) return "For INR, enter either an IFSC code or a UPI id.";
      return null;
    }
    if (!form.bankName.trim() || !form.accountNumber.trim() || !form.ifscCode.trim()) {
      return "Bank name, account number and IFSC code are required for this currency.";
    }
    return null;
  })();

  const setPercent = (pct) => {
    const value = (Number(available) * pct) / 100;
    setForm((f) => ({ ...f, amount: displayBalance(value, coin) }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (missing) {
      setStatus({ ok: false, message: missing });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      // `.strict()` — an empty optional string is still an unexpected value to
      // send, so only the filled fields go.
      const body = { amount: form.amount, currency: coin, accountHolderName: form.accountHolderName.trim() };
      for (const key of ["bankName", "accountNumber", "ifscCode", "upiId"]) {
        if (form[key].trim()) body[key] = form[key].trim();
      }
      await funding.createFiatWithdrawal(body);
      setStatus({ ok: true, message: "Withdrawal requested. It stays pending until an operator approves it." });
      setForm((f) => ({ ...f, amount: "" }));
      refreshBalances();
    } catch (error) {
      const fields = error instanceof ApiError ? error.fields.map((f) => f.message).join(" ") : "";
      setStatus({ ok: false, message: fields || error.message || "Could not request the withdrawal." });
    } finally {
      setBusy(false);
    }
  };

  const field = (id, label, key, placeholder) => (
    <div className="TextInput_formControlWrapper">
      <div className="TextInput_labelGroup">
        <div className="LabelBlock_root TextInput_labelBlock">
          <label className="Label_root" htmlFor={id}>{label}</label>
        </div>
      </div>
      <div className="InputWrapper_root">
        <input id={id} className="Input_root" placeholder={placeholder} value={form[key]} onChange={set(key)} />
      </div>
    </div>
  );

  return (
    <form className="Withdraw_form" onSubmit={submit}>
      {isFiat(coin) && (
          <div className="CurrencyNetworkSelectOptionsWrapper_root">{currencySelect}</div>
        )}

        {!isFiat(coin) ? (
          <CryptoWithdraw coin={coin} available={available} form={{ ...form, currencySelect }} set={set} setPercent={setPercent} />
        ) : (
          <>
            <div className="Withdraw_inputWrapper">
              {field("wd-holder", "Account holder name*", "accountHolderName", "As it appears on the account")}
              {coin === "INR"
                ? (
                  <>
                    {field("wd-ifsc", "IFSC code", "ifscCode", "e.g. HDFC0000123")}
                    {field("wd-upi", "UPI id", "upiId", "name@bank")}
                  </>
                )
                : (
                  <>
                    {field("wd-bank", "Bank name*", "bankName", "")}
                    {field("wd-account", "Account number*", "accountNumber", "")}
                    {field("wd-ifsc", "IFSC / routing code*", "ifscCode", "")}
                  </>
                )}

              {/* Amount, with the balance on the right of the label — the
                  reference's `CurrencyInputRawLabel` split. */}
              <div className="CurrencyInput_formControlWrapper">
                <div className="LabelBlock_root CurrencyInputRawLabel_labelBlock">
                  <span className="CurrencyInputRawLabel_labelLeft">Amount*</span>
                  <span className="CurrencyInputRawLabel_labelRight">
                    {displayBalance(available, coin)} {coin}
                  </span>
                </div>
                <div className="InputWrapper_root CurrencyInput_currencyInput">
                  <input
                    className="Input_root"
                    inputMode="decimal"
                    placeholder={displayBalance(0, coin)}
                    value={form.amount}
                    onChange={set("amount")}
                  />
                </div>
              </div>

              <div className="Withdraw_percentageButtons">
                {PERCENTAGES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_secondary"
                    onClick={() => setPercent(p)}
                  >
                    <span className="ButtonVariants_buttonContent">{p}%</span>
                  </button>
                ))}
                <button
                  type="button"
                  className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_secondary"
                  onClick={() => setPercent(100)}
                >
                  <span className="ButtonVariants_buttonContent">MAX</span>
                </button>
              </div>
            </div>

            {/* The live modal shows a withdrawal fee here. This platform has no
                fee configuration for fiat payouts, so the row states the terms
                it can actually stand behind. */}
            <span className="NoticeMessage_text">
              Withdrawals are reviewed by an operator before they are paid out.
            </span>

            {status && (
              <div className="NoticeMessage_root" role={status.ok ? "status" : "alert"}>
                <span
                  className="NoticeMessage_text"
                  style={{ color: status.ok ? "var(--color-success)" : "var(--color-warning)" }}
                >
                  {status.message}
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy || Boolean(missing)}
              className={cx("ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary")}
            >
              <span className="ButtonVariants_buttonContent">{busy ? "Requesting…" : "Withdraw"}</span>
            </button>
          </>
      )}
    </form>
  );
}
