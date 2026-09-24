import { useState } from "react";

import { cx } from "../../lib/carousel";
import { oddsValue, useBetSlip } from "../../lib/betSlipContext";
import { formatAmount } from "../../lib/adapters";
import { navigate } from "../../lib/router";
import { useSession } from "../../lib/sessionContext";

/**
 * The bet slip rail — opened from the bet-slip button in the header's
 * `IconMenu`, docked on the right beside the notification panel.
 *
 * ── IT SLIDES BECAUSE IT IS A FLEX SIBLING, NOT AN OVERLAY ───────────────
 *
 * The shell's row is [rail | page column | aside]. `CasinoAside_rightSide`
 * gives this aside `margin-right: calc(-1 * var(--side-panel-width))`, which
 * parks it off the edge at its own full width; `CasinoAside_showRightSide`
 * takes that margin to zero and `CasinoAside_enableAnimation` supplies the
 * transition, so the page column narrows as the panel arrives instead of being
 * covered by it. Nothing here is positioned or animated — the same three
 * classes the notification panel uses do all of it, which is what
 * `shuffle-right-rail.css` means by "the bet slip uses the same shell".
 *
 * It stays mounted while shut so the close animates too. Below 768px
 * `AnimateMobileView_animateContainer` turns it into a full-screen sheet above
 * the mobile nav, and `CasinoAside_disableMobileView` takes the shut state out
 * of the paint.
 *
 * ── THE CHROME IS THE REFERENCE'S ────────────────────────────────────────
 *
 * Title with a chevron that folds the slip away, a settings gear and the close
 * cross on the header rule; the empty state's ticket illustration over "Your
 * Bet Slip is empty" and a primary "View popular sports"; and a footer that
 * carries "View all bets" whether or not there is anything in the slip.
 *
 * ── PLACEMENT IS INERT, ON PURPOSE ───────────────────────────────────────
 *
 * The sportsbook is served from the captures in `src/data/sports-*.json`, whose
 * selections are `[name, odds]` pairs with no market or selection id, and
 * nothing feeds results for them. `POST /api/v1/sports/bets` would take the
 * payload — its schema is `.passthrough()` with every field optional — debit a
 * real wallet and write an exposure row against a market that can never settle.
 * So the button carries the reference's disabled styling and says why, the same
 * way `IconMenu` renders its other unbuilt destinations.
 */

/** A leg's price, or the reason it has none. */
function LegOdds({ odds }) {
  const priced = oddsValue(odds);
  if (!priced) {
    return <span className="BetSlipSidebar_legOddsUnpriced">{odds || "Suspended"}</span>;
  }
  return (
    <span className="Odds_oddsWrapper BetSlipSidebar_legOdds">
      <span>{odds}</span>
    </span>
  );
}

/**
 * One leg.
 *
 * In singles it carries its own stake box and return; in a multi the stake is
 * taken once at the foot, so the box is not repeated per leg.
 */
function Leg({ leg, mode, stake, currency, onStake, onRemove }) {
  const priced = oddsValue(leg.odds);
  const typed = Number.parseFloat(stake);
  const ret = priced * (Number.isFinite(typed) && typed > 0 ? typed : 0);

  return (
    <li className="BetSlipSidebar_leg">
      <div className="BetSlipSidebar_legHeader">
        <div className="BetSlipSidebar_legMain">
          <p className="BetSlipSidebar_legName">{leg.name}</p>
          {leg.market ? <p className="BetSlipSidebar_legMarket">{leg.market}</p> : null}
          <button
            type="button"
            className="BetSlipSidebar_legEvent"
            onClick={() => leg.href && navigate(leg.href)}
            title={leg.event || leg.league}
          >
            {leg.live ? <span className="BetSlipSidebar_liveDot" aria-hidden /> : null}
            {leg.event || leg.league || "Fixture"}
          </button>
        </div>
        <div className="BetSlipSidebar_legRight">
          <LegOdds odds={leg.odds} />
          <button
            type="button"
            aria-label={`Remove ${leg.name}`}
            className="BetSlipSidebar_legRemove"
            onClick={() => onRemove(leg.id)}
          >
            <img alt="" src="/icons/times.svg" width="12" height="12" />
          </button>
        </div>
      </div>

      {mode === "singles" && (
        <div className="BetSlipSidebar_legStake">
          <label className="BetSlipSidebar_stakeField">
            <span className="BetSlipSidebar_stakeLabel">Stake</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={stake ?? ""}
              aria-label={`Stake for ${leg.name}`}
              onChange={(e) => onStake(leg.id, e.target.value)}
            />
            <span className="BetSlipSidebar_stakeCurrency">{currency}</span>
          </label>
          <p className="BetSlipSidebar_legReturn">
            <span>To return</span>
            <span className="BetSlipSidebar_legReturnValue">
              {formatAmount(ret)} {currency}
            </span>
          </p>
        </div>
      )}
    </li>
  );
}

