import { useState } from "react";
import { cx } from "../lib/carousel";
import { useReveal } from "../lib/useReveal";
import ActivityBoard from "../components/casino/ActivityBoard";
import { ShowMoreButton } from "./LatestReleasesPage";
import { useApi } from "../lib/useResource";
import { challenges as challengesApi } from "../lib/endpoints";
import { formatAmount } from "../lib/adapters";

/** Challenges browse page — reference `/challenges`. */

const PAGE = 24;
const TABS = [
  { id: "live", label: "Live" },
  { id: "completed", label: "Finished" },
  { id: "mine", label: "My Completed", disabled: true },
];

function ChallengeCard({ c, index }) {
  const [ref, shown] = useReveal();
  return (
    <a ref={ref} className={cx("ChallengeCard_challengeCardWrapper", "TallGameCard_reveal", shown && "TallGameCard_show")} style={{ "--card-i": index }} href="/challenges" onClick={(e) => e.preventDefault()}>
      <span className="SkeletonPlaceholder_root SkeletonPlaceholder_imageVariant SkeletonPlaceholder_hasColor">
        {c.imageUrl && <img alt={c.gameName || c.game} className="nimg-fill" src={c.imageUrl} />}
        <div className="GameCardBorder_root" />
      </span>
      <div className="ChallengeCard_challengeFooter">
        <div className="ChallengeCard_challengeName">
          First to hit {Number(c.minMultiplier).toLocaleString("en-US")}x with minimum ${formatAmount(c.minBetUsd)} bet
        </div>
        <div>
          <div className="ChallengeCard_challengeLabel">Reward</div>
          <div className="ChallengeCard_challengeInfoBlock">
            <span className="IconValue_root">
              <span className="Tooltip_trigger">
                <span className="FiatWithTooltip_root fiat-with-tool-tip-text">${formatAmount(c.prizeUsd)}</span>
              </span>
            </span>
          </div>
        </div>
        <div>
          <div className="ChallengeCard_challengeLabel">Winners</div>
          <div className="ChallengeCard_challengeInfoBlock">
            <div className="ChallengeCard_challengeName ChallengeCard_textTruncated">
              {c.winnerNames?.length ? c.winnerNames.join(", ") : `${c.winnersFound ?? 0}/${c.winners}`}
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}

export default function ChallengesPage() {
  const [tab, setTab] = useState("live");
  const [count, setCount] = useState(PAGE);
  const { data, loading } = useApi("challenges", challengesApi.list);
  const list = (tab === "live" ? data?.active : data?.completed) ?? [];
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
              <ChallengeCard key={c.id} c={c} index={i % 5} />
            ))}
          </div>
          {!loading && list.length === 0 && (
            <div className="CardGridEmpty_root">
              <img alt="" height="62" src="/icons/cross.svg" width="62" />
              <p>No Challenges</p>
            </div>
          )}
          {count < list.length && <ShowMoreButton onClick={() => setCount((n) => n + PAGE)} />}
        </div>
      </section>

      <ActivityBoard hideTabs={["race"]} />
    </div>
  );
}
