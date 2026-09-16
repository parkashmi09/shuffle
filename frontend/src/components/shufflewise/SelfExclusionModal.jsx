import { useMemo, useState } from "react";

import { useSession } from "../../lib/sessionContext";
import { navigate } from "../../lib/router";
import WalletSelect from "../wallet/CurrencySelect";
import {
  BREAK_PERIODS,
  EXCLUSION_TYPES,
  createCooldown,
  createSelfExclusion,
  endOf,
} from "../../lib/shuffleWise";
import Modal from "../ui/Modal";

/**
 * The dialog behind Continue / Modify — reference `SelfExclusionModal`.
 *
 * Step 1 is the 24 hour cooldown: the break period is fixed and shown as a
 * read-only field. Step 2 is the break itself, where the period becomes a
 * select and runs from 24 hours to permanent.
 *
 * Every confirmation line is a checkbox and the submit stays disabled until all
 * of them are ticked — which is the reference's rule, not an embellishment:
 * `eE = eu.every(e => watch(e.value))`.
 *
 * Which lines appear depends on the form's own type, not on the step alone. A
 * platform break swaps "you can still sign in and withdraw" for "you will be
 * logged out immediately", and drops the bets line, because the whole account
 * is what is closing.
 */

/** `Sports & Casino` in step 1, `Platform` in step 2. */
function typeLabel(type, step) {
  if (type === EXCLUSION_TYPES.CASINO) return "Casino";
  if (type === EXCLUSION_TYPES.SPORTS) return "Sports";
  return step === "STEP1" ? "Sports & Casino" : "Platform";
}

/** `12/09/2026` — the short date the reference prints in these fields. */
const shortDate = (value) =>
  new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });

/** A confirmation line: the reference's `Checkbox` inside its own label. */
function ConfirmLine({ id, label, checked, onChange }) {
  return (
    <label className="Checkbox_root SelfExclusionCheckbox_checkboxText" htmlFor={id}>
      <input
        id={id}
        className="Checkbox_checkboxInput"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="Checkbox_checkboxCheckMark" />
      <div className="Relative_root">{label}</div>
    </label>
  );
}

/** A field the player reads but cannot change — reference `Input variant="outline" readOnly`. */
function ReadOnlyField({ label, value }) {
  return (
    <div className="FormControlWrapper_root">
      <div className="LabelBlock_root">
        <label className="Label_root">{label}</label>
      </div>
      <div className="InputWrapper_root">
        <input readOnly className="Input_root Input_outline" value={value} style={{ color: "var(--color-gray200)" }} />
      </div>
    </div>
  );
}

