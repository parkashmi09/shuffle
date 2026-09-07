import { PromoBanner, RankOrdinal, ShflAmount, UserCell } from "./PromoWidgets";

const leaderboard = [
  { rank: 1, user: null, prize: "50,000.00" },
  { rank: 2, user: { name: "Benwarner" }, prize: "30,000.00" },
  { rank: 3, user: { name: "GOATZK" }, prize: "20,000.00" },
  { rank: 4, user: null, prize: "16,500.00" },
  { rank: 5, user: { name: "apabapanapa" }, prize: "14,150.00" },
  { rank: 6, user: null, prize: "11,720.00" },
];

/** SHFL Airdrop tile — reference `ShuffleAirDropTile`. */
export default function AirdropTile() {
  return (
    <section className="Flex_root Flex_column Flex_md">
      <div className="Flex_root Flex_spaced">
        <h3 className="Heading_root Heading_h3 CarouselHeader_heading">
          <a className="TextLink_root" href="/airdrop" onClick={(e) => e.preventDefault()}>
            <img alt="shuffle logo" className="ShuffleAirDropTile_icon" height="24" src="/icons/token-white.svg" width="24" />
            SHFL Airdrop 3
          </a>
        </h3>
        <a className="TextLink_root CarouselHeader_viewAllButton CarouselHeader_viewAllButtonAlwaysVisible" href="/airdrop" onClick={(e) => e.preventDefault()}>
          View more
        </a>
      </div>

      <section className="ShuffleAirDropTile_card">
        <PromoBanner
          image="/images/banners/airdrop-hero.png"
          href="/airdrop"
          size="4.75rem"
          progress={0.08}
          title={<ShflAmount value="1,000,000" className="ShuffleAirDropTileBanner_displayAmount" amountClass="ShuffleAirDropTileBanner_amount" />}
          countdown="6d 13h 21m"
          countdownSuffix="remaining"
        />
        <section className="ShuffleAirDropTileLeaderBoard_leaderboard">
          {leaderboard.map((e, i) => (
            <div key={e.rank} className="Flex_root Flex_sm HomePromotionUserRank_entry HomePromotionUserRank_entryVisible" style={{ "--entry-i": i }}>
              <RankOrdinal rank={e.rank} />
              <UserCell user={e.user} />
              <div className="HomePromotionUserRank_prizeAmount">
                <ShflAmount value={e.prize} />
              </div>
            </div>
          ))}
        </section>
      </section>
    </section>
  );
}
