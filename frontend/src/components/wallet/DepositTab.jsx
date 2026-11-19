import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../../lib/carousel";
import { ApiError } from "../../lib/api";
import { funding } from "../../lib/endpoints";
import { useApi } from "../../lib/useResource";
import { isFiat } from "../../lib/adapters";
import { currencyName } from "../../lib/currencies";
import { USER_EVENTS, userRequest } from "../../lib/siteLive";
import { networkLabel, useNetworkOptions } from "../../lib/networks";
import { currencyOptions, fetchAutoRails, optionsForRoutes, shownRail } from "../../lib/walletOptions";
import { useSiteFeatures } from "../../lib/useSiteFeatures";
import { useSession } from "../../lib/sessionContext";
import WalletSelect from "./CurrencySelect";
import QrCode from "./QrCode";

/** The fiat the operator publishes bank details for — the manual deposit rail. */
const MANUAL_COIN = "INR";

/**
 * The Deposit tab — reference `Deposit`.
 *
 * The live modal is crypto-first: currency, network, a read-only address with a
 * copy button, a warning about the network, a QR code, and a "Deposit history"
 * link in the footer. That layout is reproduced exactly.
 *
 * ── TWO FUNDING PRODUCTS, NOT TWO STYLES ─────────────────────────────────
 *
 * This platform funds crypto and fiat through completely different backends,
 * so the tab branches on the selected currency rather than pretending one flow
 * covers both:
 *
 * - **Crypto** is the address CCPayment allocated to the player, read with
 *   `GET_ADDRESS` over the user socket. Until one is allocated the tab says
 *   crypto deposits are not available — inventing an address would be
 *   inventing somewhere for real money to go.
 *
 * - **Fiat** is a bank transfer: `GET /user/bank-details/:coin` publishes where
 *   to send it and `POST /user/deposits/fiat` files the claim. Both work today,
 *   so that path is fully wired. Where the automatic gateway (F2Pay) takes the
 *   coin, its hosted payment (`AutoDeposit`) is offered beside it.
 */

/** The bank row the fiat flow shows, with a copy button — same shape as the crypto address. */
function CopyField({ label, value, placeholder = "", disabled = false }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — the value is selectable in the field either way */
    }
  };

  return (
    <div className="TextInput_formControlWrapper">
      <div className="TextInput_labelGroup">
        <div className="LabelBlock_root TextInput_labelBlock">
          <label className="Label_root">{label}</label>
        </div>
      </div>
      <div className="InputWrapper_root">
        <input
          className="Input_root Input_hasRightIcon"
          type="text"
          readOnly
          disabled={disabled}
          placeholder={placeholder}
          value={value || ""}
        />
        <button
          type="button"
          className="TextInput_icon IconPressButton_button ClipboardCopy_inline ClipboardCopy_sizeLg"
          aria-label={`Copy ${label}`}
          title={copied ? "Copied" : "Copy"}
          disabled={disabled || !value}
          onClick={copy}
        >
          <img alt="" height="16" width="16" src={copied ? "/icons/tick-circle-green.svg" : "/icons/copy.svg"} />
        </button>
      </div>
    </div>
  );
}

function Warning({ children }) {
  return (
    <div className="WarningMessage_container">
      <img alt="" className="WarningMessage_icon" height="16" width="16" src="/images/warning-info.svg" />
      <span className="WarningMessage_content">{children}</span>
    </div>
  );
}

/**
 * Crypto: network, address, warning, QR — the reference's four rows, in order.
 *
 * The address is the one allocated to this player (`GET_ADDRESS` on the user socket). It answers
 * `{ address: null }` until the provider (CCPayment) has issued one, so that — and a refusal — is
 * stated in words; an empty field must never look like somewhere to send money.
 */
