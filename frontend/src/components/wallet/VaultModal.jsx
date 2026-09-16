import { useEffect, useMemo, useState } from "react";

import { useSession } from "../../lib/sessionContext";
import WalletSelect, { CoinIcon } from "./CurrencySelect";
import { useApi } from "../../lib/useResource";
import { currencyOptions } from "../../lib/walletOptions";
import { displayBalance } from "../../lib/adapters";
import { vault as vaultApi } from "../../lib/endpoints";
import Modal from "../ui/Modal";

/**
 * The vault modal — reference `VaultModal`, opened from the account menu.
 *
 * Read off the live signed-in modal, which is three fields and a button and
 * nothing else: a direction select, a currency select, an amount with a Max
 * suffix, and the submit. There is no lock-period picker, no deposit list and
 * no history tab — an earlier pass invented all three and they are gone.
 *
 * The shell is the wallet modal's: `GlobalModal_walletModalBody` (540px on
 * `--color-gray900`), `ModalContent_modalContent` supplying the 40px inset.
 *
 * ── THE BACKEND VAULT IS NOT THIS VAULT ──────────────────────────────────
 *
 * The reference vault is a flat balance. This backend's is the older
 * fixed-term product: `transfer-in` opens a deposit against a lock period, and
 * `transfer-out` closes one whole deposit by id. Neither maps onto a single
 * amount field, so the bridge is made explicit here rather than hidden:
 *
 * - In  — the shortest active lock term is used. It is the closest thing the
 *   backend has to "no term", and the reference gives the player no way to
 *   choose one.
 * - Out — matured deposits are closed oldest first until the requested amount
 *   is covered. A deposit closes whole (the route takes an id, not an amount),
 *   so the last one may return more than was asked for; anything still locked
 *   is left alone, and the request is refused up front if the matured total is
 *   short.
 */

const DIRECTIONS = [
  { value: "transfer-in", label: "Transfer In", iconSrc: "/icons/transfer-in.svg" },
  { value: "transfer-out", label: "Transfer Out", iconSrc: "/icons/transfer-out.svg" },
];

export default function VaultModal({ onClose }) {
  const { balances, currency: headerCurrency, displayCurrency, rates, refreshBalances } = useSession();
  const [direction, setDirection] = useState("transfer-in");
  const [coin, setCoin] = useState(headerCurrency);
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  const options = useMemo(
    () => currencyOptions(balances, { displayCurrency, rates }),
    [balances, displayCurrency, rates]
  );

  const { data: lockOptions } = useApi("vault:lock-options", () => vaultApi.lockOptions());
  const { data: vaultData } = useApi(`vault:data:${coin}:${nonce}`, () => vaultApi.data(coin));

  const walletBalance = balances?.[coin] ?? "0";
  const vaultBalance = vaultData?.totals?.[coin] ?? "0";
  const available = direction === "transfer-in" ? walletBalance : vaultBalance;

  /** Matured deposits for this coin, oldest first — what a transfer out can draw on. */
  const matured = useMemo(
    () =>
      (vaultData?.deposits ?? [])
        .filter((d) => d.coin === coin && !d.locked && Number(d.balance) > 0)
        .sort((a, b) => a.depositId - b.depositId),
    [vaultData, coin]
  );

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      if (direction === "transfer-in") {
        const term = lockOptions?.[0];
        if (!term) throw new Error("The vault is not accepting transfers right now.");
        await vaultApi.transferIn({ coin, amount, lockPeriod: term.value });
      } else {
        const wanted = Number(amount);
        const total = matured.reduce((sum, d) => sum + Number(d.balance), 0);
        if (!(total >= wanted)) {
          throw new Error("Not enough matured vault balance. Locked deposits cannot be withdrawn yet.");
        }
        let covered = 0;
        for (const deposit of matured) {
          if (covered >= wanted) break;
          // Sequential on purpose: each close credits the wallet, and the next
          // one must see that — they cannot overlap.
          await vaultApi.transferOut({ depositId: deposit.depositId, coin });
          covered += Number(deposit.balance);
        }
      }

      setAmount("");
      setNonce((n) => n + 1);
      await refreshBalances?.();
    } catch (err) {
      setError(err?.message || "That did not go through.");
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <Modal onClose={onClose} label="Vault" bodyClass="GlobalModal_walletModalBody">
      <form className="VaultModal_form" onSubmit={submit}>
        <h1 className="VaultModal_header">Vault</h1>

        <WalletSelect
          label="Direction*"
          variant="plain"
          options={DIRECTIONS}
          value={direction}
          disabled={pending}
          onChange={(next) => {
            setDirection(next);
            setAmount("");
            setError(null);
          }}
        />

        <WalletSelect
          label="Currency"
          options={options}
          value={coin}
          disabled={pending}
          onChange={(next) => {
            setCoin(next);
            setAmount("");
            setError(null);
          }}
        />

        <div className="CurrencyInput_formControlWrapper">
          <div className="LabelBlock_root CurrencyInputRawLabel_labelBlock">
            <p className="CurrencyInputRawLabel_labelLeft"><span>Amount*</span></p>
            <p className="CurrencyInputRawLabel_labelRight">
              {displayBalance(available, coin)} {coin}
            </p>
          </div>
          <div className="InputWrapper_root">
            {/* The live modal marks this field with the *display*
                currency, not the selected coin — the amount beside it is
                already the coin's own balance. */}
            <div className="CurrencyInput_currencyInputIcon">
              <CoinIcon code={displayCurrency || coin} />
            </div>
            <div className="CurrencyInput_currencyInput">
              <input
                className="Input_root CurrencyInputElement_root"
                inputMode="decimal"
                placeholder="Enter Value"
                value={amount}
                disabled={pending}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <span className="InputSuffix_root">
              <button
                type="button"
                className="SuffixButton_suffixButtonWrapper"
                disabled={pending}
                onClick={() => setAmount(String(available))}
              >
                Max
              </button>
            </span>
          </div>
        </div>

        {error && (
          <div className="WarningMessage_container">
            <img alt="warning" className="WarningMessage_icon" src="/icons/exclamation.svg" />
            <span className="WarningMessage_content">{error}</span>
          </div>
        )}

        <div className="VaultModal_footer">
          <button
            type="submit"
            className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary"
            disabled={pending || !Number(amount)}
          >
            <span className="ButtonVariants_buttonContent">
              {direction === "transfer-in" ? "Transfer to Vault" : "Withdraw from Vault"}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
