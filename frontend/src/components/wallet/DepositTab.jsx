import { useEffect, useMemo, useState } from "react";
import { cx } from "../../lib/carousel";
import { ApiError } from "../../lib/api";
import { funding } from "../../lib/endpoints";
import { useApi } from "../../lib/useResource";
import { isFiat } from "../../lib/adapters";
import { currencyName } from "../../lib/currencies";
import { networkLabel, networksFor } from "../../lib/networks";
import { currencyOptions, optionsForRoutes } from "../../lib/walletOptions";
import { useSiteFeatures } from "../../lib/useSiteFeatures";
import WalletSelect from "./CurrencySelect";
import QrCode from "./QrCode";

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
 * - **Crypto** wants CCPayment: `GET /user/crypto/chains` for the networks and
 *   the provider for an address. Both answer `CRYPTO_PROVIDER_DISABLED` until
 *   `CCPAYMENT_*` is set, so the address and QR render behind the reference's
 *   own `Deposit_contentBlur` with the reason stated. Inventing an address
 *   would be inventing somewhere for real money to go.
 *
 * - **Fiat** is a bank transfer: `GET /user/bank-details/:coin` publishes where
 *   to send it and `POST /user/deposits/fiat` files the claim. Both work today,
 *   so that path is fully wired.
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
 * The whole control is built whether or not a provider answers, because the
 * shape of the screen is not conditional on configuration. Networks come from
 * `GET /user/crypto/chains` when CCPayment is configured and from
 * `lib/networks.js` when it is not — those are public facts about the asset, so
 * the picker works either way.
 *
 * **The address is the one field that is never filled in from nothing.** It is
 * issued per player by the provider; a plausible-looking string here would be
 * somewhere a real deposit could go and never come back. So it renders empty
 * with the reason stated, and everything around it is finished.
 */
function CryptoDeposit({ coin, currencySelect }) {
  const { data: chains } = useApi("wallet:chains", () => funding.chains());

  /** The live list when the provider answers, the static one otherwise. */
  const live = Array.isArray(chains) && chains.length
    ? chains.map((c) => ({ value: c.chain || c.symbol, label: c.chainFullName || c.chain }))
    : null;
  const options = live || networksFor(coin);

  const [network, setNetwork] = useState("");
  const active = network || options[0]?.value || "";

  /**
   * The address, once the provider issues one.
   *
   * There is no route to ask for it on this deployment — `crypto/chains` and
   * the address share the CCPayment client — so this stays empty and the field
   * shows why. Wiring it is a one-line change here once the route exists.
   */
  const address = "";

  return (
    <>
      {/* One wrapper holds both selects — the reference's grid measures 156px,
          which is two 66px fields plus its 16px gap, not one field per wrapper. */}
      <div className="CurrencyNetworkSelectOptionsWrapper_root">
        {currencySelect}
        <WalletSelect label="Network*" options={options} value={active} onChange={setNetwork} />
      </div>

      <div className="Deposit_inputWrapper">
        {/* `Ethereum (ERC20) Address` — the coin's name and the chosen network,
            the way the live modal captions it. */}
        <CopyField
          label={`${currencyName(coin)} (${active}) Address`}
          value={address}
          disabled={!address}
        />
        {/* The reference's own line, and the only message this row carries.
            Nothing here explains this deployment's configuration — that belongs
            in `docs/MISSING-AND-UNWIRED.md`, not in a player's wallet. */}
        <Warning>
          Your deposit must be sent on the {networkLabel(coin, active)} network to be
          processed.
        </Warning>
      </div>

      <QrCode value={address} />
    </>
  );
}

/** Fiat: the operator's bank details, then a claim with the transfer reference. */
function FiatDeposit({ coin }) {
  const { data: accounts, loading } = useApi(`wallet:bank:${coin}`, () => funding.bankDetails(coin));
  const account = accounts?.[0] || null;

  const [form, setForm] = useState({ amount: "", transactionId: "" });
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
        disabled={busy || !form.amount || !form.transactionId}
        className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary"
        onClick={submit}
      >
        <span className="ButtonVariants_buttonContent">{busy ? "Submitting…" : "I have paid"}</span>
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
  const { manual, automatic } = depositRoutes();

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
          <FiatDeposit coin={coin} />
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