export default function BetSlipPanel({ open, onClose }) {
  const { signedIn, currency } = useSession();
  const {
    selections,
    count,
    mode,
    stakes,
    multiStake,
    totalStake,
    totalReturn,
    multiOdds,
    remove,
    clear,
    setStake,
    setMultiStake,
    setMode,
  } = useBetSlip();

  /**
   * The chevron beside the title folds the body away and leaves the header and
   * footer — the reference's own behaviour, and the reason the title is a
   * button rather than a bare `h3`.
   */
  const [collapsed, setCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const code = currency || "USDT";
  const empty = count === 0;
  /** A multi needs two legs and a price on every one of them. */
  const multiUnavailable = mode === "multi" && !multiOdds;

  const goto = (path) => {
    onClose();
    navigate(path);
  };

  return (
    <aside
      className={cx(
        "CasinoAside_rightSide CasinoAside_enableAnimation",
        open ? "CasinoAside_showRightSide" : "CasinoAside_disableMobileView",
      )}
      aria-hidden={!open}
      aria-label="Bet slip"
    >
      <div className="AnimateMobileView_animateContainer">
        <section className="RightSidebar_rightSidebarContent">
          <div className="RightSidebarHeader_rightSidebarHeaderElement RightSidebarHeader_md2">
            <div
              className="Flex_root Flex_wide"
              style={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <button
                type="button"
                className="BetSlipSidebar_titleButton"
                aria-expanded={!collapsed}
                onClick={() => setCollapsed((c) => !c)}
              >
                <h3>Bet Slip</h3>
                {count > 0 && <span className="Counter_root Counter_neon">{count > 99 ? "99+" : count}</span>}
                <img
                  alt=""
                  aria-hidden="true"
                  src="/icons/chevron.svg"
                  className={cx("BetSlipSidebar_titleChevron", !collapsed && "BetSlipSidebar_titleChevronOpen")}
                />
              </button>

              <div className="Flex_root BetSlipSidebar_headerButtons">
                <button
                  type="button"
                  aria-label="Bet slip settings"
                  aria-expanded={settingsOpen}
                  title="Bet slip settings"
                  onClick={() => setSettingsOpen((s) => !s)}
                  className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_iconTransparent ButtonVariants_hasIcon BetSlipSidebar_iconButton"
                >
                  <span className="ButtonVariants_buttonContent">
                    <span className="ButtonIcon_root">
                      <img alt="" src="/icons/setting.svg" />
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Close bet slip"
                  onClick={onClose}
                  className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_iconTransparent ButtonVariants_hasIcon BetSlipSidebar_iconButton"
                >
                  <span className="ButtonVariants_buttonContent ToolbarButton_buttonDefault">
                    <span className="ButtonIcon_root">
                      <img alt="" src="/icons/times.svg" />
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/*
            The settings sheet. Only one switch is real — the rest of the
            reference's panel (odds format, accept-price-changes) needs a book
            behind it, so it is not drawn rather than drawn and inert.
          */}
          {settingsOpen && (
            <div className="BetSlipSidebar_settings">
              <button
                type="button"
                className="BetSlipSidebar_settingsRow"
                disabled={empty}
                onClick={() => {
                  clear();
                  setSettingsOpen(false);
                }}
              >
                Clear all selections
              </button>
            </div>
          )}

          <div className="RightSidebar_rightSidebarScrollable">
            {collapsed ? null : empty ? (
              <div className="RightSidebarEmptyState_emptyStateContainer">
                <img
                  alt=""
                  aria-hidden="true"
                  src="/icons/sport-bet-empty.svg"
                  width="160"
                  height="160"
                  className="BetSlipSidebar_art"
                />
                <div className="Flex_root Flex_column Flex_sm3 Flex_center">
                  <h3 className="RightSidebarEmptyState_title">Your Bet Slip is empty</h3>
                  <p className="RightSidebarEmptyState_description">
                    Check out today&rsquo;s action to make a bet
                  </p>
                </div>
                <button
                  type="button"
                  className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary"
                  onClick={() => goto("/sports")}
                >
                  <span className="ButtonVariants_buttonContent">View popular sports</span>
                </button>
              </div>
            ) : (
              <>
                <div className="BetSlipSidebar_tabs" role="tablist" aria-label="Bet type">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "singles"}
                    className={cx("BetSlipSidebar_tab", mode === "singles" && "BetSlipSidebar_tabActive")}
                    onClick={() => setMode("singles")}
                  >
                    Singles
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "multi"}
                    disabled={count < 2}
                    className={cx("BetSlipSidebar_tab", mode === "multi" && "BetSlipSidebar_tabActive")}
                    onClick={() => setMode("multi")}
                  >
                    Multi{count >= 2 ? ` (${count})` : ""}
                  </button>
                </div>

                <ul className="BetSlipSidebar_legs" aria-label="Selections">
                  {selections.map((leg) => (
                    <Leg
                      key={leg.id}
                      leg={leg}
                      mode={mode}
                      stake={stakes[leg.id]}
                      currency={code}
                      onStake={setStake}
                      onRemove={remove}
                    />
                  ))}
                </ul>

                <div className="BetSlipSidebar_totals">
                  {mode === "multi" && (
                    <div className="BetSlipSidebar_multiStake">
                      <label className="BetSlipSidebar_stakeField">
                        <span className="BetSlipSidebar_stakeLabel">Multi stake</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          value={multiStake}
                          aria-label="Multi stake"
                          onChange={(e) => setMultiStake(e.target.value)}
                        />
                        <span className="BetSlipSidebar_stakeCurrency">{code}</span>
                      </label>
                      <p className="BetSlipSidebar_summaryRow">
                        <span>Total odds</span>
                        <span className="BetSlipSidebar_summaryValue">
                          {multiOdds ? multiOdds.toFixed(2) : "—"}
                        </span>
                      </p>
                    </div>
                  )}

                  <p className="BetSlipSidebar_summaryRow">
                    <span>Total stake</span>
                    <span className="BetSlipSidebar_summaryValue">
                      {formatAmount(totalStake)} {code}
                    </span>
                  </p>
                  <p className="BetSlipSidebar_summaryRow BetSlipSidebar_summaryPayout">
                    <span>Estimated payout</span>
                    <span className="BetSlipSidebar_summaryValue">
                      {formatAmount(totalReturn)} {code}
                    </span>
                  </p>

                  {multiUnavailable && (
                    <p className="BetSlipSidebar_notice">
                      A multi needs a price on every leg. Remove the suspended one to continue.
                    </p>
                  )}

                  {/*
                    Disabled rather than absent: the reference keeps the control
                    in place so the footer does not change height, and
                    `IconMenu` already established `keepEnabledStyle` as how
                    this clone renders a destination it has not built. The label
                    carries the reason — a greyed button with no explanation
                    reads as a bug.
                  */}
                  <button
                    type="button"
                    disabled
                    className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary ButtonVariants_keepEnabledStyle BetSlipSidebar_place"
                  >
                    <span className="ButtonVariants_buttonContent">
                      {signedIn ? "Sportsbook unavailable" : "Sign in to bet"}
                    </span>
                  </button>
                  <p className="BetSlipSidebar_placeNote">
                    Prices here come from a captured book, so bets cannot be placed yet.
                  </p>
                </div>
              </>
            )}
          </div>

          {/*
            The footer is in the reference whether or not the slip holds
            anything, which is what keeps the empty panel from ending in dead
            space. Signed out there is no bet history to show, so it asks for
            the account the page would otherwise 401 on.
          */}
          <div className="RightSidebar_rightSidebarFooter BetSlipSidebar_footer">
            <button
              type="button"
              className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_secondary BetSlipSidebar_viewAll"
              onClick={() => {
                if (!signedIn) {
                  onClose();
                  window.dispatchEvent(new CustomEvent("shuffle:auth", { detail: "login" }));
                  return;
                }
                goto("/sports?section=my-bets");
              }}
            >
              <span className="ButtonVariants_buttonContent">View all bets</span>
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
}
