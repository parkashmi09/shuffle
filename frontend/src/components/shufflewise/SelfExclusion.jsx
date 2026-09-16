import { useCallback, useEffect, useState } from "react";
import { cx } from "../../lib/carousel";
import SupportChatPrompt from "../ui/SupportChatPrompt";
import SelfExclusionModal from "./SelfExclusionModal";
import { activeSelfExclusions, isPermanent, EXCLUSION_TYPES } from "../../lib/shuffleWise";

/**
 * Shuffle Wise → Self-exclusion — reference `ResponsibleGambling`.
 *
 * Two steps, always both on screen: a fixed 24 hour cooldown, and — once that
 * cooldown has run out, within the 24 hours that follow — the break itself.
 *
 * ── WHAT THE STATE MACHINE IS ────────────────────────────────────────────
 *
 * The rows the reference reads split by one field. A row carrying
 * `selfExclusionCooldownUntilAt` is the cooldown; a row without one is the
 * self-exclusion. From those two:
 *
 *   • a cooldown exists           → both cards dim, the copy is replaced by the
 *                                   countdown band
 *   • the cooldown has run out    → step 1 gets the green tick, step 2 lights
 *                                   back up and the button starts step 2
 *   • cooldown running, not
 *     PLATFORM                    → the button says Modify (change the type,
 *                                   which restarts the 24 hours)
 *   • cooldown running, PLATFORM  → the button is disabled; there is nothing
 *                                   left to change
 *
 * Nothing here is enforced — see `lib/shuffleWise.js`. The screen is real; the
 * block behind it is not, because no service has one.
 */

/** `Sports & Casino` in step 1, `Platform` in step 2 — the reference's own split. */
function typeLabel(type, step) {
  if (type === EXCLUSION_TYPES.CASINO) return "Casino";
  if (type === EXCLUSION_TYPES.SPORTS) return "Sports";
  return step === "STEP1" ? "Sports & Casino" : "Platform";
}

/** Which of the fixed labels a finished break's length rounds to. */
function periodLabel(createdAt, until) {
  const days = (new Date(until) - new Date(createdAt)) / 86400000;
  if (days <= 1) return "24 Hours";
  if (days <= 7) return "1 Week";
  if (days <= 31) return "1 Month";
  if (days <= 186) return "6 Months";
  return "Permanent";
}

