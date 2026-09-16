import { useMemo, useState } from "react";

import { useSession } from "../../lib/sessionContext";
import { toFiat } from "../../lib/adapters";
import WalletSelect, { CoinIcon } from "../wallet/CurrencySelect";
import { LIMIT_TYPES, PERIOD_UNITS, enableLimit, limitReset } from "../../lib/shuffleWise";
import Modal from "../ui/Modal";

/**
 * Set Gambling Limit — reference `SetGamblingLimitContent`, then
 * `GamblingLimitConfirmationContent` once it is saved.
 *
 * Three fields and a button that stays disabled until all three are answered
 * and the amount is above zero. The amount is in USD whatever the player reads
 * balances in — the label to its right carries the same figure converted, which
 * is the only place the display currency appears.
 *
 * A type already held is not offered again, and with one type left the select
 * collapses to a read-only field, as the reference's `h.length > 1` branch does.
 */

const TYPE_OPTIONS = Object.entries(LIMIT_TYPES).map(([value, label]) => ({ value, label }));
const PERIOD_OPTIONS = Object.entries(PERIOD_UNITS).map(([value, label]) => ({ value, label }));

export default function SetGamblingLimitModal({ taken = [], onDone, onClose }) {
  const { displayCurrency, rates } = useSession();
  const [saved, setSaved] = useState(null);
  const [amount, setAmount] = useState("");
  const [periodUnit, setPeriodUnit] = useState("");

  const typeOptions = useMemo(() => TYPE_OPTIONS.filter((o) => !taken.includes(o.value)), [taken]);
  const [type, setType] = useState(typeOptions.length === 1 ? typeOptions[0].value : "");

  // The right-hand label: the same amount in the player's own fiat, grouped to
  // two decimals with the code after it — the reference's `intlNumber` plus
  // the fiat preference. With no price table it stays the USD figure.
  const converted = (toFiat(Number(amount || 0), "USD", displayCurrency, rates) ?? Number(amount || 0))
    .toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const ready = type && periodUnit && Number(amount) > 0;

  const submit = (event) => {
    event.preventDefault();
    if (!ready) return;
    const row = enableLimit({ type, usdAmount: Number(amount), periodUnit });
    onDone();
    setSaved(row);
  };

  return (
    <Modal onClose={onClose} label="Set Gambling Limit">
      {saved ? (
        <>
          <img src="/icons/tick.svg" alt="tick" height="80" width="80" className="GamblingLimitConfirmationContent_tickIcon" />
          <h3 className="Header_root">Gambling Limit Set</h3>
          <div data-testid="gambling-limit-confirmed-modal" className="GamblingLimitConfirmationContent_body">
            <p>
              You can remove your gambling limit at any time. Please allow up to 12 hours for any updates to
              your limits to take effect on your account.
            </p>
            <div className="GamblingLimitConfirmationContent_contentWrapper">
              <div className="GamblingLimitConfirmationContent_contentItem">
                <span className="GamblingLimitConfirmationContent_label">Limit Type</span>
                <span className="GamblingLimitConfirmationContent_item">{LIMIT_TYPES[saved.type]}</span>
              </div>
              <div className="GamblingLimitConfirmationContent_contentItem">
                <span className="GamblingLimitConfirmationContent_label">Limit Amount</span>
                <span className="GamblingLimitConfirmationContent_item">
                  <CoinIcon code="USD" />
                  {Number(saved.usdAmount).toLocaleString("en-US", { style: "currency", currency: "USD" })}
                </span>
              </div>
              <div className="GamblingLimitConfirmationContent_contentItem">
                <span className="GamblingLimitConfirmationContent_label">Limit Period</span>
                <span className="GamblingLimitConfirmationContent_item">{PERIOD_UNITS[saved.periodUnit]}</span>
              </div>
              <div className="GamblingLimitConfirmationContent_contentItem">
                <span className="GamblingLimitConfirmationContent_label">
                  Limit Reset
                  <img
                    src="/icons/exclamation.svg"
                    alt="exclamation"
                    className="GamblingLimitConfirmationContent_img"
                    title="If the chosen reset date is invalid, the limit will reset on the last day of the month."
                  />
                </span>
                <span className="GamblingLimitConfirmationContent_item">
                  {limitReset(saved.periodUnit, saved.createdAt)}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary"
              onClick={onClose}
            >
              <span className="ButtonVariants_buttonContent">Done</span>
            </button>
          </div>
        </>
      ) : (
        <form data-testid="gambling-limit-form" onSubmit={submit}>
          <h3 className="Header_root">Set Gambling Limit</h3>
          <div className="SetGamblingLimitContent_body">
            {typeOptions.length > 1 ? (
              <WalletSelect
                variant="plain"
                label="Limit Type*"
                placeholder="Select"
                options={typeOptions}
                value={type}
                onChange={setType}
              />
            ) : (
              <div className="FormControlWrapper_root">
                <div className="LabelBlock_root">
                  <label className="Label_root">Limit Type*</label>
                </div>
                <div className="InputWrapper_root">
                  <input readOnly className="Input_root Input_outline" value={LIMIT_TYPES[type] || ""} style={{ color: "var(--color-gray200)" }} />
                </div>
              </div>
            )}

            <div className="CurrencyInput_formControlWrapper">
              <div className="LabelBlock_root CurrencyInputRawLabel_labelBlock">
                <p className="CurrencyInputRawLabel_labelLeft"><span>Limit Amount*</span></p>
                <p className="CurrencyInputRawLabel_labelRight">{converted} {displayCurrency}</p>
              </div>
              <div className="InputWrapper_root">
                <div className="CurrencyInput_currencyInputIcon">
                  <CoinIcon code="USD" />
                </div>
                <div className="CurrencyInput_currencyInput">
                  <input
                    className="Input_root CurrencyInputElement_root"
                    inputMode="decimal"
                    placeholder="0.00"
                    maxLength={20}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </div>
              </div>
            </div>

            <WalletSelect
              variant="plain"
              label="Limit Period*"
              placeholder="Select"
              options={PERIOD_OPTIONS}
              value={periodUnit}
              onChange={setPeriodUnit}
            />
          </div>

          <button
            type="submit"
            disabled={!ready}
            className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary"
          >
            <span className="ButtonVariants_buttonContent">Add Limit</span>
          </button>
        </form>
      )}
    </Modal>
  );
}
