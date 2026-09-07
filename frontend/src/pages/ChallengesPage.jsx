import { useState } from "react";
import { cx } from "../lib/carousel";
import { useReveal } from "../lib/useReveal";
import ActivityBoard from "../components/casino/ActivityBoard";
import { ShowMoreButton } from "./LatestReleasesPage";
import { challenges } from "../data/challenges";

/** Challenges browse page — reference `/challenges`. */

const PAGE = 24;
const TABS = [
  { id: "live", label: "Live" },
  { id: "finished", label: "Finished" },
  { id: "completed", label: "My Completed", disabled: true },
];

function ChallengeCard({ c, index }) {
  const [ref, shown] = useReveal();
  return (
    <a ref={ref} className={cx("ChallengeCard_challengeCardWrapper", "TallGameCard_reveal", shown && "TallGameCard_show")} style={{ "--card-i": index }} href={`/games/${c.slug}`} onClick={(e) => e.preventDefault()}>
      <span className="SkeletonPlaceholder_root SkeletonPlaceholder_imageVariant SkeletonPlaceholder_hasColor" style={{ "--skeleton-color": c.color }}>
        <img alt={c.game} className="nimg-fill" src={c.img} />
        <div className="GameCardBorder_root" style={{ border: `2px solid ${c.color}` }} />
      </span>
      <div className="ChallengeCard_challengeFooter">
        <div className="ChallengeCard_challengeName">
          First to hit {c.multiplier} with minimum {c.minBet} bet
        </div>
        <div>
          <div className="ChallengeCard_challengeLabel">Reward</div>
          <div className="ChallengeCard_challengeInfoBlock">
            <span className="IconValue_root">
              <img alt="SHFL" className="CryptoIcon_root CryptoIcon_image" height="16" src="/icons/crypto/shfl.svg" width="16" />
              <span className="Tooltip_trigger">
                <span className="FiatWithTooltip_root fiat-with-tool-tip-text">{c.reward}</span>
              </span>
            </span>
          </div>
        </div>
        <div>
          <div className="ChallengeCard_challengeLabel">Creator</div>
          <a className="ModalLink_root" href="/challenges?modal=user" onClick={(e) => e.preventDefault()}>
            <div className="ChallengeCard_challengeInfoBlock">
              <div className="ChallengeCard_challengeName ChallengeCard_challengeCreator ChallengeCard_textTruncated">{c.creator}</div>
            </div>
          </a>
        </div>
      </div>
    </a>
  );
}

export default function ChallengesPage() {
  const [tab, setTab] = useState("live");
  const [count, setCount] = useState(PAGE);
  // The reference keeps paging further challenges in; repeat the captured set so "Show More" has something to load.
  const list = tab === "live" ? [...challenges, ...challenges] : challenges.slice(0, 10).reverse();
  const shown = list.slice(0, count);

  return (
    <div>
      <div className="PageHeader_root BrowsingChallenges_browsingChallengeHeader">
        <section className="LayoutContainer_root LayoutContainer_column">
          <div className="Flex_root Flex_md2">
            <h1 className="Heading_root Heading_h2 PageHeader_capitalize">Challenges</h1>
          </div>
        </section>
      </div>

      <section className="LayoutContainer_root LayoutContainer_column">
        <div className="Tab_root BrowsingChallenges_tabList">
          <div className="Tab_tabsContainer" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={cx("Tab_tab", tab === t.id && "Tab_active", t.disabled && "Tab_disabled")} disabled={t.disabled || tab === t.id} onClick={() => { setTab(t.id); setCount(PAGE); }}>
                <p className="Tab_text">{t.label}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="CardGrid_cardGridWrapper">
          <div className="CardGrid_cardGridElement BrowsingChallenges_cardLayout">
            {shown.map((c, i) => (
              <ChallengeCard key={`${c.slug}-${c.multiplier}-${i}`} c={c} index={i % 5} />
            ))}
          </div>
          {count < list.length && <ShowMoreButton onClick={() => setCount((n) => n + PAGE)} />}
        </div>
      </section>

      <ActivityBoard hideTabs={["race"]} />
    </div>
  );
}
