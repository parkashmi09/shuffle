import { useState } from "react";
import { cx } from "../lib/carousel";
import { useReveal } from "../lib/useReveal";
import ActivityBoard from "../components/casino/ActivityBoard";
import { ShowMoreButton } from "./LatestReleasesPage";
import { useApi } from "../lib/useResource";
import { challenges as challengesApi, quests as questsApi } from "../lib/endpoints";
import { useSession } from "../lib/sessionContext";
import { useGate } from "../lib/gates";
import { formatAmount } from "../lib/adapters";
import { navigate } from "../lib/router";
import { alertFromError, alertSuccess } from "../lib/alerts";

/** Challenges browse page — reference `/challenges`. */

const PAGE = 24;
const TABS = [
  { id: "live", label: "Live" },
  { id: "completed", label: "Finished" },
  { id: "mine", label: "My Completed", disabled: true },
];

/** Today's quests and the caller's progress: `GET /user/quests`, signed in. */
function Quests() {
  const { data, loading, error, reload } = useApi("quests", () => questsApi.list());
  const { refreshBalances } = useSession();
  const [claiming, setClaiming] = useState(null);
  const day = data?.dailyQuest?.first;
  const claim = async (key) => {
    setClaiming(key);
    try {
      const r = await questsApi.claim(key);
      alertSuccess(`${formatAmount(r.amount)} ${r.currency} added to your balance.`);
      refreshBalances?.();
      reload();
    } catch (e) {
      alertFromError(e, "That reward could not be claimed.");
    } finally {
      setClaiming(null);
    }
  };
  if (loading) return <p className="RaceInfoModal_text">Loading…</p>;
  if (error || !day?.quests?.length) {
    return (
      <div className="CardGridEmpty_root">
        <img alt="" height="62" src="/icons/cross.svg" width="62" />
        <p>{error?.message || "No Quests"}</p>
      </div>
    );
  }
  return (
    <div className="RewardStack_root">
      {day.endsAt && <p className="MiniList_meta">Resets {new Date(day.endsAt).toLocaleString()}</p>}
      {day.quests.map((q) => {
        const pct = Math.min(100, (Number(q.progress) / Number(q.target)) * 100 || 0);
        const fmt = (v) => (q.unit === "usd" ? `$${formatAmount(v)}` : Number(v).toLocaleString("en-US"));
        return (
          <div key={q.key} className="MiniList_root">
            <div className="MiniList_row">
              <span className="MiniList_heading">{q.title}</span>
              <span className="MiniList_meta">{q.completed ? "Completed" : `${fmt(q.progress)} / ${fmt(q.target)}`}</span>
            </div>
            <span className="MiniList_meta">{q.description}</span>
            <div className="MiniList_bar"><span style={{ width: `${pct}%` }} /></div>
            {Number(q.rewardUsd) > 0 && (
              <div className="MiniList_row">
                <span className="MiniList_meta">Reward ${formatAmount(q.rewardUsd)}</span>
                {q.claimed ? (
                  <span className="MiniList_meta">Claimed</span>
                ) : q.completed ? (
                  <button
                    type="button"
                    disabled={claiming != null}
                    onClick={() => claim(q.key)}
                    className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_primary"
                  >
                    <span className="ButtonVariants_buttonContent">{claiming === q.key ? "…" : "Claim"}</span>
                  </button>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** In-house challenge games (backend challenges.constants IN_HOUSE_GAMES) have no game page here. */
const IN_HOUSE = new Set(["classic_dice", "limbo", "crash", "plinko", "mine", "keno", "wheel", "tower", "hilo", "roulette", "blackjack"]);

function ChallengeCard({ c, index }) {
  const [ref, shown] = useReveal();
  const href = c.game && !IN_HOUSE.has(c.game) ? `/casino/games/${encodeURIComponent(c.game)}` : null;
  return (
    <a
      ref={ref}
      className={cx("ChallengeCard_challengeCardWrapper", "TallGameCard_reveal", shown && "TallGameCard_show")}
      style={{ "--card-i": index }}
      href={href || "/challenges"}
      onClick={(e) => {
        e.preventDefault();
        if (href) navigate(href);
      }}
    >
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
  const { signedIn } = useSession();
  const on = useGate();
  // Quests are a signed-in promotion: never for an agent's player (the `challenges` gate carries that).
  const tabs = signedIn && on("challenges") ? [...TABS.slice(0, 2), { id: "quests", label: "Quests" }, TABS[2]] : TABS;
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
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={cx("Tab_tab", tab === t.id && "Tab_active", t.disabled && "Tab_disabled")} disabled={t.disabled || tab === t.id} onClick={() => { setTab(t.id); setCount(PAGE); }}>
                <p className="Tab_text">{t.label}</p>
              </button>
            ))}
          </div>
        </div>

        {tab === "quests" ? <Quests /> : <div className="CardGrid_cardGridWrapper">
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
        </div>}
      </section>

      <ActivityBoard hideTabs={["race"]} />
    </div>
  );
}