export default function SelfExclusionModal({ step, isModify, prevSelfExclusion, prevCooldownType, onDone, onClose }) {
  const { logout } = useSession();
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [ticks, setTicks] = useState({});

  // Step 2 keeps the type the cooldown covered; step 1 offers all three,
  // except when there is already a break running, which forces PLATFORM.
  const typeOptions = useMemo(() => {
    const all = [
      { value: EXCLUSION_TYPES.CASINO, label: typeLabel(EXCLUSION_TYPES.CASINO, step) },
      { value: EXCLUSION_TYPES.SPORTS, label: typeLabel(EXCLUSION_TYPES.SPORTS, step) },
      { value: EXCLUSION_TYPES.PLATFORM, label: typeLabel(EXCLUSION_TYPES.PLATFORM, step) },
    ];
    const platformOnly = all.filter((o) => o.value === EXCLUSION_TYPES.PLATFORM);
    if (step === "STEP1") return isModify || prevSelfExclusion ? platformOnly : all;
    if (prevCooldownType === EXCLUSION_TYPES.PLATFORM) return prevSelfExclusion ? platformOnly : all;
    return all.filter((o) => o.value === prevCooldownType);
  }, [step, isModify, prevSelfExclusion, prevCooldownType]);

  const [type, setType] = useState(typeOptions[0]?.value);
  const [period, setPeriod] = useState(BREAK_PERIODS[0].value);

  const platformBreak = step === "STEP2" && type === EXCLUSION_TYPES.PLATFORM;
  const stage = step === "STEP1" ? "Cooldown" : "Self-exclusion";
  const spec = BREAK_PERIODS.find((p) => p.value === period) || BREAK_PERIODS[0];
  // Read once, when the dialog opens: both dates are relative to "now", and a
  // clock read during render would move on every keystroke.
  const [openedAt] = useState(() => Date.now());
  const startDate = `${shortDate(openedAt)} (Today)`;
  const endLabel = spec.unit === "PERMANENT" ? "Permanent" : `${shortDate(endOf(period, openedAt))} (${spec.label})`;

  // The lines this form must have ticked, in the reference's order.
  const lines = useMemo(() => {
    const out = [
      { id: "UNABLE_CANCEL", label: `I will STRICTLY NOT be able to cancel the ${stage}` },
    ];
    if (platformBreak) {
      out.push({ id: "UNABLE_ACCESS_ACCOUNT", label: "I will NOT be able to access my account and will be logged out immediately" });
    } else {
      out.push({ id: "ABLE_ACCESS_ACCOUNT", label: "I will still be able to access my account and make withdrawals." });
      out.push({ id: "UNABLE_PLACE_BETS", label: `I will NOT be able to place bets in ${typeLabel(type, step)}` });
    }
    out.push({
      id: "START_IMMEDIATELY",
      label: `My ${spec.label} ${typeLabel(type, step)} ${stage} will start immediately`,
    });
    return out;
  }, [platformBreak, stage, type, step, spec.label]);

  // Changing a field clears the ticks — the reference resets the whole form.
  const change = (setter) => (value) => {
    setTicks({});
    setter(value);
  };

  const ready = lines.every((line) => ticks[line.id]) && !pending;

  const submit = async (event) => {
    event.preventDefault();
    if (!ready) return;
    setPending(true);
    if (step === "STEP1") {
      createCooldown({ selfExclusionType: type });
    } else {
      createSelfExclusion({ selfExclusionType: type, breakPeriod: period });
    }
    onDone();
    if (platformBreak) {
      // The reference ends every session and drops the player on the lobby.
      // Nothing on this backend refuses the next sign-in, which is the whole
      // difference between this screen and a real self-exclusion.
      await logout();
      navigate("/");
      return;
    }
    setPending(false);
    setConfirmed(true);
  };

  return (
    <Modal onClose={onClose} label="Self-exclusion" bodyClass="SelfExclusionModal_modalBody">
      {confirmed ? (
        <div data-testid="self-exclusion-confirmed-modal" className="SelfExclusionConfirmationContent_root">
          <div>
            <div className="SelfExclusionConfirmationContent_iconContainer">
              <img src="/icons/self-exclusion-confirmation.svg" alt="self-exclusion-confirmation" />
            </div>
            <div className="SelfExclusionConfirmationContent_header">
              {step === "STEP1" ? "24 Hours Cooldown Confirmed" : "Self-exclusion confirmed"}
            </div>
          </div>
          <div className="ModalListContainer_root">
            <div className="ModalListContainer_item">
              <span className="ModalListContainer_label">Take a break from</span>
              <span className="ModalListContainer_value">{typeLabel(type, step)}</span>
            </div>
            <div className="ModalListContainer_item">
              <span className="ModalListContainer_label">Start date</span>
              <span className="ModalListContainer_value">{startDate}</span>
            </div>
            <div className="ModalListContainer_item">
              <span className="ModalListContainer_label">Break period</span>
              <span className="ModalListContainer_value">{endLabel}</span>
            </div>
          </div>
          <button
            type="button"
            className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary"
            onClick={onClose}
          >
            <span className="ButtonVariants_buttonContent">Done</span>
          </button>
        </div>
      ) : (
        <>
          <div className="SelfExclusionModal_header">
            Self-exclusion&nbsp;
            {step === "STEP1" && <span className="SelfExclusionModal_subheader">(24 Hours Cooldown)</span>}
          </div>
          <form data-testid="self-exclusion-form" className="SelfExclusionModal_form" onSubmit={submit}>
            {typeOptions.length === 1 ? (
              <ReadOnlyField label="Take a break from" value={typeLabel(type, step)} />
            ) : (
              <WalletSelect
                variant="plain"
                label="Take a break from"
                options={typeOptions}
                value={type}
                onChange={change(setType)}
              />
            )}

            <ReadOnlyField label="Start date" value={startDate} />

            {step === "STEP1" ? (
              <ReadOnlyField label="Break period" value={endLabel} />
            ) : (
              <WalletSelect
                variant="plain"
                label="Break period"
                options={BREAK_PERIODS.map((p) => ({ value: p.value, label: p.label }))}
                value={period}
                onChange={change(setPeriod)}
              />
            )}

            <div className="SelfExclusionCheckbox_checkboxContainer">
              <div>By clicking confirm, I understand that:</div>
              {lines.map((line) => (
                <ConfirmLine
                  key={line.id}
                  id={`se-${line.id}`}
                  label={line.label}
                  checked={Boolean(ticks[line.id])}
                  onChange={(value) => setTicks((current) => ({ ...current, [line.id]: value }))}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={!ready}
              className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary SelfExclusionModal_button"
            >
              <span className="ButtonVariants_buttonContent">Confirm self-exclusion</span>
            </button>

            <div className="SelfExclusionModal_cancelBtnWrapper">
              <button type="button" className="SelfExclusionModal_cancelBtn" disabled={pending} onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        </>
      )}
    </Modal>
  );
}
