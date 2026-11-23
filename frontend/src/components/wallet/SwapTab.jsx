import { useEffect, useState } from "react";
import { displayBalance } from "../../lib/adapters";
import { currencyOptions } from "../../lib/walletOptions";
import { MASKED_AMOUNT } from "../../lib/playerPreferences";
import { swap } from "../../lib/endpoints";
import { useApi } from "../../lib/useResource";
import { useSession } from "../../lib/sessionContext";
import WalletSelect, { CoinIcon } from "./CurrencySelect";

const AMOUNT = /^\d+(\.\d{1,8})?$/;

/**
 * Swap — `GET /user/swap/estimate` for the server's quote (fee included), `POST /user/swap` to
 * trade, and the last 8 swaps below. Same form primitives as the Tip tab.
 */
export function SwapTab({ coin, onCoinChange, balances, displayCurrency, rates, fiatView = true, hideZeroBalances = false, hideBalance = false }) {
  const { refreshBalances } = useSession();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [quoted, setQuoted] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [nonce, setNonce] = useState(0);

  const common = { displayCurrency, rates, fiatEquivalent: fiatView, hideBalance };
  const fromOptions = currencyOptions(balances, { ...common, hideZeroBalances, keep: coin });
  const toOptions = currencyOptions(balances, common).filter((o) => o.value !== coin);
  const target = toOptions.some((o) => o.value === to) ? to : (toOptions[0]?.value ?? "");
  const available = balances?.[coin] ?? "0";
  const typed = amount.trim();
  const valid = AMOUNT.test(typed) && Number(typed) > 0 && Number(typed) <= Number(available) && Boolean(target);

  // One quote per pause in typing, not per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuoted(valid ? typed : ""), 400);
    return () => clearTimeout(t);
  }, [typed, valid]);

  const { data: quote, error: quoteError } = useApi(`swap:quote:${coin}:${target}:${quoted}`, () => swap.estimate(coin, target, quoted), {
    enabled: Boolean(quoted && target),
  });
  const { data: recent } = useApi(`swap:history:${nonce}`, () => swap.history({ limit: 8 }));

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const done = await swap.run(coin, target, typed);
      setStatus({ ok: true, message: `Swapped ${done.fromAmount} ${coin} for ${displayBalance(done.toAmount, target)} ${target}.` });
      setAmount("");
      refreshBalances?.();
      setNonce((n) => n + 1);
    } catch (error) {
      setStatus({ ok: false, message: error?.message || "Could not swap." });
    } finally {
      setBusy(false);
    }
  };

  const rows = Array.isArray(recent) ? recent : [];

  return (
    <form className="Tip_form" onSubmit={submit}>
      <WalletSelect label="From" options={fromOptions} value={coin} onChange={onCoinChange} />

      <div className="CurrencyInput_formControlWrapper">
        <div className="LabelBlock_root CurrencyInputRawLabel_labelBlock">
          <p className="CurrencyInputRawLabel_labelLeft"><span>Amount*</span></p>
          <p className="CurrencyInputRawLabel_labelRight">{hideBalance ? MASKED_AMOUNT : `${displayBalance(available, coin)} ${coin}`}</p>
        </div>
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
          <span className="InputSuffix_root">
            <button type="button" className="SuffixButton_suffixButtonWrapper" onClick={() => setAmount(String(available))}>
              Max
            </button>
          </span>
        </div>
      </div>

      {toOptions.length > 0 ? (
        <WalletSelect label="To" options={toOptions} value={target} onChange={setTo} />
      ) : (
        <span className="NoticeMessage_text">No other currency to swap into.</span>
      )}

      {quote && quoted === typed && (
        <div className="MiniList_root">
          <div className="MiniList_row">
            <span>You receive</span>
            <span className="IconValue_root">
              <CoinIcon code={target} />
              {displayBalance(quote.converted, target)} {target}
            </span>
          </div>
          <div className="MiniList_row MiniList_meta">
            <span>Fee ({(Number(quote.feePercentage) * 100).toFixed(2)}%)</span>
            <span>{quote.feeAmount} {coin}</span>
          </div>
        </div>
      )}
      {quoteError && quoted === typed && <span className="NoticeMessage_text" style={{ color: "var(--color-warning)" }}>{quoteError.message}</span>}

      {status && (
        <div className="NoticeMessage_root" role={status.ok ? "status" : "alert"}>
          <span className="NoticeMessage_text" style={{ color: status.ok ? "var(--color-success)" : "var(--color-warning)" }}>{status.message}</span>
        </div>
      )}

      <button type="submit" disabled={!valid || busy} className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary Tip_button">
        <span className="ButtonVariants_buttonContent">{busy ? "Swapping…" : "Swap"}</span>
      </button>

      {rows.length > 0 && (
        <div className="MiniList_root">
          <h5 className="MiniList_heading">Recent swaps</h5>
          {rows.map((r) => (
            <div key={r.id} className="MiniList_row">
              <span>
                {r.from_amount} {r.from_currency} → {displayBalance(r.to_amount, r.to_currency)} {r.to_currency}
              </span>
              <span className="MiniList_meta">{new Date(r.created_at ?? r.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </form>
  );
}
