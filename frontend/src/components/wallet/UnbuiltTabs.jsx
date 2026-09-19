import { useMemo, useState } from "react";
import { cx } from "../../lib/carousel";
import { displayBalance } from "../../lib/adapters";
import { MASKED_AMOUNT } from "../../lib/playerPreferences";
import { currencyOptions } from "../../lib/walletOptions";
import WalletSelect, { CoinIcon } from "./CurrencySelect";

/**
 * Buy Crypto and Tip — the two tabs with no backend behind them.
 *
 * Both are the live modal's own layouts, read off `?modal=wallet&md-tab=…`
 * rather than designed here. Neither carries a notice about what is missing:
 * the screens are the product, and an explanation of this deployment's
 * configuration is not something a player should be reading in a wallet. What
 * each needs is in `docs/MISSING-AND-UNWIRED.md`.
 *
 * Their submits are `disabled`, which is also what the live modal does before
 * its form is complete.
 */

/**
 * The fiat currencies the reference's on-ramp accepts.
 *
 * Its own list, in its own order — not the player's wallet, which holds crypto
 * the on-ramp does not take payment in.
 */
const PAY_WITH = ["BRL", "CAD", "CNY", "DKK", "EUR", "IDR", "INR", "JPY", "KRW", "MXN", "NZD", "PHP", "PLN", "TRY", "USD", "VND"];

/** The assets it sells, again the reference's list. */
const RECEIVE = ["BTC", "ETH", "USDT", "USDC", "SHFL", "SOL", "LTC", "XRP", "TRX", "DOGE", "POL", "AVAX", "BNB", "GRAM", "SHIB", "DAI"];

/**
 * Buy Crypto — reference `BuyCrypto`.
 *
 * Layout: a row pairing the amount field with a narrow currency select, then
 * the asset to receive, then a provider select whose options are live quotes
 * ("Swapped 0.01484200"), then Buy Now, a strip of provider logos and a
 * disclaimer.
 *
 * The provider list is the one thing that cannot be filled: the quotes come
 * from the on-ramp, which needs a PSP. The select renders empty rather than
 * naming providers this deployment has no agreement with.
 */
export function BuyCryptoTab() {
  const [amount, setAmount] = useState("");
  const [fiat, setFiat] = useState("INR");
  const [receive, setReceive] = useState("ETH");
  const [provider, setProvider] = useState("");

  const payOptions = useMemo(() => PAY_WITH.map((c) => ({ value: c, label: c, icon: c })), []);
  const receiveOptions = useMemo(() => RECEIVE.map((c) => ({ value: c, label: c, icon: c })), []);

  /** Quotes come from the on-ramp; with no provider configured there are none. */
  const providerOptions = [];

  return (
    <form className="BuyCrypto_form" onSubmit={(e) => e.preventDefault()}>
      <div className="BuyCrypto_fieldRow">
        <div className="BuyCrypto_amountFieldWrapper">
          <div className="TextInput_formControlWrapper">
            <div className="TextInput_labelGroup">
              <div className="LabelBlock_root TextInput_labelBlock">
                <label className="Label_root" htmlFor="buy-amount">You Pay With</label>
              </div>
            </div>
            {/* `TextInput_inputPrefix` + `Input_hasPrefix` — the live field's own
                pair, with the selected currency's coin mark inside the input. */}
            <div className="InputWrapper_root">
              <span className="TextInput_inputPrefix">
                <CoinIcon code={fiat} />
              </span>
              <input
                id="buy-amount"
                className="Input_root Input_hasPrefix"
                inputMode="numeric"
                placeholder="Enter Value"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="BuyCrypto_options">
          <WalletSelect options={payOptions} value={fiat} onChange={setFiat} />
        </div>
      </div>

      <div className="BuyCrypto_fieldColumn">
        <WalletSelect label="In Exchange For" options={receiveOptions} value={receive} onChange={setReceive} />
      </div>

      <div className="BuyCrypto_fieldColumn">
        <WalletSelect
          label="Select Provider and Receive"
          options={providerOptions.length ? providerOptions : [{ value: "", label: "No providers available" }]}
          value={provider}
          onChange={setProvider}
          disabled={!providerOptions.length}
        />
      </div>

      <button
        type="submit"
        disabled
        className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary BuyCrypto_submitButton"
      >
        <span className="ButtonVariants_buttonContent">Buy Now</span>
      </button>

      {/* The payment marks the on-ramp accepts. The reference's own five, in
          its order — Apple Pay, Mastercard, Visa, bank transfer, Google Pay. */}
      <div className="BuyCryptoLogos_root BuyCryptoLogos_transparent">
        {["apple-pay-logo", "master-card-logo", "visa-card-logo", "greek-temple", "google-pay-logo"].map((n) => (
          <img key={n} alt="" src={`/icons/${n}.svg`} />
        ))}
      </div>

      <p className="BuyCryptoDisclaimer_disclaimer">
        Crypto purchases are processed externally and subject to additional processing
        fees. Final quotes may vary by provider.
      </p>
    </form>
  );
}

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
  /* The live modal opens with the switch off. */
  const [isPublic, setIsPublic] = useState(false);

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

  return (
    <form className="Tip_form" onSubmit={(e) => e.preventDefault()}>
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
            <p className="CurrencyInputRawLabel_labelRight">
              {hideBalance ? MASKED_AMOUNT : `${displayBalance(available, coin)} ${coin}`}
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

      <button
        type="submit"
        disabled
        className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary Tip_button"
      >
        <span className="ButtonVariants_buttonContent">Send Tip</span>
      </button>
    </form>
  );
}
