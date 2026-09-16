import { useState } from "react";
import { cx } from "../lib/carousel";
import { useSession } from "../lib/sessionContext";
import ActivityBoard from "../components/casino/ActivityBoard";
import TokenAirdropOverview from "../components/token/TokenAirdropOverview";
import data from "../data/airdrop.json";

/**
 * SHFL Airdrop page — a 1:1 port of the reference `/airdrop` route:
 * hero banner, stats, overview tile, token benefits, FAQ and the airdrop board.
 */

const LineDash = () => (
  <div className="TokenLineDash_dashContainer TokenLineDash_skipMargin">
    <hr />
    <img alt="SHFL" src="/icons/token/shflLogo.svg" />
    <hr />
  </div>
);

function Faq({ q, a, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="Accordion_root">
      <div>
        <button aria-expanded={open} className="Accordion_accordionHeader" type="button" onClick={() => setOpen((o) => !o)}>
          <div className={cx("Accordion_accordionHeaderLeft", open && "Accordion_headingOpen")}>{q}</div>
          <div className={cx("Accordion_chevronWrapper", open && "Accordion_open")}>
            <img alt="arrow" src="/icons/chevron.svg" />
          </div>
        </button>
      </div>
      <div className="Accordion_contentHeight">
        <div>
          <div className={cx("Accordion_content", open && "Accordion_openContent")} dangerouslySetInnerHTML={{ __html: a.replace(/^<div class="Accordion_content[^>]*>|<\/div>$/g, "") }} />
        </div>
      </div>
    </div>
  );
}

export default function AirdropPage() {
  // The Token Overview block is signed-in only on the reference — see the note
  // in `TokenAirdropOverview`.
  const { signedIn } = useSession();

  return (
    <div>
      <section className="LayoutContainer_root LayoutContainer_mobile-top-md2 LayoutContainer_mobile-bottom-md2 LayoutContainer_desktop-top-lg1 LayoutContainer_desktop-bottom-0 LayoutContainer_column">
        <div className="Flex_root Flex_column Flex_lg1">
          <div className="HeroBanner_hero">
            <img alt="airdrop" className="HeroBanner_heroImage" src="/images/banners/airdrop-hero.png" />
            <img alt="airdrop" className="HeroBanner_heroMobileImage" src="/images/banners/airdrop-mobile-hero.png" />
            <div className="HeroBanner_heroContent">
              <div className="Flex_root Flex_column Flex_sm1">
                <div>
                  <h1 className="HeroBanner_heading">
                    WIN <b>WEEKLY</b> REWARDS IN THE SHFL <b>AIRDROP</b>!
                  </h1>
                </div>
                <div>
                  <div className="HeroBanner_description">
                    <p>{data.hero.desc}</p>
                  </div>
                </div>
              </div>
              <div>
                <button className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_success HeroBanner_button" type="button">
                  <span className="ButtonVariants_buttonContent">Bet now to win</span>
                </button>
              </div>
            </div>
          </div>

          <div className="Flex_root Flex_column SiteStatsCards_siteStatsCardsSection">
            {data.stats.map((s) => (
              <div key={s.h} className="Flex_root SiteStatsCards_cardContainer">
                <div className="Flex_root Flex_column SiteStatsCards_textWrapper">
                  <h3 className="SiteStatsCards_heading">{s.h}</h3>
                  <p className="SiteStatsCards_paragraph">{s.p}</p>
                </div>
                <img alt="" className="SiteStatsCards_icon" src={s.icon} />
              </div>
            ))}
          </div>

          <LineDash />

          {signedIn && <TokenAirdropOverview />}

          <section className="Flex_root Flex_column Flex_lg1 Flex_center">
            <h2 className="Heading_root Heading_center Heading_heading2 PromotionTile_heading">AIRDROP OVERVIEW</h2>
            <div className="Flex_root Flex_column Flex_lg1 Flex_center PromotionTile_container PromotionTile_right">
              <div className="PromotionTile_imageWrapper">
                <img alt="airdrop overview" className="PromotionTile_image" src="/images/airdrop-promotion.png" />
                <section className="PromotionTile_overlayContainer">
                  <p className="PromotionTile_text">Wagered</p>
                  <p className="PromotionTile_amount">1000x</p>
                  <img alt="" className="PromotionTile_overlayIcon" src="/icons/airdrop-promotion-overlay.svg" />
                </section>
              </div>
              <div className="Flex_root Flex_column Flex_lg1 PromotionTile_contentWrapper">
                {data.steps.map((s) => (
                  <div key={s.title} className="Flex_root Flex_column Flex_sm1">
                    <h4 className="Heading_root Heading_h4 PromotionTile_subheader">
                      <span>{s.title}</span>
                    </h4>
                    <p className="PromotionTile_description">{s.desc}</p>
                  </div>
                ))}
                <button className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_success PromotionTile_fitContent" type="button">
                  <span className="ButtonVariants_buttonContent">Bet now to win</span>
                </button>
              </div>
            </div>
          </section>

          <LineDash />

          <h2 className="Heading_root Heading_center Heading_heading2">SHFL TOKEN BENEFITS</h2>
          <section className="Flex_root Flex_column Flex_lg1 FeatureCards_grid">
            {data.features.map((f) => (
              <div key={f.title}>
                <div className="Flex_root Flex_column Flex_md2 Flex_center FeatureCard_cardContainer FeatureCards_tile">
                  <div className="Flex_root Flex_center">
                    <img alt="" className="FeatureCard_icon" src={f.icon} />
                  </div>
                  <div className="Flex_root Flex_column Flex_md1 Flex_spaced">
                    <div className="Flex_root Flex_column Flex_sm1 Flex_center FeatureCard_textContent">
                      <h4 className="Heading_root Heading_h4">{f.title}</h4>
                      <p className="FeatureCard_description">{f.desc}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <LineDash />

          <h2 className="Heading_root Heading_center Heading_heading2">AIRDROP FAQ</h2>
          <div className="Flex_root Flex_column Flex_md2">
            {data.faq.map((f, i) => (
              <Faq key={f.q} q={f.q} a={f.a} defaultOpen={i === 0} />
            ))}
          </div>
        </div>
      </section>

      <ActivityBoard initialTab="airDropRace" hideTabs={["race"]} />
    </div>
  );
}
