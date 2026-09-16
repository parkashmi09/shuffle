import { CarouselHeader, SwipeTrack } from "../ui/Carousel";
import { useCarousel } from "../../lib/carousel";
import { TokenTiles } from "./TokenSections";

/**
 * The "Token Overview" block on `/airdrop` — reference `TokenAirdropOverview`.
 *
 * ── SIGNED-IN ONLY ───────────────────────────────────────────────────────
 *
 * The reference drops this whole block for a visitor. Fetching `/airdrop`
 * without cookies returns markup that has every other section on the page
 * (`SiteStatsCards_`, `PromotionTile_`, `FeatureCards_`, `Accordion_`) and none
 * of this one's classes (`TokenClaimableTiles`, `TokenAirdropPrizes`), so the
 * gate is the session, not a breakpoint — the same split `TokenPage` already
 * makes for the unlock tiles, and for the same reason: the tiles report a rate
 * against *your* wagering and each week's card reports whether *you* won it.
 *
 * `AirdropPage` renders it between the site stats and AIRDROP OVERVIEW, which
 * is where the reference has it.
 *
 * **The weeks are not wired.** No service publishes airdrop history, so the
 * cards are the shape the reference renders with the current week in progress
 * and the rest ended — see `docs/MISSING-AND-UNWIRED.md`.
 */

/* The rules inside this block skip their margin — the block's own Flex_lg1 gap
   already spaces them, which is why the reference marks them `skipMargin`. */
const LineDash = () => (
  <div className="TokenLineDash_dashContainer TokenLineDash_skipMargin">
    <hr />
    <img alt="SHFL" src="/icons/token/shflLogo.svg" />
    <hr />
  </div>
);

const CURRENT_WEEK = 29;

const weeks = Array.from({ length: CURRENT_WEEK }, (_, i) => {
  const week = CURRENT_WEEK - i;
  return week === CURRENT_WEEK
    ? {
        week,
        state: "Card_completed",
        header: "Airdrop in progress",
        icon: "/icons/weekly-bonus.svg",
        iconAlt: "reward",
        description: "Airdrop now in progress. Wager now to join the leaderboard and win big!",
      }
    : {
        week,
        state: "Card_disabled",
        header: "Airdrop ended",
        icon: "/icons/destination.svg",
        iconAlt: "destination",
        description: "Unfortunately, you didn’t win this week. Keep racing for more big rewards!",
      };
});

function PrizeCard({ week, state, header, icon, iconAlt, description }) {
  return (
    <section className="Card_root Card_pageVariant TokenAirdropPrizes_tile">
      <div className={`Card_header ${state}`}>
        <p>{header}</p>
        <img alt="flag" height="16" src="/icons/airdrop-flag.svg" width="16" />
      </div>
      <div className="Flex_root Flex_column Flex_sm5 Card_content Card_pageVariant">
        <img alt={iconAlt} src={icon} />
        <div className={`Flex_root Flex_column Flex_sm1 Flex_center ${state}`}>
          <div className="Card_heading">
            <p className="TokenAirdropPrizes_title">Week {week}</p>
          </div>
          <div className="Card_description">{description}</div>
        </div>
      </div>
    </section>
  );
}

export default function TokenAirdropOverview() {
  const { trackRef, carousel } = useCarousel();

  return (
    <div>
      <div>
        <div className="Flex_root Flex_column Flex_lg1">
          <div className="Flex_root Flex_column Flex_md2">
            <h4 className="Heading_root Heading_h4 Heading_tabletH3">
              <span className="Heading_iconWrapper">
                <img alt="token" className="TokenAirdropOverview_iconOverview" height="24" src="/icons/token-white.svg" width="24" />
              </span>
              Token Overview
            </h4>
            <div className="Flex_root Flex_column Flex_md2 TokenAirdropOverview_content">
              <TokenTiles />
            </div>
          </div>

          <LineDash />

          <section>
            <CarouselHeader carousel={carousel} viewAll={null}>
              <img alt="token" className="TokenAirdropPrizes_headingIcon" height="24" src="/icons/token-white.svg" width="24" />
              Airdrop Rewards
            </CarouselHeader>
            <SwipeTrack trackRef={trackRef} carousel={carousel} className="TokenAirdropPrizes_carousel">
              {weeks.map((w) => (
                <PrizeCard key={w.week} {...w} />
              ))}
            </SwipeTrack>
          </section>

          <LineDash />
        </div>
      </div>
    </div>
  );
}
