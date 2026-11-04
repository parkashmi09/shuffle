import { useEffect, useMemo, useState } from "react";
import { cx } from "../../lib/carousel";
import { ApiError } from "../../lib/api";
import { funding } from "../../lib/endpoints";
import { useSession } from "../../lib/sessionContext";
import { displayBalance, formatAmount, isFiat } from "../../lib/adapters";
import { currencyName } from "../../lib/currencies";
import { networkLabel, useNetworkOptions } from "../../lib/networks";
import { USER_EVENTS, userRequest, useSiteVersion } from "../../lib/siteLive";
import { MASKED_AMOUNT } from "../../lib/playerPreferences";
import WalletSelect, { CoinIcon } from "./CurrencySelect";
import { currencyOptions, optionsForRoutes } from "../../lib/walletOptions";
import { useSiteFeatures } from "../../lib/useSiteFeatures";
import { useApi } from "../../lib/useResource";

/**
 * The Withdraw tab — reference `Withdraw`.
 *
 * Layout read off the live modal: currency and network selects, an address
 * field, an amount field with its balance on the right of the label, a row of
 * 25 / 50 / 75 / MAX buttons, a fee notice, a network notice, and the submit.
 *
 * ── WHAT THIS PLATFORM CAN ACTUALLY PAY OUT ──────────────────────────────
 *
 * Fiat posts `POST /user/withdrawals/fiat`. Crypto is the user socket's
 * `SUBMIT_NEW_WITHDRAWL` (`{ wallet, amount, coin, password, chain }`), which
 * debits the balance and queues the request for staff review.
 *
 * The validator is `.strict()` and conditional: `accountHolderName` is always
 * required, INR needs an IFSC **or** a UPI id, and every other currency needs
 * bank name, account number and IFSC together. That is mirrored in the form so
 * a player is told before the request rather than by a 422 after it.
 */

const PERCENTAGES = [25, 50, 75];

/** The withdrawal refusals a player can act on, in their words. */
const WITHDRAW_REFUSALS = {
  FIAT_WITHDRAW_KYC_REQUIRED: "Complete identity verification (Settings → Verify) before withdrawing.",
  WITHDRAW_WAGER_REQUIRED: "Wager your deposit and bonus before withdrawing.",
  BONUS_FORFEIT_REQUIRED: "This withdrawal forfeits your active bonus — tick the box to confirm.",
};

/** Why `GET /withdrawals/requirements` says no, from its `missing[]`. */
function requirementText(req) {
  const parts = (req.missing || []).map((m) =>
    m === "kyc"
      ? WITHDRAW_REFUSALS.FIAT_WITHDRAW_KYC_REQUIRED
      : m === "wager"
        ? `Wager ${req.wager?.remaining != null ? formatAmount(req.wager.remaining) : ""} ${req.wager?.currency ?? ""} more before withdrawing.`.replace(/\s+/g, " ")
        : m === "cap"
          ? "You have reached your withdrawal cap — wager more to raise it."
          : m === "daily"
            ? "You have reached today's withdrawal limit."
            : `Withdrawal blocked: ${m}.`
  );
  return parts.join(" ") || "Withdrawals are not available on this account yet.";
}

const accountLabel = (a) =>
  a.method === "upi" ? `UPI · ${a.upiId}` : `${a.bankName || "Bank"} · ${a.accountNumberMasked || ""} · ${a.ifscCode || ""}`;

