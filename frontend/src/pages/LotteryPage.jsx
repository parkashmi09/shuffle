import { useEffect, useRef, useState } from "react";
import { cx } from "../lib/carousel";
import howToPlayHtml from "../data/lottery-how-to-play.html?raw";

/**
 * SHFL Lottery page — a 1:1 port of the reference `/lottery` route:
 * hero, tab strip, and the Play / Tickets & Prizes / How To Play panels.
 */

const TICKET_ROWS = 10;
const ENTRY_TYPES = [
  { id: "standard", label: "Standard entry", price: "$0.25" },
  { id: "powerplay", label: "Powerplay entry", price: "$8.00", help: true },
];

/** Prize divisions for the current draw (reference values shown to guests). */
const divisions = [
  { name: "Jackpot", jackpot: true, prize: "₹197,286,653.30", balls: 5, pball: true },
  { name: "2nd", prize: "₹8,882,652.00", balls: 5 },
  { name: "3rd", prize: "₹8,882,652.00", balls: 4, pball: true },
  { name: "4th", prize: "₹8,882,652.00", balls: 4 },
  { name: "5th", prize: "₹8,142,431.00", balls: 3, pball: true },
  { name: "6th", prize: "₹8,142,431.00", balls: 3 },
  { name: "7th", prize: "₹11,103,315.00", balls: 2, pball: true },
  { name: "8th", prize: "₹8,142,431.00", balls: 1, pball: true },
  { name: "9th", prize: "₹8,142,431.00", balls: 0, pball: true },
];

const TABS = [
  { id: "play", label: "Play Lottery" },
  { id: "ticketsPrizes", label: "Tickets & Prizes" },
  { id: "howToPlay", label: "How To Play" },
];

function TicketWrapper({ title, disabled, headerClass, containerClass, contentClass, children }) {
  return (
    <section className={cx("LotteryTicketWrapper_root", disabled && "LotteryTicketWrapper_disabled")}>
      <header className={cx("LotteryTicketWrapper_header", headerClass)}>
        <h2 className="Heading_root Heading_h2">{title}</h2>
        <hr className="LotteryBorder_root LotteryBorder_small" />
      </header>
      <div className={cx("LotteryTicketWrapper_contentContainer", containerClass)}>
        <div className={cx("LotteryTicketWrapper_content", disabled && "LotteryTicketWrapper_disabled", contentClass)}>{children}</div>
      </div>
    </section>
  );
}

const IconButton = ({ variant, icon, alt, label, className, disabled, onClick }) => (
  <button
    type="button"
    className={cx("ButtonVariants_root ButtonVariants_buttonHeightSmall", variant, "ButtonVariants_hasIcon", className)}
    disabled={disabled}
    aria-label={label || alt}
    onClick={onClick}
  >
    <span className="ButtonVariants_buttonContent">
      <span className="ButtonIcon_root">
        <img alt={alt} src={icon} />
      </span>
      {label}
    </span>
  </button>
);

const randomTicket = () => {
  const nums = new Set();
  while (nums.size < 5) nums.add(1 + Math.floor(Math.random() * 42));
  return [...nums].sort((a, b) => a - b).concat(1 + Math.floor(Math.random() * 18));
};