function CryptoDeposit({ coin, currencySelect }) {
  const options = useNetworkOptions(coin);
  const [network, setNetwork] = useState("");
  const active = options.some((o) => o.value === network) ? network : options[0]?.value || "";
  const label = options.find((o) => o.value === active)?.label || networkLabel(coin, active);

  const { data, loading, error } = useApi(`wallet:address:${coin}:${active}`, () =>
    userRequest(USER_EVENTS.GET_ADDRESS, { coin, chain: active })
  );
  const address = data?.address || "";

  return (
    <>
      {/* One wrapper holds both selects — the reference's grid measures 156px,
          which is two 66px fields plus its 16px gap, not one field per wrapper. */}
      <div className="CurrencyNetworkSelectOptionsWrapper_root">
        {currencySelect}
        <WalletSelect label="Network*" options={options} value={active} onChange={setNetwork} />
      </div>

      {loading ? (
        <div className="Deposit_walletGeoRestrictionBlock">Loading your deposit address…</div>
      ) : error ? (
        <div className="Deposit_walletGeoRestrictionBlock" role="alert">{error.message}</div>
      ) : !address ? (
        <div className="Deposit_walletGeoRestrictionBlock">Crypto deposits are not available yet.</div>
      ) : (
        <>
          <div className="Deposit_inputWrapper">
            <CopyField label={`${currencyName(coin)} (${active}) Address`} value={address} />
            <Warning>Your deposit must be sent on the {label} network to be processed.</Warning>
          </div>
          <QrCode value={address} />
        </>
      )}
    </>
  );
}

