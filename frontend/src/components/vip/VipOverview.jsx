import VipBadge from "./VipBadge";
import { tierFor } from "./vipTiers";

/**
 * The card at the top of the signed-in VIP page — reference `VipPageOverview`.
 *
 * Two columns on a wide layout: the player's badge, their progress bar and the
 * programme blurb on the left; the rewards artwork on the right. On a narrow
 * one the artwork is `display: none` and the block is a single column — that
 * is the reference's own rule, not a choice made here.
 *
 * ── THE PROGRESS BAR IS `ProgressBarSection`, NOT A BAR BUILT HERE ───────
 *
 * The same component the user menu's VIP card uses, with `title` on the left,
 * the percentage on the right, and the current and next badges as its two
 * footer slots. `progressBorder: false` in the reference is what
 * `ProgressBarSection_skipBorder` is.
 *
 * ── WHAT "NEXT" IS AT THE TOP OF THE LADDER ──────────────────────────────
 *
 * `nextLevel` comes back `null` on the last band, and `vipLevelFor` reports
 * `100.00%` there. The footer's right slot is then left empty rather than
 * inventing a level above the top one — the ladder is open-ended past that
 * point, which is deliberate on the backend (it is the fix for the legacy bug
 * that dropped the platform's biggest player to VIP 0).
 *
 * ── THE CARD HAS THREE THINGS ON IT, NOT FOUR ────────────────────────────
 *
 * Badge, progress bar, blurb. An earlier pass added a fourth line reading
 * "N XP to Bronze 1", reasoning that a percentage with no denominator does not
 * say how much further it is. That reasoning may hold, but the line is not on
 * the reference's card and this page is a clone of it — the place to argue for
 * it is a design change, not a silent addition.
 */
export default function VipOverview({ username, vip, levels }) {
  const tier = tierFor(vip);
  const pct = Number(vip?.progressPct ?? 0);

  /* The badge for the level after this one, if the ladder has one. The band
     carries its own `name`, so `tierFor` labels it "Silver 1" rather than
     "Silver" — which is what the reference's footer shows. */
  const next = vip?.nextLevel ? (levels || []).find((b) => b.level === vip.nextLevel) : null;
  const nextTier = next ? tierFor(next) : null;

  return (
    <div className="VipPageOverview_root" data-testid="vip-progress-overview">
      <div className="Flex_root Flex_column Flex_md2">
        <div>
          <div className="UserBadgeBlock_root">
            <div className="UserBadgeBlock_avatarContainer">
              <div className="Avatar_root Avatar_background">
                <img alt="avatar" width="40" height="40" src="/icons/user-profile.svg" />
              </div>
            </div>
            <div className="UserBadgeBlock_badge">
              <h2 className="VipPageOverview_heading">{username}</h2>
              <VipBadge icon={tier.icon} label={tier.label} />
            </div>
          </div>
        </div>

        <div className="ProgressBarSection_graph VipCurrentProgress_classNameRoot">
          <div className="ProgressBarSection_graphContent VipCurrentProgress_content">
            <label htmlFor="vip-progress">
              <span className="VipCurrentProgress_title">Your VIP Progress</span>
              <div className="ProgressBarSection_rightContainer">
                <span className="VipCurrentProgress_title">{pct.toFixed(2)}%</span>
              </div>
            </label>
            <div className="ProgressBarSection_progress ProgressBarSection_skipBorder">
              <progress id="vip-progress" value={pct} max="100" style={{ width: "100%" }} />
            </div>
            <p className="ProgressBarSection_supportText">
              <span>
                <VipBadge className="VipCurrentProgress_footer" icon={tier.icon} label={tier.label} />
              </span>
              <span className="ProgressBarSection_tokenAmount">
                {nextTier && (
                  <VipBadge icon={nextTier.icon} label={nextTier.label} />
                )}
              </span>
            </p>
          </div>
        </div>

        <p className="VipPageOverview_vipPageOverviewDescription">
          Shuffle’s VIP program is designed to suit all different types of players with an emphasis on
          ensuring you receive the most in cumulative bonuses for every dollar you wager
        </p>

      </div>

      {/*
        * `vipOverviewImage` belongs on the `<img>` itself, not on a wrapper
        * round it.
        *
        * This was built as `div.vipOverviewImage > img.VipPageOverview_image`
        * while the artwork was missing, and the nesting was wrong: the class
        * carries `width: 100%`, `min-height: 10rem`, `overflow: hidden` and the
        * rounded `--color-gray800` panel, all of which the reference puts on the
        * image. Wrapped, the div took the sizing and the `<img>` inside had none
        * — so a 3840×2160 file rendered at its own scale instead of the
        * column's. `VipPageOverview_image` is a different element's class and is
        * not used here.
        */}
      <img className="VipPageOverview_vipOverviewImage" src="/images/vip-rewards.png" alt="Vip" />
    </div>
  );
}
