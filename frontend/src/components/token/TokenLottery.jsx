import { useState } from "react";
import { cx } from "../../lib/carousel";
import { LINKS, SHFL } from "./tokenData";

/**
 * "Get perpetual entries in the largest lottery in crypto" — reference
 * `TokenLottery` + `TokenLotteryChart` + `TokenLotteryForm`.
 *
 * A blurb and a staked/available read on the left, a Stake / Unstake form on
 * the right. Both halves are `flex: 1 1 0%` inside `.TokenLottery_root`, so
 * whichever is taller sets the height of the block — which is why a wrong
 * control on the right shows up as a stretched left panel.
 *
 * ── THE STRUCTURE HERE IS THE LIVE PAGE'S, NOT AN APPROXIMATION ───────────
 *
 * An earlier pass built this from the class names alone and got both halves
 * wrong in ways that added 38px of height:
 *
 *   · The amount row was `MAX` as a full-width button UNDER the input. The
 *     reference puts three 32px buttons — `½`, `2x`, `Max` — INSIDE the field,
 *     in `span.InputSuffix_root > div.TokenLotteryForm_buttonGroup`, which is
 *     what `Input_hasRightIcon` leaves room for. That alone was +32px.
 *   · The submit was `buttonHeightLarge` (54px); the reference is
 *     `buttonHeightMedium` (48px). +6px.
 *   · The progress read was inverted: the amounts belong in the top `label`
 *     and the words "Staked" / "Available" in the `supportText` row beneath
 *     the bar, not the other way round.
 *   · The bar is `div.ProgressBarSection_customProgress`, not `<progress>`.
 *     With nothing staked it renders as an empty gray700 track; the filled
 *     state nests `customProgressWidth > customProgressLeft + Right`.
 *
 * Measured against the live block at 1536px: root 1184×345.6, each half
 * 591.2×344 at 24px padding, input group 400×152, submit 543×48.
 *
 * ── WHAT IS BUILT AND WHAT CANNOT BE ─────────────────────────────────────
 *
 * Staking moves SHFL out of a player's balance and locks it. There is no
 * staking module in any of the four services — no route to call, no lock to
 * record, nothing to unstake from — so the submit is `disabled`, which is what
 * the live form does with an incomplete one. The tabs, the amount field and
 * ½ / 2x / Max all work, because the shape of a screen is not conditional on
 * configuration; what it cannot do is submit.
 *
 * Two readings on this form are shape without a feed behind them, and neither
 * may be invented:
 *
 *   · The right label is the fiat value of the amount. There is no SHFL rate
 *     on this backend (`/user/exchange-rate/rates` carries 25 currencies and
 *     SHFL is not one), so it multiplies by the published price literal in
 *     `tokenData.js` and says USD — the same stale-by-construction figure the
 *     rest of the page prints, not a live conversion.
 *   · "Lottery Tickets" carries no count. Entries per staked SHFL is a rate
 *     this deployment does not know, and the live block shows the bare label
 *     on an empty field too, so it stays bare rather than guessing.
 *
 * ── THE UNSTAKE TAB IS NOT THE STAKE TAB WITH A DIFFERENT VERB ──────────
 *
 * Unstaking gives SHFL back and takes the lottery entries away, so the line
 * above the ticket count reads **"And forfeiting"**, not "To Receive" — the
 * same row, opposite meaning. Reported by the user against the live site; the
 * reference tab's renderer had frozen by then, so the rest of the unstake copy
 * here ("You're Unstaking", "Unstake SHFL") still follows the stake tab's
 * pattern rather than a measurement. Worth re-reading off the live form.
 *
 * The reference follows the submit with a `TokenLotteryConfirmModal` carrying
 * the terms checkbox and the unstake range. That is deliberately not built:
 * a confirmation dialog for a transfer that cannot happen is a dead end, and
 * building it would mean inventing the terms it asks a player to accept.
 */

const TABS = [
  { id: "stake", label: "Stake" },
  { id: "unstake", label: "Unstake" },
];

/** `$0.3071` → `0.3071`. See the note above on why this is a literal. */
const PRICE = Number(String(SHFL.price).replace(/[^0-9.]/g, "")) || 0;