/** The crypto payout form — `SUBMIT_NEW_WITHDRAWL` over the user socket; the backend asks for the password. */
function CryptoWithdraw({ coin, available, form, set, setPercent, hideBalance = false, onDone, gate, gateBlocked, forfeitBonus, onRefusal }) {
  const options = useNetworkOptions(coin);
  const [network, setNetwork] = useState("");
  const active = options.some((o) => o.value === network) ? network : options[0]?.value || "";
  const label = options.find((o) => o.value === active)?.label || networkLabel(coin, active);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const missing = !form.address.trim()
    ? "Enter an address."
    : !form.amount || Number(form.amount) <= 0
      ? "Enter an amount."
      : Number(form.amount) > Number(available)
        ? "That is more than your balance."
        : !password
          ? "Enter your password."
          : null;

  const submit = async () => {
    if (missing) return setStatus({ ok: false, message: missing });
    setBusy(true);
    setStatus(null);
    try {
      await userRequest(USER_EVENTS.SUBMIT_NEW_WITHDRAWL, {
        coin,
        chain: active,
        wallet: form.address.trim(),
        amount: form.amount,
        password,
        ...(forfeitBonus ? { forfeitBonus: true } : {}),
      });
      setStatus({ ok: true, message: "Withdrawal requested. It stays pending until an operator approves it." });
      setPassword("");
      onDone();
    } catch (error) {
      if (error?.code === "BONUS_FORFEIT_REQUIRED") onRefusal();
      setStatus({ ok: false, message: WITHDRAW_REFUSALS[error?.code] || error.message || "Could not request the withdrawal." });
    } finally {
      setBusy(false);
    }
  };

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
              {hideBalance ? MASKED_AMOUNT : `${displayBalance(available, coin)} ${coin}`}
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
          <span className="NoticeMessage_text">Withdrawals are reviewed by an operator before they are paid out.</span>
        </span>
        <span className="NoticeMessage_root">
          <img alt="" height="16" width="16" src="/icons/shield.svg" />
          <span className="NoticeMessage_text">
            Your withdrawal will be processed on {label}.
          </span>
        </span>
      </div>

      <div className="TextInput_formControlWrapper">
        <div className="TextInput_labelGroup">
          <div className="LabelBlock_root TextInput_labelBlock">
            <label className="Label_root" htmlFor="wd-password">Password*</label>
          </div>
        </div>
        <div className="InputWrapper_root">
          <input
            id="wd-password"
            className="Input_root"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      </div>

      {gate}

      {status && (
        <div className="NoticeMessage_root" role={status.ok ? "status" : "alert"}>
          <span className="NoticeMessage_text" style={{ color: status.ok ? "var(--color-success)" : "var(--color-warning)" }}>
            {status.message}
          </span>
        </div>
      )}

      <button
        type="button"
        disabled={busy || Boolean(missing) || gateBlocked}
        onClick={submit}
        className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary Withdraw_submitButton"
      >
        <span className="ButtonVariants_buttonContent">{busy ? "Requesting…" : "Withdraw"}</span>
      </button>
    </>
  );
}

