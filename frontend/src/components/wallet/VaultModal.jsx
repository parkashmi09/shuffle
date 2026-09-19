import { useEffect, useMemo, useState } from "react";

import { useSession } from "../../lib/sessionContext";
import WalletSelect, { CoinIcon } from "./CurrencySelect";
import { useApi } from "../../lib/useResource";
import { currencyOptions } from "../../lib/walletOptions";
import { displayBalance } from "../../lib/adapters";
import { MASKED_AMOUNT } from "../../lib/playerPreferences";
import { ApiError } from "../../lib/api";
import { vault as vaultApi } from "../../lib/endpoints";
import Modal from "../ui/Modal";

const DIRECTIONS = [
  { value: "transfer-in", label: "Transfer In", iconSrc: "/icons/transfer-in.svg" },
  { value: "transfer-out", label: "Transfer Out", iconSrc: "/icons/transfer-out.svg" },
];

const WITHDRAW_MODES = [
  { value: "standard", label: "After lock period (full balance + interest)" },
  { value: "early", label: "Early exit (penalty applies, no interest)" },
];

const coinsMatch = (a, b) => String(a ?? "").toUpperCase() === String(b ?? "").toUpperCase();

function depositBalance(deposit) {
  const raw = deposit.balance ?? deposit.principal ?? deposit.vaultBalance ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Spendable amount for a locked deposit on early exit (API value or local estimate). */
function earlyPayoutAmount(deposit, lockOptions) {
  if (deposit.earlyPayout != null && deposit.earlyPayout !== "") {
    const fromApi = Number(deposit.earlyPayout);
    if (fromApi > 0) return fromApi;
  }
  const principal = depositBalance(deposit);
  if (!principal) return 0;
  let rate = Number(deposit.earlyPenaltyRate ?? 0);
  if (!rate && deposit.lockPeriod && lockOptions?.length) {
    const term = lockOptions.find((t) => t.value === deposit.lockPeriod);
    rate = Number(term?.earlyPenaltyRate ?? 0);
  }
  const penalty = principal * (Math.min(100, Math.max(0, rate)) / 100);
  return Math.max(0, principal - penalty);
}

function isLocked(deposit) {
  if (deposit?.locked === true || deposit?.locked === "true") return true;
  if (deposit?.locked === false || deposit?.locked === "false") return false;
  if (!deposit?.endTime) return false;
  return new Date(deposit.endTime).getTime() > Date.now();
}

function vaultTotalForCoin(totals, coinCode) {
  if (!totals || typeof totals !== "object") return 0;
  const key = Object.keys(totals).find((k) => coinsMatch(k, coinCode));
  if (!key) return 0;
  const n = Number(totals[key]);
  return Number.isFinite(n) ? n : 0;
}

function VaultHoverInfo({ text }) {
  if (!text) return null;

  return (
    <span className="VaultModal_infoWrap">
      <button type="button" className="VaultModal_infoBtn" aria-label="Withdrawal information">
        <img alt="" width="16" height="16" src="/icons/info.svg" />
      </button>
      <span role="tooltip" className="VaultModal_infoTooltip">
        {text}
      </span>
    </span>
  );
}

export default function VaultModal({ onClose }) {
  const { balances, currency: headerCurrency, displayCurrency, rates, refreshBalances, fiatView, hideZeroBalances, hideBalance } =
    useSession();
  const [direction, setDirection] = useState("transfer-in");
  const [withdrawMode, setWithdrawMode] = useState("standard");
  const [lockPeriod, setLockPeriod] = useState("");
  const [coin, setCoin] = useState(headerCurrency);
  const [amount, setAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

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

  const { data: lockOptions } = useApi("vault:lock-options", () => vaultApi.lockOptions());
  const { data: vaultData } = useApi(`vault:data:${nonce}`, () => vaultApi.data());

  const lockPeriodOptions = useMemo(
    () =>
      (lockOptions ?? []).map((term) => ({
        value: term.value,
        label: term.label,
        right: term.rate ? `${term.rate}% / yr` : undefined,
      })),
    [lockOptions]
  );

  useEffect(() => {
    if (!lockPeriod && lockOptions?.length) {
      setLockPeriod(lockOptions[0].value);
    }
  }, [lockOptions, lockPeriod]);

  const walletBalance = balances?.[coin] ?? "0";

  const depositsForCoin = useMemo(
    () => (vaultData?.deposits ?? []).filter((d) => coinsMatch(d.coin, coin)),
    [vaultData, coin]
  );

  const matured = useMemo(
    () =>
      depositsForCoin
        .filter((d) => !isLocked(d) && depositBalance(d) > 0)
        .sort((a, b) => (a.depositId ?? a.id) - (b.depositId ?? b.id)),
    [depositsForCoin]
  );

  const lockedEarly = useMemo(
    () =>
      depositsForCoin
        .filter((d) => isLocked(d) && earlyPayoutAmount(d, lockOptions) > 0)
        .sort((a, b) => (a.depositId ?? a.id) - (b.depositId ?? b.id)),
    [depositsForCoin, lockOptions]
  );

  const withdrawPool = useMemo(() => {
    if (direction !== "transfer-out") return [];

    if (withdrawMode === "standard") {
      return matured.map((deposit) => ({
        deposit,
        early: false,
        payout: depositBalance(deposit),
      }));
    }

    const standard = matured.map((deposit) => ({
      deposit,
      early: false,
      payout: depositBalance(deposit),
    }));
    const early = lockedEarly.map((deposit) => ({
      deposit,
      early: true,
      payout: earlyPayoutAmount(deposit, lockOptions),
    }));

    return [...standard, ...early].sort(
      (a, b) => (a.deposit.depositId ?? a.deposit.id) - (b.deposit.depositId ?? b.deposit.id)
    );
  }, [direction, withdrawMode, matured, lockedEarly, lockOptions]);

  const withdrawableTotal = useMemo(() => {
    if (direction !== "transfer-out") return 0;

    if (withdrawMode === "standard") {
      const fromDeposits = matured.reduce((sum, d) => sum + depositBalance(d), 0);
      return fromDeposits > 0 ? fromDeposits : vaultTotalForCoin(vaultData?.totals, coin);
    }

    let sum = 0;
    for (const d of depositsForCoin) {
      sum += isLocked(d) ? earlyPayoutAmount(d, lockOptions) : depositBalance(d);
    }
    if (sum > 0) return sum;
    return vaultTotalForCoin(vaultData?.totals, coin);
  }, [direction, withdrawMode, matured, depositsForCoin, vaultData?.totals, coin, lockOptions]);

  const availableTotal = useMemo(
    () => withdrawPool.reduce((sum, row) => sum + row.payout, 0) || withdrawableTotal,
    [withdrawPool, withdrawableTotal]
  );

  const available =
    direction === "transfer-in"
      ? walletBalance
      : availableTotal > 0
        ? String(availableTotal)
        : "0";

  const selectedTerm = lockOptions?.find((t) => t.value === lockPeriod);

  const withdrawInfoText = useMemo(() => {
    if (direction !== "transfer-out") return "";

    if (withdrawMode === "standard") {
      return "Only deposits that have finished their lock period can be withdrawn this way. You receive the full vault balance, including interest earned while locked.";
    }

    const operatorTerms =
      lockOptions
        ?.map(
          (t) =>
            `${t.label}: ${t.earlyPenaltyRate ?? "0"}% of your original deposit is deducted by the operator`
        )
        .join(". ") ?? "";

    const yourLocked =
      lockedEarly.length > 0
        ? lockedEarly
            .map((d) => {
              const label =
                lockOptions?.find((t) => t.value === d.lockPeriod)?.label ?? d.lockPeriod;
              return `${label}: you would receive up to ${displayBalance(earlyPayoutAmount(d, lockOptions), coin)} ${coin} (${d.earlyPenaltyRate}% principal deduction, interest forfeited)`;
            })
            .join(". ")
        : "";

    return [
      "Early exit withdraws locked funds before maturity. Accrued interest is not paid.",
      "The operator sets how much of your original deposit is deducted (principal penalty) for each lock period.",
      operatorTerms,
      yourLocked,
    ]
      .filter(Boolean)
      .join(" ");
  }, [direction, withdrawMode, lockOptions, lockedEarly, coin]);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      if (direction === "transfer-in") {
        if (!lockPeriod) throw new Error("Choose a lock period.");
        await vaultApi.transferIn({
          coin: String(coin).trim().toUpperCase(),
          amount,
          lockPeriod,
        });
      } else {
        const wanted = Number(amount);
        const total = withdrawPool.reduce((sum, row) => sum + row.payout, 0);
        if (!(total >= wanted)) {
          if (withdrawMode === "early") {
            throw new Error(
              "Not enough vault balance for an early withdrawal. Enable early exit on lock terms in admin or lower the amount."
            );
          }
          throw new Error("Not enough matured vault balance. Locked deposits cannot be withdrawn yet.");
        }

        let covered = 0;
        for (const row of withdrawPool) {
          if (covered >= wanted) break;
          const depositId = row.deposit.depositId ?? row.deposit.id;
          if (!depositId) throw new Error("Could not identify the vault deposit. Refresh and try again.");
          await vaultApi.transferOut({
            depositId,
            coin: String(coin).trim().toUpperCase(),
            early: Boolean(row.early),
          });
          covered += row.payout;
        }
      }

      setAmount("");
      setNonce((n) => n + 1);
      await refreshBalances?.();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err?.message || "That did not go through.";
      setError(message);
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
    <Modal
      onClose={onClose}
      label="Vault"
      bodyClass="GlobalModal_walletModalBody GlobalModal_vaultModalBody"
    >
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
            if (next === "transfer-in") setWithdrawMode("standard");
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

        {direction === "transfer-in" && lockPeriodOptions.length > 0 && (
          <WalletSelect
            label="Lock period*"
            options={lockPeriodOptions}
            value={lockPeriod}
            disabled={pending}
            onChange={(next) => {
              setLockPeriod(next);
              setError(null);
            }}
          />
        )}

        {direction === "transfer-in" && selectedTerm && (
          <p className="VaultModal_note">
            Funds stay locked for {selectedTerm.days} day{selectedTerm.days === 1 ? "" : "s"} at{" "}
            {selectedTerm.rate}% annual interest. Early exit may be available with a penalty set by
            the operator.
          </p>
        )}

        {direction === "transfer-out" && (
          <>
            <div className="VaultModal_labelWithInfo">
              <div className="LabelBlock_root">
                <span className="Label_root">Withdrawal type*</span>
              </div>
              <VaultHoverInfo text={withdrawInfoText} />
            </div>
            <WalletSelect
              variant="plain"
              options={WITHDRAW_MODES}
              value={withdrawMode}
              disabled={pending}
              onChange={(next) => {
                setWithdrawMode(next);
                setAmount("");
                setError(null);
              }}
            />
          </>
        )}

        <div className="CurrencyInput_formControlWrapper">
          <div className="LabelBlock_root CurrencyInputRawLabel_labelBlock">
            <p className="CurrencyInputRawLabel_labelLeft"><span>Amount*</span></p>
            <p className="CurrencyInputRawLabel_labelRight">
              {hideBalance ? MASKED_AMOUNT : `${displayBalance(available, coin)} ${coin}`}
            </p>
          </div>
          <div className="InputWrapper_root">
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
            disabled={pending || !Number(amount) || (direction === "transfer-in" && !lockPeriod)}
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