export default function TokenLottery({ balance = "0.00" }) {
  const [tab, setTab] = useState("stake");
  const [amount, setAmount] = useState("");

  const typed = Number(amount) || 0;
  const available = Number(String(balance).replace(/,/g, "")) || 0;
  const scale = (by) => setAmount(typed ? String(Number((typed * by).toFixed(8))) : "");

  return (
    <section className="TokenLottery_root">
      <section className="TokenLotteryChart_lotteryView">
        <img className="TokenLotteryChart_icon" src="/icons/token-glow.svg" alt="" width="124" height="124" />
        <h4 className="TokenLotteryChart_heading">
          Get perpetual entries in the largest lottery in crypto!
        </h4>
        <p className="TokenLotteryChart_paragraph">
          By staking SHFL you receive perpetual lottery entries that are generated for you every
          week{" "}
          <a className="TextLink_root" href={LINKS.lottery} target="_blank" rel="noreferrer">
            Learn More
          </a>
        </p>
        <div className="TokenLotteryChart_percentageWrapper">
          <div className="ProgressBarSection_graph">
            <div className="ProgressBarSection_graphContent TokenLotteryChart_progressSectionContent">
              {/*
                The reference's own markup: a bare `<label>` with no control
                behind it, holding the two amounts. `.graphContent > label` is
                the selector that spaces them apart, so the element has to stay
                a label even though nothing is labelled.
              */}
              <label>
                <span className="TokenLotteryChart_tokenAmount">
                  <img src="/icons/token-large.svg" alt="" width="16" height="16" />0
                </span>
                <div className="ProgressBarSection_rightContainer">
                  <span className="TokenLotteryChart_tokenAmount">
                    <img src="/icons/token-large.svg" alt="" width="16" height="16" />
                    {balance}
                  </span>
                </div>
              </label>

              {/* Empty track: nothing is staked, and nothing can be. */}
              <div className="ProgressBarSection_progress">
                <div className="ProgressBarSection_customProgress" />
              </div>

              <p className="ProgressBarSection_supportText">
                <span>
                  <span className="TokenLotteryChart_footerText">Staked</span>
                </span>
                <span className="ProgressBarSection_tokenAmount">
                  <span className="TokenLotteryChart_footerText">Available</span>
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <form className="TokenLotteryForm_lotteryInput" onSubmit={(e) => e.preventDefault()}>
        <div className="Tab_root">
          <div className="Tab_tabsContainer" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                // The live page disables the selected tab rather than styling
                // it out of reach. Matched so the pressed state reads the same.
                disabled={tab === t.id}
                className={cx("Tab_tab", tab === t.id && "Tab_active")}
                onClick={() => setTab(t.id)}
              >
                <p className="Tab_text">{t.label}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="TokenLotteryForm_lotteryInputGroup">
          <div className="TextInput_formControlWrapper">
            <div className="TextInput_labelGroup">
              <div className="LabelBlock_root TextInput_labelBlock TextInput_hasRightLabel">
                <label className="TextInput_label" htmlFor="token-amount">
                  <span>{tab === "stake" ? "You're Staking" : "You're Unstaking"}</span>
                </label>
              </div>
              <span className="TokenLotteryForm_rightLabel">
                {(typed * PRICE).toFixed(2)} USD
              </span>
            </div>
            <div className="InputWrapper_root">
              <span className="TextInput_inputPrefix">
                <img src="/icons/token-large.svg" alt="" width="16" height="16" />
              </span>
              <input
                id="token-amount"
                className="Input_root Input_hasPrefix Input_hasRightIcon"
                inputMode="decimal"
                placeholder="Enter SHFL amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <span className="InputSuffix_root">
                <div className="TokenLotteryForm_buttonGroup">
                  <button
                    type="button"
                    aria-label="Halve amount"
                    className="ButtonVariants_root ButtonVariants_buttonHeightXSmall ButtonVariants_tertiary TokenLotteryForm_maxButton TokenLotteryForm_halfText"
                    onClick={() => scale(0.5)}
                  >
                    <span className="ButtonVariants_buttonContent">½</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Double amount"
                    className="ButtonVariants_root ButtonVariants_buttonHeightXSmall ButtonVariants_tertiary TokenLotteryForm_maxButton"
                    onClick={() => scale(2)}
                  >
                    <span className="ButtonVariants_buttonContent">2x</span>
                  </button>
                  <button
                    type="button"
                    // Disabled on an empty balance, as the live form is.
                    disabled={available <= 0}
                    className="ButtonVariants_root ButtonVariants_buttonHeightXSmall ButtonVariants_tertiary TokenLotteryForm_maxButton"
                    onClick={() => setAmount(String(available))}
                  >
                    <span className="ButtonVariants_buttonContent">Max</span>
                  </button>
                </div>
              </span>
            </div>
          </div>

          <section className="TokenLotteryForm_ticketAmountContainer">
            <p className="TokenLotteryForm_ticketAmountLabel">
              <span>{tab === "stake" ? "To Receive" : "And forfeiting"}</span>
              <span className="Tooltip_trigger">
                <img src="/icons/info.svg" alt="" width="16" height="16" />
              </span>
            </p>
            <p className="TokenLotteryForm_ticketAmount">
              <img src="/icons/lottery-amount-ticket.svg" alt="" width="16" height="16" />
              Lottery Tickets
            </p>
          </section>
        </div>

        <button
          type="submit"
          disabled
          className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary"
        >
          <span className="ButtonVariants_buttonContent">
            {tab === "stake" ? "Stake SHFL" : "Unstake SHFL"}
          </span>
        </button>
      </form>
    </section>
  );
}