/** Fiat: the operator's bank details, then a claim with the transfer reference. */
function FiatDeposit({ coin }) {
  const { data: accounts, loading } = useApi(`wallet:bank:${coin}`, () => funding.bankDetails(coin));
  const account = accounts?.[0] || null;

  const [form, setForm] = useState({ amount: "", transactionId: "" });
  // The backend refuses a fiat claim without the transfer's screenshot (SCREENSHOT_REQUIRED).
  const [screenshot, setScreenshot] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setStatus(null);
    setBusy(true);
    try {
      /**
       * The route is `multer().single('screenshot')`, so the body is multipart
       * even when no file is attached — a JSON body would not reach the
       * validator's fields at all.
       */
      const body = new FormData();
      body.append("amount", form.amount);
      body.append("currency", coin);
      body.append("transactionId", form.transactionId);
      if (screenshot) body.append("screenshot", screenshot);
      if (account) {
        body.append("bankName", account.bankName || "");
        body.append("accountNumber", account.accountNumber || "");
        body.append("ifscCode", account.ifscCode || "");
        body.append("accountHolderName", account.accountHolderName || "");
        if (account.upiId) body.append("upiId", account.upiId);
      }
      await funding.createFiatDeposit(body);
      setStatus({ ok: true, message: "Deposit submitted. It will show as pending until an operator confirms it." });
      setForm({ amount: "", transactionId: "" });
      setScreenshot(null);
    } catch (error) {
      const fields = error instanceof ApiError ? error.fields.map((f) => f.message).join(" ") : "";
      setStatus({ ok: false, message: fields || error.message || "Could not submit the deposit." });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="Deposit_walletGeoRestrictionBlock">Loading deposit details…</div>;

  if (!account) {
    return (
      <div className="Deposit_walletGeoRestrictionBlock">
        No {coin} deposit account has been published yet. An operator sets these under
        admin → bank details.
      </div>
    );
  }

  return (
    <>
      <div className="Deposit_inputWrapper">
        <CopyField label="Account holder" value={account.accountHolderName} />
        <CopyField label="Bank" value={account.bankName} />
        <CopyField label="Account number" value={account.accountNumber} />
        {account.ifscCode && <CopyField label="IFSC" value={account.ifscCode} />}
        {account.upiId && <CopyField label="UPI id" value={account.upiId} />}
        <Warning>
          Transfer from an account in your own name, then enter the amount and the bank
          reference below. Deposits from a third party cannot be credited.
        </Warning>
      </div>

      <div className="Deposit_inputWrapper">
        <div className="TextInput_formControlWrapper">
          <div className="TextInput_labelGroup">
            <div className="LabelBlock_root TextInput_labelBlock">
              <label className="Label_root" htmlFor="deposit-amount">Amount*</label>
            </div>
          </div>
          <div className="InputWrapper_root">
            <input
              id="deposit-amount"
              className="Input_root"
              inputMode="decimal"
              placeholder="0.00"
              value={form.amount}
              onChange={set("amount")}
            />
          </div>
        </div>

        <div className="TextInput_formControlWrapper">
          <div className="TextInput_labelGroup">
            <div className="LabelBlock_root TextInput_labelBlock">
              <label className="Label_root" htmlFor="deposit-ref">Bank reference*</label>
            </div>
          </div>
          <div className="InputWrapper_root">
            <input
              id="deposit-ref"
              className="Input_root"
              placeholder="UTR / transaction id"
              value={form.transactionId}
              onChange={set("transactionId")}
            />
          </div>
        </div>

        <div className="TextInput_formControlWrapper">
          <div className="TextInput_labelGroup">
            <div className="LabelBlock_root TextInput_labelBlock">
              <label className="Label_root" htmlFor="deposit-screenshot">Payment screenshot*</label>
            </div>
          </div>
          <div className="InputWrapper_root">
            <input
              id="deposit-screenshot"
              className="Input_root"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
            />
          </div>
        </div>
      </div>

      {status && (
        <div className={cx("NoticeMessage_root")} role={status.ok ? "status" : "alert"}>
          <span className="NoticeMessage_text" style={{ color: status.ok ? "var(--color-success)" : "var(--color-warning)" }}>
            {status.message}
          </span>
        </div>
      )}

      <button
        type="submit"
        form="deposit-form"
        disabled={busy || !form.amount || !form.transactionId || !screenshot}
        className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary"
        onClick={submit}
      >
        <span className="ButtonVariants_buttonContent">{busy ? "Submitting…" : "I have paid"}</span>
      </button>
    </>
  );
}

/* The gateway's method codes as a player reads them; any other code shows as the gateway sends it. */
const METHOD_LABELS = { UpiMixed: "UPI", PI_USDT_TRX: "USDT · TRC20" };
const NO_METHODS = [];

/** The automatic deposit: pick the gateway's method, enter the amount, pay on its page. Its signed callback credits the wallet. */
function AutoDeposit({ coin, methods }) {
  const [picked, setPicked] = useState(methods[0].method);
  const method = methods.find((row) => row.method === picked) ?? methods[0];
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!(Number(amount) > 0)) return setError("Enter the amount to deposit.");
    setBusy(true);
    try {
      const order = await funding.createDepositOrder({ provider: "f2pay", currency: coin, amount, method: method.method });
      if (!/^https?:\/\//i.test(order?.redirectUrl ?? "")) throw new Error("The payment page did not open. Please try again.");
      // Stays busy: the page is leaving for the gateway, which sends the player back when paid.
      window.location.assign(order.redirectUrl);
    } catch (err) {
      setError(err.message || "Could not start the deposit.");
      setBusy(false);
    }
  };

  return (
    <>
      <div className="Deposit_inputWrapper">
        <Warning>Enter the amount and pay on the payment page that opens. Your balance is credited automatically once the payment is confirmed.</Warning>
        {methods.length > 1 && (
          <WalletSelect
            label="Pay with"
            options={methods.map((row) => ({ value: row.method, label: METHOD_LABELS[row.method] ?? row.method }))}
            value={method.method}
            onChange={setPicked}
          />
        )}
        <div className="TextInput_formControlWrapper">
          <div className="TextInput_labelGroup">
            <div className="LabelBlock_root TextInput_labelBlock">
              <label className="Label_root" htmlFor="deposit-auto-amount">Amount*</label>
            </div>
          </div>
          <div className="InputWrapper_root">
            <input id="deposit-auto-amount" className="Input_root" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
      </div>

      {error && (
        <div className="NoticeMessage_root" role="alert">
          <span className="NoticeMessage_text" style={{ color: "var(--color-warning)" }}>{error}</span>
        </div>
      )}

      <button type="button" disabled={busy || !amount} className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary" onClick={submit}>
        <span className="ButtonVariants_buttonContent">{busy ? "Opening…" : "Deposit"}</span>
      </button>
    </>
  );
}