function remaining(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

/** The green band above the cards, red when the break never ends. */
function Countdown({ row, cooldownType, now }) {
  const permanent = isPermanent({ startDate: row.createdAt, endDate: row.selfExclusionUntilAt });
  const step = cooldownType ? "STEP1" : "STEP2";
  const stage = step === "STEP1" ? "Cooldown" : "Self-exclusion";
  const label = typeLabel(cooldownType ?? row.selfExclusionType, step);

  if (permanent) {
    return (
      <div className="SelfExclusionCountdown_timerContainer SelfExclusionCountdown_timerPermanent">
        <div className="SelfExclusionCountdown_timerCooldown SelfExclusionCountdown_timerCooldownPermanent">
          {`${label} ${stage} - Permanent`}
        </div>
      </div>
    );
  }

  const left = Math.floor((new Date(row.selfExclusionUntilAt) - now) / 1000);
  if (left <= 0) return null;
  return (
    <div className="SelfExclusionCountdown_timerContainer">
      <div className="SelfExclusionCountdown_timerCooldown">
        {`${label} ${periodLabel(row.createdAt, row.selfExclusionUntilAt)} ${stage} - ${remaining(left)}`}
      </div>
    </div>
  );
}

/** One of the two numbered steps — reference `ResponsibleGamblingInstructionCard`. */
function InstructionCard({ title, description, icon, alt, iconColor, dimText, dimIcon }) {
  return (
    <div className="ResponsibleGamblingInstructionCard_cardWrapper">
      <div
        className={cx("ResponsibleGamblingInstructionCard_iconWrapper", dimIcon && "ResponsibleGamblingInstructionCard_dimmed")}
        style={iconColor ? { backgroundColor: iconColor } : undefined}
      >
        <img src={icon} alt={alt} />
      </div>
      <div className={cx("ResponsibleGamblingInstructionCard_cardContentWrapper", dimText && "ResponsibleGamblingInstructionCard_dimmed")}>
        <p>{title}</p>
        <p className="ResponsibleGamblingInstructionCard_descriptionText">{description}</p>
      </div>
    </div>
  );
}

export default function SelfExclusion() {
  const [rows, setRows] = useState(() => activeSelfExclusions());
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const refetch = useCallback(() => setRows(activeSelfExclusions()), []);

  const exclusion = rows.find((r) => r.selfExclusionCooldownUntilAt === null);
  const cooldowns = rows.filter((r) => r.selfExclusionCooldownUntilAt !== null);
  const cooldown = cooldowns[0];
  const hasCooldown = cooldown !== undefined;

  // Which type step 2 is allowed to cover: whatever the cooldown covered,
  // unless a self-exclusion is already running, which forces PLATFORM.
  const cooldownType = cooldowns.length
    ? (exclusion || cooldowns.length > 1 ? EXCLUSION_TYPES.PLATFORM : cooldowns[0].selfExclusionType)
    : undefined;

  const cooldownDone = hasCooldown && now > new Date(cooldown.selfExclusionUntilAt).getTime();
  const isModify = hasCooldown && !cooldownDone && cooldownType !== EXCLUSION_TYPES.PLATFORM;
  const disabled = cooldownType === EXCLUSION_TYPES.PLATFORM && !cooldownDone;

  return (
    <div data-testid="shuffle-wise-tab-content-section" className="ShuffleWiseLayoutWithSupport_root">
      <form className="Panel_panelWrapper" onSubmit={(event) => event.preventDefault()}>
        <h2 className="Panel_panelHeading">Taking a break from gambling</h2>
        <div className="ResponsibleGambling_selfExclusionWrapper">
          {exclusion && <Countdown key={exclusion.id} row={exclusion} now={now} />}
          {cooldown && <Countdown key={cooldown.id} row={cooldown} cooldownType={cooldownType} now={now} />}

          {rows.length === 0 && (
            <div className="ResponsibleGambling_descriptionWrapper">
              <p>Shuffle is committed to providing you with a safe, enjoyable, and responsible gaming environment.</p>
              <p>
                To enhance your gaming experience you can choose to take a break or give yourself some time away
                from gambling. Your break will start immediately once confirmed and it is non-reversible.
              </p>
              <p>Our safe gambling process is detailed below:</p>
            </div>
          )}

          {cooldownDone && cooldownType && (
            <div className="ResponsibleGambling_descriptionWrapper">
              {`You have another 24 hours to extend your ${typeLabel(cooldownType, "STEP2")} self-exclusion before it resets the cooldown period and you have to initiate the process again.`}
            </div>
          )}

          <InstructionCard
            title="Step 1: Take a 24 Hour Cooldown"
            description="Take a 24 hour cooldown from betting from sports, casino, or both. You will still be able to access the platform and you can earn and claim rewards. During the 24 hours, you can change the type of cooldown but this will reset the 24 hour timer."
            icon={cooldownDone ? "/icons/self-exclusion-step1-tick.svg" : "/icons/self-exclusion-step1.svg"}
            alt="self-exclusion-step1"
            iconColor={cooldownDone ? "#03220F" : ""}
            dimText={hasCooldown}
            dimIcon={hasCooldown && !cooldownDone}
          />

          <InstructionCard
            title="Step 2: Self-Exclusion"
            description="After your 24 hours cooldown ends, you have 24 hours to extend your self-exclusion period by 1 day, 1 week, 1 month, 6 months, or permanently. You could self-exclude from sports, casino or from the platform (If you self-exclude from the platform, you will not be able to log in). Self-exclusion is a STRICTLY IRREVERSIBLE process, NO ONE will be able to remove this for you."
            icon="/icons/self-exclusion-step2.svg"
            alt="self-exclusion-step2"
            dimText={hasCooldown && !cooldownDone}
            dimIcon={hasCooldown && !cooldownDone}
          />

          <div className="ResponsibleGambling_button">
            <button
              type="button"
              className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primary"
              disabled={disabled}
              onClick={() => setOpen(true)}
            >
              <span className="ButtonVariants_buttonContent">{isModify ? "Modify" : "Continue"}</span>
            </button>
          </div>
        </div>
      </form>

      <SupportChatPrompt />

      {open && (
        <SelfExclusionModal
          step={cooldownDone ? "STEP2" : "STEP1"}
          isModify={isModify}
          prevSelfExclusion={exclusion}
          prevCooldownType={cooldownType}
          onDone={refetch}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
