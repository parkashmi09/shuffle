import { useState } from "react";

import { cx } from "../../lib/carousel";
import { alertFromError, alertSuccess } from "../../lib/alerts";
import { displayBalance } from "../../lib/adapters";
import { redeem as redeemApi, vip as vipApi } from "../../lib/endpoints";
import { navigate } from "../../lib/router";
import { useApi } from "../../lib/useResource";
import { useSession } from "../../lib/sessionContext";
import VipBadge from "../vip/VipBadge";
import VipRewards from "../vip/VipRewards";
import { tierFor } from "../vip/vipTiers";

/**
 * The VIP rail — opened from the crown in the header's `IconMenu`.
 *
 * Third panel in the one right-hand dock, on the same shell as the bet slip
 * and the notification rail: `CasinoAside_rightSide` parks the aside at
 * `margin-right: calc(-1 * var(--side-panel-width))`, `CasinoAside_showRightSide`
 * takes that to zero and `CasinoAside_enableAnimation` supplies the transition,
 * so the page column narrows as the panel arrives rather than being covered.
 * It stays mounted while shut so the close animates too.
 *
 * ── THE REWARDS GRID IS `VipRewards`, UNCHANGED ──────────────────────────
 *
 * Its card classes are `VipSidebarRewardBlock_*` — captured from THIS panel,
 * not from the VIP page, which is why the four cards already look like the
 * reference's: the status line, the gift mark, the artwork, and either a Claim
 * button or a padlock naming the rank that unlocks it. It also already holds
 * the claim calls, the per-card busy/error state and the re-read afterwards.
 * Rendering it here is one import; a rail-shaped copy would be a second place
 * for `POST /user/bonus/claim/:type` to drift.
 *
 * ── AND THE LADDER IS `GET /user/vip` ────────────────────────────────────
 *
 * `{ level, name, card, wager, nextLevel, nextName, wagerToNextLevel,
 * progressPct }`, with `VipBadge` / `tierFor` turning a `card` into its mark.
 * Nothing here computes a rank or a percentage — a second copy of that
 * arithmetic is how a player reads VIP 30 in the rail and VIP 29 on the page.
 */

/** The progress card: artwork, the bar, the two ranks either side of it, the CTA. */
function ProgressCard({ vip, levels, onViewProgramme }) {
  const tier = tierFor(vip);
  const pct = Number(vip?.progressPct ?? 0);
  /**
   * The band above this one, looked up in the ladder — the progress payload
   * names the next level and rank but not its CARD, and the card is what picks
   * the mark. Same lookup `VipOverview` does.
   *
   * On the top band `nextLevel` comes back `null`, where the ladder is
   * open-ended by design, so the right-hand slot is left empty rather than
   * inventing a rank above the highest one.
   */
  const nextBand = vip?.nextLevel ? (levels || []).find((b) => b.level === vip.nextLevel) : null;
  const nextTier = nextBand ? tierFor(nextBand) : null;

  return (
    <div className="VipSidebar_card">
      <img className="VipSidebar_art" src="/images/vip-rewards.png" alt="" aria-hidden="true" />

      <div className="ProgressBarSection_graph VipSidebar_graph">
        <div className="ProgressBarSection_graphContent VipSidebar_graphContent">
          <label htmlFor="vip-rail-progress">
            <span className="VipSidebar_progressTitle">Your VIP Progress</span>
            <div className="ProgressBarSection_rightContainer">
              <span className="VipSidebar_progressValue">{pct.toFixed(2)}%</span>
            </div>
          </label>
          <div className="ProgressBarSection_progress ProgressBarSection_skipBorder">
            <progress id="vip-rail-progress" value={pct} max="100" style={{ width: "100%" }} />
          </div>
          <p className="ProgressBarSection_supportText">
            <span>
              <VipBadge icon={tier.icon} label={tier.label} />
            </span>
            <span className="ProgressBarSection_tokenAmount">
              {nextTier && <VipBadge icon={nextTier.icon} label={nextTier.label} />}
            </span>
          </p>
        </div>
      </div>

      <button
        type="button"
        className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary VipSidebar_cta"
        onClick={onViewProgramme}
      >
        <span className="ButtonVariants_buttonContent">View VIP Program</span>
      </button>
    </div>
  );
}

/**
 * The "Redeem Code" fold above the footer.
 *
 * The reference collapses it to a single row with a chevron, so the field is
 * not a modal here — `RedeemCodeModal` keeps that job for the account menu.
 * Both post the same `POST /user/bonus/redeem` and both answer with a toast
 * rather than an inline error, which is what the live site does.
 */