function PlayPanel() {
  const [type, setType] = useState(null);
  const [entries, setEntries] = useState("");
  const [tickets, setTickets] = useState(() => Array.from({ length: TICKET_ROWS }, () => null));
  const count = Math.max(0, Math.min(TICKET_ROWS, Number(entries) || 0));
  const stepTwoOn = !!type;
  const stepThreeOn = stepTwoOn && count > 0;
  const price = type === "powerplay" ? 8 : 0.25;
  const total = (count * price).toFixed(2);

  const fill = (i) => setTickets((t) => t.map((row, j) => (j === i ? randomTicket() : row)));
  const clear = (i) => setTickets((t) => t.map((row, j) => (j === i ? null : row)));

  return (
    <form className="LotteryPlaySection_root" onSubmit={(e) => e.preventDefault()}>
      <section className="LotteryPlaySection_typeAndNumberSection">
        <TicketWrapper title="1. Select entry type" headerClass="LotteryPlaySection_lotteryTicketTypeSelectHeader" containerClass="LotteryPlaySection_lotteryTicketWrapperContainer" contentClass="LotteryPlaySection_lotteryTicketTypeSelectRoot">
          <div className="LotteryPlaySection_selectTypeWrapper">
            <img alt="lottery" className="LotteryPlaySection_image" src="/icons/lottery-select-number.svg" />
            <p>Choose between a Standard entry or select a Powerplay entry for a guaranteed Powerball, significantly increasing your odds to win the jackpot!</p>
            <div className="LotteryRadioGroup_root">
              <label className="Label_root LotteryRadioGroup_label">Select type</label>
              {ENTRY_TYPES.map((t) => (
                <label key={t.id} className="LotteryRadioGroup_input">
                  <div className="LotteryRadioGroup_selection">
                    <input type="radio" name="entryType" value={t.id} checked={type === t.id} onChange={() => setType(t.id)} />
                    <span className="LotteryRadioGroup_text">{t.label}</span>
                    {t.help && (
                      <span className="Tooltip_trigger" title="Powerplay guarantees the Powerball number">
                        <img alt="help" src="/icons/question-mark.svg" />
                      </span>
                    )}
                  </div>
                  <span className="IconValue_root FormattedAmount_root">
                    <img alt="USD" height="16" src="/icons/fiat/USD.svg" width="16" />
                    {t.price}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </TicketWrapper>

        <TicketWrapper title="2. Select number of entries" disabled={!stepTwoOn} headerClass="LotteryPlaySection_lotteryTicketTypeSelectHeader" containerClass="LotteryPlaySection_lotteryTicketWrapperContainer" contentClass="LotteryPlaySection_lotteryTicketTypeSelectRoot">
          <div className="LotteryPlaySection_selectTypeWrapper">
            <img alt="lottery" className="LotteryPlaySection_image" src="/icons/single-lottery.svg" />
            <p>Pick how many entries you want for a chance to win incredible prizes and a shot at the grand jackpot in the next lottery draw!</p>
            <div className="LotteryPlaySectionInput_root">
              <div className="TextInput_formControlWrapper">
                <div className="TextInput_labelGroup">
                  <div className="LabelBlock_root TextInput_labelBlock">
                    <label className="TextInput_label" htmlFor="lottery-amount">
                      <span>Select entries</span>
                    </label>
                  </div>
                </div>
                <div className="InputWrapper_root">
                  <input
                    id="lottery-amount"
                    className="Input_root Input_hasRightIcon"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    disabled={!stepTwoOn}
                    placeholder="Enter Amount"
                    autoComplete="off"
                    type="number"
                    name="amount"
                    value={entries}
                    onChange={(e) => setEntries(e.target.value)}
                  />
                  <span className="InputSuffix_root">
                    <div className="LotteryPlaySectionInput_buttonGroup">
                      {[
                        ["½", (n) => Math.max(1, Math.floor(n / 2)), "LotteryPlaySectionInput_halfText"],
                        ["2x", (n) => Math.min(TICKET_ROWS, n * 2 || 1)],
                        ["Max", () => TICKET_ROWS],
                      ].map(([label, fn, extra]) => (
                        <button key={label} type="button" disabled={!stepTwoOn} className={cx("ButtonVariants_root ButtonVariants_buttonHeightAuto ButtonVariants_tertiary LotteryPlaySectionInput_maxButton", extra)} onClick={() => setEntries(String(fn(count)))}>
                          <span className="ButtonVariants_buttonContent">{label}</span>
                        </button>
                      ))}
                    </div>
                  </span>
                </div>
              </div>
              <div className="LotteryPlaySectionInput_output">
                <div className="LotteryPlaySectionInput_outputTitle">
                  <label className="Label_root">Total cost</label>
                  <span className="LotteryPlaySectionInput_rightLabel">{total}&nbsp;USD</span>
                </div>
                <output name="result" htmlFor="lottery-amount" className="LotteryPlaySectionInput_outputAmount">
                  <span className="IconValue_root FormattedAmount_root">
                    <img alt="ETH" className="CryptoIcon_root CryptoIcon_image" height="16" src="/icons/crypto/eth.svg" width="16" />
                    {(count * price * 0.00023).toFixed(8)}
                  </span>
                </output>
              </div>
            </div>
          </div>
        </TicketWrapper>
      </section>

      <TicketWrapper title="3. Choose lottery numbers" disabled={!stepThreeOn} containerClass="LotteryPlaySection_chooseNumberContentContainer">
        <section className="LotteryPlaySectionsControl_buttonGroup">
          <p className="LotteryPlaySectionsControl_tickets">Ticket</p>
          <p className="LotteryPlaySectionsControl_numbers">Numbers</p>
          <IconButton variant="ButtonVariants_goldOutline" icon="/icons/lighting.svg" alt="fast fill" label="Auto-fill All" className="LotteryPlaySectionsControl_button" disabled={!stepThreeOn} onClick={() => setTickets((t) => t.map((row, i) => (i < count ? randomTicket() : row)))} />
          <IconButton variant="ButtonVariants_secondary" icon="/icons/bin.svg" alt="clear" label="Clear All" disabled={!stepThreeOn} onClick={() => setTickets(Array.from({ length: TICKET_ROWS }, () => null))} />
        </section>
        <section className="LotteryPlaySectionList_root">
          {tickets.map((row, i) => (
            <div key={i}>
              <div className="LotteryPlaySectionListItem_rowRoot">
                <p>
                  <span className="LotteryPlaySectionListItem_ticket">Ticket</span> {i + 1}
                </p>
                <div className="LotteryPlaySectionListItem_container">
                  <button disabled={!stepThreeOn || i >= count} className="LotteryPlaySectionListItem_selections" type="button" onClick={() => fill(i)}>
                    {(row || Array(6).fill(null)).map((n, j) => (
                      <span key={j} className={cx(n == null ? "LotteryPlaySectionListItem_placeholder" : "LotteryPlaySectionListItem_number", j === 5 && n != null && "LotteryPlaySectionListItem_powerball")}>
                        {n}
                      </span>
                    ))}
                  </button>
                  <div className="LotteryPlaySectionListItem_button">
                    <IconButton variant="ButtonVariants_goldOutline" icon="/icons/lighting.svg" alt="fast fill" disabled={!stepThreeOn || i >= count} onClick={() => fill(i)} />
                    <IconButton variant="ButtonVariants_secondary" icon="/icons/bin.svg" alt="clear" disabled={!stepThreeOn || i >= count} onClick={() => clear(i)} />
                  </div>
                </div>
                <button className="LotteryPlaySectionListItem_fakeButton" type="button" aria-hidden="true" tabIndex={-1} />
              </div>
            </div>
          ))}
        </section>
      </TicketWrapper>

      <section className="LotteryPlaySectionConfirmButton_confirmButton">
        <button type="submit" disabled={!stepThreeOn} className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary LotteryPlaySectionConfirmButton_button">
          <span className="ButtonVariants_buttonContent">Buy Now</span>
        </button>
      </section>
    </form>
  );
}

function TicketsPanel() {
  return (
    <div>
      <div>
        <section className="LotteryTicketWrapper_root LotteryTicketsAndPrizesSection_ticketWrapper">
          <header className="LotteryTicketWrapper_header">
            <h2 className="Heading_root Heading_h2">Tickets &amp; Prizes</h2>
            <hr className="LotteryBorder_root LotteryBorder_small" />
          </header>
          <div className="LotteryTicketWrapper_contentContainer">
            <div className="LotteryTicketWrapper_content">
              <div className="LotteryTicketsAndPrizesSection_header">
                <section className="DrawResult_root">
                  <header className="DrawResult_navigation">
                    <button type="button">
                      <img alt="navigate to left" height="24" src="/icons/arrow-cricle-background.svg" width="24" />
                      <span>Prev draw</span>
                    </button>
                    <p>
                      <span className="DrawResult_draw">Draw #100</span>
                      <span className="DrawResult_drawDate">Sep 11, 2026</span>
                    </p>
                    <button type="button" disabled>
                      <span>Next draw</span>
                      <img alt="navigate to right" height="24" src="/icons/arrow-cricle-background.svg" width="24" />
                    </button>
                  </header>
                  <div className="LotteryResultDrawSelection_numberWrapper">
                    <div className="LotteryDisplayNumbers_root LotteryResultDrawSelection_numberRoot">
                      <div className="LotteryDisplayNumbers_wrapper">
                        <p className="LotteryDisplayNumbers_heading">
                          Numbers <span>P’ball</span>
                        </p>
                        <ul className="LotteryNumbers_root LotteryDisplayNumbers_numbers LotteryNumbers_large">
                          {[0, 1, 2, 3, 4].map((i) => (
                            <li key={i} className="LotteryNumbers_emptyNumber" />
                          ))}
                          <li className="LotteryNumbers_lineBreak" />
                          <li className="LotteryNumbers_emptyNumber" />
                        </ul>
                      </div>
                    </div>
                    <div>
                      <button type="button" className="LotteryResultDrawSelection_button">
                        <img alt="double tick" src="/icons/double-ticks.svg" />
                        Provably Fair
                      </button>
                    </div>
                  </div>
                </section>
              </div>
              <section className="LotteryResultTable_root">
                <div className="Table_root">
                  <table className="Table_table LotteryResultTable_table">
                    <thead className="LotteryResultTable_tableHeader">
                      <tr>
                        {["Prize Divisions", "Prizes", "Combinations", "Winners"].map((c) => (
                          <td key={c} width="25%">
                            {c}
                          </td>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="TableBody_tbody TableBody_even">
                      {divisions.map((d) => (
                        <tr key={d.name}>
                          <td>
                            <p className={cx("LotteryResultTable_divisions", d.jackpot && "LotteryResultTable_jackpot")}>{d.name}</p>
                          </td>
                          <td>
                            <div className="LotteryResultTable_prizes">
                              <span className="IconValue_root">
                                <img alt="USDC" className="CryptoIcon_root CryptoIcon_image" height="16" src="/icons/crypto/usdc.svg" width="16" />
                                <span className="Tooltip_trigger">
                                  <span className="FiatWithTooltip_root fiat-with-tool-tip-text">{d.prize}</span>
                                </span>
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="LotteryResultTable_combinations">
                              {Array.from({ length: d.balls }).map((_, i) => (
                                <span key={i} className="LotteryResultTable_ball">
                                  ●
                                </span>
                              ))}
                              {d.pball && <span className="LotteryResultTable_pBall">●</span>}
                            </div>
                          </td>
                          <td>
                            <div className="LotteryResultTable_win">
                              <img alt="trophy" src="/icons/trophy.svg" />0&nbsp;
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Reference markup rendered as-is; accordions are wired up after mount. */
function HowToPlayPanel() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll(".LotteryHowToPlayCarouselItem_root").forEach((el) => el.removeAttribute("style"));
    const onClick = (e) => {
      const btn = e.target.closest(".Accordion_accordionHeader");
      if (!btn || !root.contains(btn)) return;
      const acc = btn.closest(".Accordion_root");
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      btn.querySelector(".Accordion_accordionHeaderLeft")?.classList.toggle("Accordion_headingOpen", !open);
      btn.querySelector(".Accordion_chevronWrapper")?.classList.toggle("Accordion_open", !open);
      acc.querySelectorAll(".Accordion_contentHeight .Accordion_content").forEach((c) => c.classList.toggle("Accordion_openContent", !open));
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, []);
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: howToPlayHtml }} />;
}

export default function LotteryPage() {
  const [tab, setTab] = useState("play");

  return (
    <div>
      <div className="LotteryHero_root">
        <section className="LotteryHero_container">
          <div className="LotteryHero_ticket">
            <header className="LotteryHero_header">
              <img alt="logo" className="LotteryHero_logo" height="35.83" src="/icons/logo-small.svg" width="32" />
              <h1 className="LotteryHero_prizePool">Join the #100th SHFL Lottery</h1>
              <p className="LotteryHero_draw">Friday the 11th at 12:30PM</p>
              <p className="LotteryHero_amount">$3,092,546</p>
            </header>
          </div>
        </section>
      </div>

      <section className="LayoutContainer_root lottery_root LayoutContainer_column">
        <nav className="lottery_tabWrapper">
          <div className="Tab_root lottery_tab Tab_wideContent">
            <div className="Tab_tabsContainer" role="tablist">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={cx("Tab_tab", tab === t.id && "Tab_active", "Tab_wide")} disabled={tab === t.id} onClick={() => setTab(t.id)}>
                  <p className="Tab_text">{t.label}</p>
                </button>
              ))}
            </div>
          </div>
        </nav>

        {tab === "play" && <PlayPanel />}
        {tab === "ticketsPrizes" && <TicketsPanel />}
        {tab === "howToPlay" && <HowToPlayPanel />}
      </section>
    </div>
  );
}