export default function DepositTab({
  coin,
  onCoinChange,
  balances,
  displayCurrency,
  rates,
  fiatView = true,
  hideZeroBalances = false,
  hideBalance = false,
  onDepositHistory,
}) {
  /* Which funding rails this site offers. `both` is the default and leaves
     the list exactly as it was — see `optionsForRoutes`. */
  const { depositRoutes } = useSiteFeatures();
  const { manual: manualMode, automatic } = depositRoutes();
  // The site admin's Manual deposit switch (`/auth/me` capabilities) closes the bank-transfer form too.
  const { user } = useSession();
  const manual = manualMode && user?.capabilities?.manualDeposit !== false;
  const { data: rails } = useApi("wallet:auto-rails", fetchAutoRails, { enabled: automatic });
  const autoMethods = (automatic && rails?.methods) || NO_METHODS;
  const coinMethods = autoMethods.filter((row) => String(row.currency).toUpperCase() === coin);
  const autoInr = autoMethods.some((row) => String(row.currency).toUpperCase() === MANUAL_COIN);
  const [pickedRail, setPickedRail] = useState("manual");
  const rail = shownRail({ manual, auto: coinMethods.length > 0, picked: pickedRail });

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
        { manual, automatic },
        autoMethods.map((row) => String(row.currency).toUpperCase())
      ),
    [balances, displayCurrency, rates, fiatView, hideZeroBalances, hideBalance, coin, manual, automatic, autoMethods]
  );

  /*
   * `keep: coin` holds the selected currency in the list even when it has a
   * zero balance — but a currency whose RAIL is switched off has to go, and
   * leaving it selected would render a deposit form for a route this site
   * does not run. Move to the first currency that survives instead.
   */
  useEffect(() => {
    if (!options.length) return;
    if (options.some((option) => option.value === coin)) return;
    onCoinChange?.(options[0].value);
  }, [options, coin, onCoinChange]);

  /*
   * Open on the manual (bank transfer) deposit rather than a crypto coin with no address yet.
   * shortcut: INR is the one fiat with bank details here; pick from published accounts if another fiat gets them.
   */
  const openedOnManual = useRef(false);
  useEffect(() => {
    if (openedOnManual.current || !(manual || autoInr) || !options.length) return;
    openedOnManual.current = true;
    if (!isFiat(coin) && options.some((o) => o.value === MANUAL_COIN)) onCoinChange?.(MANUAL_COIN);
  }, [manual, autoInr, options, coin, onCoinChange]);

  // Built once and handed to whichever branch renders, so both share the single
  // grid the reference uses rather than each opening its own.
  const currencySelect = (
    <WalletSelect label="Currency" options={options} value={coin} onChange={onCoinChange} />
  );

  return (
    <form className="Deposit_form" id="deposit-form" onSubmit={(e) => e.preventDefault()}>
      {isFiat(coin) ? (
        <>
          <div className="CurrencyNetworkSelectOptionsWrapper_root">{currencySelect}</div>
          {manual && coinMethods.length > 0 && (
            <WalletSelect
              label="Deposit type"
              options={[{ value: "manual", label: "Manual" }, { value: "auto", label: "Automatic" }]}
              value={rail}
              onChange={setPickedRail}
            />
          )}
          {rail === "auto" && <AutoDeposit key={coin} coin={coin} methods={coinMethods} />}
          {rail === "manual" && <FiatDeposit coin={coin} />}
          {!rail && <div className="Deposit_walletGeoRestrictionBlock">{coin} deposits are not available on this site.</div>}
        </>
      ) : (
        <CryptoDeposit coin={coin} currencySelect={currencySelect} />
      )}

      <div className="Footer_root">
        <button type="button" className="ModalBottomLink_root" onClick={() => onDepositHistory?.()}>
          Deposit history
        </button>
      </div>
    </form>
  );
}