function RedeemFold() {
  const { refreshBalances } = useSession();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const value = code.trim();
    if (!value || pending) return;
    setPending(true);
    try {
      const result = await redeemApi.code(value);
      alertSuccess(
        result?.amount
          ? `Redeemed ${displayBalance(result.amount, result.currency)}`
          : "Redeem code applied",
      );
      setCode("");
      setOpen(false);
      refreshBalances?.();
    } catch (error) {
      alertFromError(error);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="VipSidebar_redeem">
      <button
        type="button"
        className="VipSidebar_redeemToggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>Redeem Code</span>
        <img
          alt=""
          aria-hidden="true"
          src="/icons/chevron.svg"
          className={cx("VipSidebar_redeemChevron", open && "VipSidebar_redeemChevronOpen")}
        />
      </button>

      {open && (
        <form className="VipSidebar_redeemForm" onSubmit={submit}>
          <input
            type="text"
            value={code}
            placeholder="Enter your code"
            aria-label="Redeem code"
            autoComplete="off"
            onChange={(e) => setCode(e.target.value)}
          />
          <button
            type="submit"
            disabled={pending || !code.trim()}
            className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary"
          >
            <span className="ButtonVariants_buttonContent">{pending ? "Redeeming…" : "Redeem"}</span>
          </button>
        </form>
      )}
    </div>
  );
}

export default function VipPanel({ open, onClose }) {
  const { signedIn, restoring } = useSession();

  /**
   * Read only while the panel is actually showing. `useApi` derives its
   * disabled state from the key the same way `NotificationPanel` does, so a
   * rail nobody has opened costs no request.
   */
  const enabled = Boolean(signedIn && open);
  const { data: vip } = useApi(
    enabled ? "vip:rail:progress" : "vip:rail:off",
    () => vipApi.progress(),
    { enabled },
  );
  /* Public and unchanging — the next rank's mark and the locked buttons' names. */
  const { data: levels } = useApi(
    enabled ? "vip:levels" : "vip:levels:off",
    () => vipApi.levels(),
    { enabled },
  );

  const goProgramme = () => {
    onClose();
    navigate("/vip-program");
  };

  return (
    <aside
      className={cx(
        "CasinoAside_rightSide CasinoAside_enableAnimation",
        open ? "CasinoAside_showRightSide" : "CasinoAside_disableMobileView",
      )}
      aria-hidden={!open}
      aria-label="VIP"
    >
      <div className="AnimateMobileView_animateContainer">
        <section className="RightSidebar_rightSidebarContent">
          <div className="RightSidebarHeader_rightSidebarHeaderElement RightSidebarHeader_md2">
            <div
              className="Flex_root Flex_wide"
              style={{ justifyContent: "space-between", alignItems: "center" }}
            >
              <h3>VIP</h3>
              <div className="Flex_root VipSidebar_headerButtons">
                <button
                  type="button"
                  aria-label="Close VIP"
                  onClick={onClose}
                  className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_iconTransparent ButtonVariants_hasIcon VipSidebar_iconButton"
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

          <div className="RightSidebar_rightSidebarScrollable VipSidebar_body">
            {/*
              While a stored token is being checked neither state is the truth
              yet, so the panel shows nothing for the one round trip
              `/auth/me` takes rather than flashing the signed-out pitch at a
              member — the same reason `TopBar` leaves its slot empty.
            */}
            {restoring ? null : (
              <>
                {/* Signed out this still draws, at Unranked and 0.00% — which is
                    the programme's own starting point rather than a placeholder. */}
                <ProgressCard vip={vip} levels={levels} onViewProgramme={goProgramme} />

                {signedIn ? (
                  <VipRewards levels={levels} variant="sidebar" />
                ) : (
                  <div className="VipSidebar_signedOut">
                    <p className="VipSidebar_signedOutText">
                      Sign in to see your rank, your rakeback and everything waiting to be claimed.
                    </p>
                    <button
                      type="button"
                      className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_secondary"
                      onClick={() => {
                        onClose();
                        window.dispatchEvent(new CustomEvent("shuffle:auth", { detail: "login" }));
                      }}
                    >
                      <span className="ButtonVariants_buttonContent">Sign in</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Above the footer and outside the scroller, as the reference pins it. */}
          {signedIn && <RedeemFold />}

          <div className="RightSidebar_rightSidebarFooter VipSidebar_footer">
            <a
              className="VipSidebar_learnMore"
              href="/vip-program"
              onClick={(e) => {
                e.preventDefault();
                goProgramme();
              }}
            >
              Learn more about the Shuffle VIP program
            </a>
          </div>
        </section>
      </div>
    </aside>
  );
}