export default function WithdrawTab({
  coin,
  onCoinChange,
  balances,
  displayCurrency,
  rates,
  fiatView = true,
  hideZeroBalances = false,
  hideBalance = false,
  onWithdrawalHistory,
}) {
  const { refreshBalances } = useSession();
  /* Payout rails this site runs — the withdrawal half of the same policy the
     deposit tab reads. `both` leaves the list untouched. */
  const { withdrawalRoutes } = useSiteFeatures();
  const { manual, automatic } = withdrawalRoutes();

  const options = useMemo(
    () =>
      optionsForRoutes(
        currencyOptions(balances, {
          displayCurrency,
          rates,
          fiatEquivalent: fiatView,
          hideZeroBalances,
          hideBalance,
          keep: coin,
        }),
        { manual, automatic }
      ),
    [balances, displayCurrency, rates, fiatView, hideZeroBalances, hideBalance, coin, manual, automatic]
  );

  /* A currency whose payout rail is off must not stay selected — same reason
     as the deposit tab: the form below branches on `isFiat(coin)`. */
  useEffect(() => {
    if (!options.length) return;
    if (options.some((option) => option.value === coin)) return;
    onCoinChange?.(options[0].value);
  }, [options, coin, onCoinChange]);

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
  const [nonce, setNonce] = useState(0);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const fiat = isFiat(coin);
  const { data: accounts } = useApi(`wallet:bank-accounts:${nonce}`, () => funding.bankAccounts(), { enabled: fiat });
  // Both rails run the same gate (`requirements.assertMet`), so crypto reads it too.
  const kycV = useSiteVersion("kyc");
  const { data: requirements } = useApi(`wallet:wd-req:${coin}:${nonce}:${kycV}`, () => funding.withdrawRequirements(coin));
  /** "" = the default saved account, "new" = type one in. */
  const [accountChoice, setAccountChoice] = useState("");
  const saved = Array.isArray(accounts) ? accounts : [];
  const account = accountChoice === "new" ? null : saved.find((a) => a.id === accountChoice) || saved.find((a) => a.isDefault) || saved[0] || null;
  const [forfeitBonus, setForfeitBonus] = useState(false);
  // Wagering owed only on a bonus does not block: the player forfeits the bonus with the withdrawal
  // (`remainingAfterForfeit` is what would still block after it — 0 = bonus only).
  const bonusOnlyWager = Boolean(requirements?.bonusForfeitAllowed) && Number(requirements?.wager?.remainingAfterForfeit) <= 0;
  const blockers = (requirements?.missing || []).filter((m) => !(m === "wager" && bonusOnlyWager));
  const onlyBonus = Boolean(requirements?.missing?.length) && blockers.length === 0;
  const blocked = requirements?.ok === false && !onlyBonus ? requirementText({ ...requirements, missing: blockers }) : null;
  const needsForfeit = Boolean(requirements?.bonusForfeitRequired && requirements?.bonusForfeitAllowed);
  const lostBonus = (requirements?.wager?.bonus?.bonuses || []).map((b) => `${formatAmount(b.amount)} ${b.currency}`).join(", ");
  const cap = requirements?.cap;
  const daily = requirements?.dailyLimit;
  const gate = (
    <>
      {cap?.enabled && cap.remaining != null && (
        <span className="NoticeMessage_text">Withdrawal cap: {formatAmount(cap.remaining)} {cap.currency} left to withdraw.</span>
      )}
      {daily?.enabled && daily.remaining != null && (
        <span className="NoticeMessage_text">
          Daily limit: {formatAmount(daily.remaining)} of {formatAmount(daily.limit)} {daily.currency} left today.
        </span>
      )}
      {blocked && (
        <div className="NoticeMessage_root" role="alert">
          <span className="NoticeMessage_text" style={{ color: "var(--color-warning)" }}>{blocked}</span>
        </div>
      )}
      {needsForfeit && (
        <label className="NoticeMessage_text">
          <input type="checkbox" checked={forfeitBonus} onChange={(e) => setForfeitBonus(e.target.checked)} /> I forfeit my active
          bonus{lostBonus ? ` (${lostBonus})` : ""} with this withdrawal
          {onlyBonus ? " — its wagering is the only thing left to complete" : ""}. The bonus and its winnings are removed.
        </label>
      )}
    </>
  );
  const gateBlocked = Boolean(blocked) || (needsForfeit && !forfeitBonus);

  /** The same rule the backend's `superRefine` applies, checked before the request. */
  const missing = (() => {
    if (!form.amount || Number(form.amount) <= 0) return "Enter an amount.";
    if (Number(form.amount) > Number(available)) return "That is more than your balance.";
    if (account) return null;
    if (!form.accountHolderName.trim()) return "The account holder name is required.";
    if (coin === "INR") {
      if (!form.upiId.trim() && !(form.accountNumber.trim() && form.ifscCode.trim())) {
        return "For INR, enter a UPI id, or an account number with its IFSC code.";
      }
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
      const body = { amount: form.amount, currency: coin, ...(forfeitBonus ? { forfeitBonus: true } : {}) };
      let accountId = account?.id;
      // INR payout details are saved as a payout account first (`/bank-accounts` is India-shaped:
      // UPI or account + IFSC), so the next withdrawal is one tap. Other fiat goes inline.
      if (!accountId && coin === "INR") {
        const holder = form.accountHolderName.trim();
        const created = await funding.addBankAccount(
          form.upiId.trim()
            ? { method: "upi", accountHolderName: holder, upiId: form.upiId.trim() }
            : {
                method: "bank",
                accountHolderName: holder,
                accountNumber: form.accountNumber.trim(),
                ifscCode: form.ifscCode.trim(),
                ...(form.bankName.trim() ? { bankName: form.bankName.trim() } : {}),
              }
        );
        accountId = created?.id;
        setAccountChoice(String(accountId || ""));
      }
      if (accountId) body.bankAccountId = String(accountId);
      else {
        body.accountHolderName = form.accountHolderName.trim();
        for (const key of ["bankName", "accountNumber", "ifscCode", "upiId"]) {
          if (form[key].trim()) body[key] = form[key].trim();
        }
      }
      await funding.createFiatWithdrawal(body);
      setStatus({ ok: true, message: "Withdrawal requested. It stays pending until an operator approves it." });
      setForm((f) => ({ ...f, amount: "" }));
      refreshBalances();
      setNonce((n) => n + 1);
    } catch (error) {
      const fields = error instanceof ApiError ? error.fields.map((f) => f.message).join(" ") : "";
      if (error?.code === "BONUS_FORFEIT_REQUIRED") setNonce((n) => n + 1);
      setStatus({ ok: false, message: fields || WITHDRAW_REFUSALS[error?.code] || error.message || "Could not request the withdrawal." });
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
    <form className="Withdraw_form" onSubmit={fiat ? submit : (e) => e.preventDefault()}>
      {isFiat(coin) && (
          <div className="CurrencyNetworkSelectOptionsWrapper_root">{currencySelect}</div>
        )}

        {!isFiat(coin) ? (
          <CryptoWithdraw
            coin={coin}
            available={available}
            form={{ ...form, currencySelect }}
            set={set}
            setPercent={setPercent}
            hideBalance={hideBalance}
            gate={gate}
            gateBlocked={gateBlocked}
            forfeitBonus={forfeitBonus}
            onRefusal={() => setNonce((n) => n + 1)}
            onDone={() => {
              setForm((f) => ({ ...f, amount: "" }));
              refreshBalances();
              setNonce((n) => n + 1);
            }}
          />
        ) : (
          <>
            <div className="Withdraw_inputWrapper">
              {saved.length > 0 && (
                <WalletSelect
                  label="Payout account"
                  options={[
                    ...saved.map((a) => ({ value: a.id, label: accountLabel(a) })),
                    { value: "new", label: "Add a new account" },
                  ]}
                  value={account ? account.id : "new"}
                  onChange={setAccountChoice}
                />
              )}
              {!account && field("wd-holder", "Account holder name*", "accountHolderName", "As it appears on the account")}
              {account ? null : coin === "INR"
                ? (
                  <>
                    {field("wd-upi", "UPI id", "upiId", "name@bank")}
                    {field("wd-account", "Account number (if no UPI)", "accountNumber", "")}
                    {field("wd-ifsc", "IFSC code (if no UPI)", "ifscCode", "e.g. HDFC0000123")}
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
                    {hideBalance ? MASKED_AMOUNT : `${displayBalance(available, coin)} ${coin}`}
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

            {gate}

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
              disabled={busy || Boolean(missing) || gateBlocked}
              className={cx("ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary")}
            >
              <span className="ButtonVariants_buttonContent">{busy ? "Requesting…" : "Withdraw"}</span>
            </button>
          </>
      )}

      <div className="Footer_root">
        <button type="button" className="ModalBottomLink_root" onClick={() => onWithdrawalHistory?.()}>
          Withdrawal history
        </button>
      </div>
    </form>
  );
}
