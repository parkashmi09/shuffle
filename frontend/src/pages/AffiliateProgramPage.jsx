import { useCallback, useEffect, useMemo, useState } from "react";
import { cx } from "../lib/carousel";
import { navigate } from "../lib/router";
import { useApi } from "../lib/useResource";
import { useSession } from "../lib/sessionContext";
import { affiliate as affiliateApi } from "../lib/endpoints";
import { displayBalance, displayFiat } from "../lib/adapters";
import { injectAffiliateCommission } from "../lib/affiliateMarketingHtml";
import { enrichReferredMembers, sumAmounts, totalReferredWager } from "../lib/affiliateStats";
import { formatCommissionPercent, usePublicSiteConfig } from "../lib/usePublicSiteConfig";
import { buildReferralLink } from "../lib/referralCapture";
import { campaignDisplayName, listAffiliateCampaigns } from "../lib/affiliateCampaigns";
import CreateCampaignModal from "../components/affiliate/CreateCampaignModal";
import { HtmlPage } from "./StaticPage";
import overviewHtml from "../data/affiliate-overview.html?raw";

/**
 * `/affiliate/*` — reference `pages/affiliate/[tab]`.
 *
 * The signed-in affiliate pages, reached from the account menu's Affiliate
 * Program item. They are *not* `/affiliate`: that route stays the marketing
 * page the reference serves to everyone, signed in or not. What the menu opens
 * is `/affiliate/overview`, a four-tab dashboard that a signed-out visitor
 * never sees — which is why none of it was in the capture.
 *
 * Overview keeps the marketing page's lower half (how to get started, the
 * commission formulas, the FAQ) below its own hero and stat row, so that part
 * is the captured markup again and only the top is built here.
 *
 * ── WHAT THE BACKEND CAN ANSWER ──────────────────────────────────────────
 *
 * `modules/affiliate` knows a referral code, the team that signed up under it,
 * commission already credited and commission unlocked but unclaimed. It has no
 * campaign object and does not total a referee's wager, so Campaigns shows the
 * one implicit campaign the code is, and Total Wagered is left at zero rather
 * than invented. Everything else on these four tabs is live.
 */

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "referred-users", label: "Referred Users" },
  { id: "campaigns", label: "Campaigns" },
  { id: "earnings", label: "Earnings" },
];

/** The reference writes every affiliate money value in the player's display fiat. */
function useFiat() {
  const { displayCurrency, rates } = useSession();
  return (amount, from) => displayFiat(amount ?? "0", from || displayCurrency, displayCurrency, rates);
}

/** Reference `ClipboardCopy` — the button beside a referral link. */
function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary ClipboardCopy_button"
      onClick={() => {
        navigator.clipboard?.writeText(value || "").then(
          () => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          },
          () => {}
        );
      }}
    >
      <span className="ButtonVariants_buttonContent">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function Overview({ link, signups, earnings, marketingHtml }) {
  return (
    <div className="Flex_root Flex_column Flex_lg1">
      <div className="AffiliateHero_contentWrapper">
        <div className="AffiliateHero_textContainer">
          <h2 className="AffiliateHero_title">
            <span className="AffiliateOverview_primaryViolet">SHARE</span> YOUR LINK!
          </h2>
          <p className="AffiliateHero_description">
            Earn lifetime commission from your referrals on all their wager across our Casino and
            Sportsbook with advanced real-time campaign performance tracking. Share your link to get
            started.
            <a href="https://help.shuffle.com/en/articles/6969004-shuffle-affiliate-program" rel="noopener noreferrer" target="_blank">
              {" "}Terms and Conditions
            </a>
          </p>
          <div className="AffiliateHero_formWrapper">
            <div className="TextInput_formControlWrapper AffiliateHero_inputContainer">
              <div className="InputWrapper_root">
                <input className="Input_root" readOnly aria-label="Your referral link" value={link} title={link} />
              </div>
            </div>
            <CopyButton value={link} />
          </div>
        </div>
        <div className="AffiliateHero_mediaContainer">
          <div className="AffiliateHero_glowBg" />
          <img alt="affiliate megaphone" className="AffiliateHero_heroImage" src="/icons/affiliate/megaphone.png" />
        </div>
      </div>

      <section className="AffiliateUserStats_statsSection">
        <div className="AffiliateUserStats_statsContainer">
          <div className="AffiliateUserStats_statsText">
            <p className="AffiliateUserStats_statsHeading">Lifetime Signups</p>
            <p className="AffiliateUserStats_statsValue">{signups} users</p>
          </div>
        </div>
        <div className="AffiliateUserStats_statsContainer">
          <div className="AffiliateUserStats_statsText">
            <p className="AffiliateUserStats_statsHeading">Total wagered</p>
            <p className="AffiliateUserStats_statsValue">
              <span className="IconValue_root FormattedAmount_root AffiliateOverview_statsValue">{earnings.wagered}</span>
            </p>
          </div>
        </div>
        <div className="AffiliateUserStats_statsContainer">
          <div className="AffiliateUserStats_statsText">
            <p className="AffiliateUserStats_statsHeading">Referral Earnings</p>
            <p className="AffiliateUserStats_statsValue">
              <span className="IconValue_root FormattedAmount_root AffiliateOverview_statsValue">{earnings.total}</span>
            </p>
          </div>
        </div>
      </section>

      <HtmlPage html={marketingHtml} />
    </div>
  );
}

function ReferredUsers({ members, fiat }) {
  return (
    <div className="Flex_root Flex_column Flex_lg1">
      <div className="Table_root">
        <table className="Table_table ReferredUsers_table">
          <thead>
            <tr>
              <td>Username</td>
              <td>Registered</td>
              <td className="ReferredUsers_row">Campaign</td>
              <td className="ReferredUsers_row">Wagered</td>
              <td className="ReferredUsers_row">Commission Earned</td>
            </tr>
          </thead>
          {members.length > 0 && (
            <tbody>
              {members.map((m) => (
                <tr key={m.name}>
                  <td>{m.name}</td>
                  <td>{m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : "—"}</td>
                  <td className="ReferredUsers_row">{m.campaign || "—"}</td>
                  <td className="ReferredUsers_row ReferredUsers_amount">
                    <span className="IconValue_root FormattedAmount_root">{fiat(m.wagered)}</span>
                  </td>
                  <td className="ReferredUsers_row ReferredUsers_amount">
                    <span className="IconValue_root FormattedAmount_root">{fiat(m.commission)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
        {members.length === 0 && (
          <div className="Table_noResult"><p>No referred users.</p></div>
        )}
      </div>
    </div>
  );
}

function Campaigns({ name, link, signups, earnings, commissionRate }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="Flex_root Flex_column Flex_sm4">
      <div className="Campaigns_campaignElement">
        <button type="button" className="Campaigns_campaignHeader" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <div className="Campaigns_campaignTitleElement">
            <div className="Campaigns_campaignTitle">{name}</div>
            <div className="Campaigns_campaignSubtitle">
              <div className="Campaigns_textEllipsis">{link}</div>
            </div>
          </div>
          <div className="Flex_root Flex_md2" style={{ alignItems: "center" }}>
            <div className="Campaigns_campaignTitleElement">
              <div className="Campaigns_commissionEarned">Commission Earned:</div>
              <div className="Flex_root Flex_sm4" style={{ alignItems: "center" }}>
                <span className="IconValue_root FormattedAmount_root">{earnings}</span>
              </div>
            </div>
            <img alt="arrow" className={cx(open && "Campaigns_up")} src="/icons/chevron.svg" />
          </div>
        </button>
        <div className={cx("Campaigns_campaignBody", open && "Campaigns_isExpanded")}>
          <div className="Campaigns_campaignBodyContent">
            <div className="Campaigns_campaignStats">
              <div className="Flex_root Flex_column Flex_wide Flex_sm2">
                <div className="Campaigns_campaignTitle">Signups</div>
                <div className="Campaigns_commissionEarned">{signups}</div>
              </div>
              <div className="Flex_root Flex_column Flex_wide Flex_sm2">
                <div className="Campaigns_campaignTitle">Commission Rate</div>
                <div className="Campaigns_commissionEarned">{commissionRate}</div>
              </div>
            </div>
            <div className="Campaigns_campaignReferral">
              <div className="Campaigns_campaignReferralTitle">Referral Link</div>
              <div className="Flex_root Flex_wide Flex_sm4">
                <div className="Campaigns_campaignReferralLink">{link}</div>
                <div><CopyButton value={link} /></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Earnings({
  currency,
  claimed,
  claimable,
  rows,
  onClaim,
  claiming,
  canClaim,
  rewardLines,
  onClaimOne,
  claimingRewardId,
}) {
  return (
    <>
      <div className="Flex_root Flex_lg1 Earnings_earningsCardContainer">
        <div className="Earnings_earningsCard">
          <img alt="piggy bank" src="/icons/piggy-bank.svg" />
          <div>
            <div className="Earnings_earningsCardHeader">
              Total Claimed
              <span className="Tooltip_trigger">
                <img alt="info" width="16" height="16" className="Earnings_earningsCardTooltip" src="/icons/info.svg" />
              </span>
            </div>
            <h4 className="Earnings_earningsCardText">{claimed}{" "}{currency}</h4>
          </div>
        </div>
        <div className="Earnings_earningsCard">
          <img alt="amount" src="/icons/total-wagered.svg" />
          <div>
            <div className="Earnings_earningsCardHeader">
              Total Claimable
              <span className="Tooltip_trigger">
                <img alt="info" width="16" height="16" className="Earnings_earningsCardTooltip" src="/icons/info.svg" />
              </span>
            </div>
            <h4 className="Earnings_earningsCardText">{claimable}{" "}{currency}</h4>
          </div>
          <button
            type="button"
            className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary"
            disabled={claiming || !canClaim}
            onClick={onClaim}
          >
            <span className="ButtonVariants_buttonContent">Claim</span>
          </button>
        </div>
      </div>

      <div className="Table_root">
        <table className="Table_table Earnings_table">
          <thead>
            <tr>
              <td>Cryptocurrency</td>
              <td>Previously claimed</td>
              <td>Claimable</td>
            </tr>
          </thead>
          {rows.length > 0 && (
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.currency}</td>
                  <td className="Earnings_amount">
                    <span className="IconValue_root FormattedAmount_root">
                      {displayBalance(r.claimed ?? "0", r.currency)}
                    </span>
                  </td>
                  <td className="Earnings_amount">
                    <span className="IconValue_root FormattedAmount_root">
                      {displayBalance(r.claimable ?? "0", r.currency)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
        {rows.length === 0 && (
          <div className="Table_noResult"><p>No unclaimed commissions</p></div>
        )}
      </div>

      {rewardLines?.length > 0 && (
        <div className="Table_root" style={{ marginTop: "1.5rem" }}>
          <table className="Table_table Earnings_table">
            <thead>
              <tr>
                <td>Referred player</td>
                <td>Tier wager</td>
                <td>Reward</td>
                <td />
              </tr>
            </thead>
            <tbody>
              {rewardLines.map((r) => (
                <tr key={r.id}>
                  <td>{r.member || "—"}</td>
                  <td>{r.tier ?? "—"}</td>
                  <td className="Earnings_amount">
                    {displayBalance(r.amount, r.currency || currency)} {r.currency || currency}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary"
                      disabled={claiming || claimingRewardId === r.id}
                      onClick={() => onClaimOne(r.id)}
                    >
                      <span className="ButtonVariants_buttonContent">
                        {claimingRewardId === r.id ? "Claiming…" : "Claim"}
                      </span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function AffiliateProgramPage({ tab = "overview" }) {
  const { user, displayCurrency, rates } = useSession();
  const { affiliateEnabled, commissionPercent } = usePublicSiteConfig();
  const fiat = useFiat();
  const [claiming, setClaiming] = useState(false);
  const [claimingRewardId, setClaimingRewardId] = useState(null);
  const [nonce, setNonce] = useState(0);
  const [createCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [savedCampaigns, setSavedCampaigns] = useState([]);

  const { data: info } = useApi("affiliate:info", () => affiliateApi.referralInfo(), { enabled: affiliateEnabled });
  const { data: team } = useApi("affiliate:team", () => affiliateApi.team(), { enabled: affiliateEnabled });
  const { data: rewards } = useApi(`affiliate:rewards:${nonce}`, () => affiliateApi.rewards(), { enabled: affiliateEnabled });
  const { data: unclaimed } = useApi(`affiliate:unclaimed:${nonce}`, () => affiliateApi.unclaimed(), {
    enabled: affiliateEnabled,
  });

  const commissionRate = formatCommissionPercent(commissionPercent);
  const overviewMarkup = useMemo(
    () => injectAffiliateCommission(overviewHtml, commissionPercent),
    [commissionPercent]
  );

  // The reference shows the bare share URL, not the backend's `/referal/<code>`
  // path — `https://shuffle.com?r=<code>`, which is what the register form reads.
  const link = info?.referralCode
    ? buildReferralLink(window.location.origin, info.referralCode)
    : "";
  // Commission is paid in one currency platform-wide; the unclaimed read is the
  // only endpoint that names it.
  const rewardCurrency = unclaimed?.currency || displayCurrency;
  const campaignLabel = info?.referralCode || user?.name || "Default";
  const signups = team?.total ?? 0;

  const members = useMemo(
    () => enrichReferredMembers(team?.members ?? [], rewards?.rows ?? [], campaignLabel),
    [team?.members, rewards?.rows, campaignLabel]
  );

  const referralCode = info?.referralCode || "";

  const refreshSavedCampaigns = useCallback(() => {
    if (!referralCode) {
      setSavedCampaigns([]);
      return;
    }
    setSavedCampaigns(listAffiliateCampaigns(referralCode));
  }, [referralCode]);

  useEffect(() => {
    refreshSavedCampaigns();
  }, [refreshSavedCampaigns]);

  const campaignGroups = useMemo(() => {
    const code = referralCode;
    const origin = window.location.origin;
    const groups = new Map();

    const ensureGroup = (key, displayName, campaignId) => {
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          name: displayName,
          link: code ? buildReferralLink(origin, code, campaignId) : "",
          signups: 0,
        });
      }
    };

    const defaultGroupKey = `default:${campaignLabel}`;

    for (const m of team?.members ?? []) {
      const campaignId = String(m.campaign || "").trim();
      if (!campaignId) {
        ensureGroup(defaultGroupKey, campaignLabel, "");
        groups.get(defaultGroupKey).signups += 1;
      } else {
        const displayName = campaignDisplayName(campaignId, savedCampaigns, campaignId);
        ensureGroup(campaignId, displayName, campaignId);
        groups.get(campaignId).signups += 1;
      }
    }

    for (const row of savedCampaigns) {
      ensureGroup(row.id, row.name, row.id);
    }

    if (!groups.size && link) {
      groups.set(defaultGroupKey, {
        key: defaultGroupKey,
        name: campaignLabel,
        link,
        signups: signups,
      });
    }
    return [...groups.values()];
  }, [team?.members, referralCode, campaignLabel, link, signups, savedCampaigns]);

  const earnings = useMemo(() => {
    const wagered =
      team?.totalWager != null && team.totalWager !== ""
        ? team.totalWager
        : totalReferredWager(rewards?.rows ?? []);
    // Joining bonuses and tier unlocks live in `unlocked_rewards`; wager commission
    // is in `rewards`. Overview must count both, not commission rows alone.
    const unlockLifetime = sumAmounts([
      unclaimed?.claimedTotal ?? "0",
      unclaimed?.total ?? "0",
    ]);
    const lifetimeReferral = sumAmounts([unlockLifetime, rewards?.totalAmount ?? "0"]);
    return {
      total: `${displayBalance(lifetimeReferral, rewardCurrency)} ${rewardCurrency}`,
      wagered: displayFiat(wagered, displayCurrency, displayCurrency, rates),
    };
  }, [rewards, team?.totalWager, unclaimed?.claimedTotal, unclaimed?.total, rewardCurrency, displayCurrency, rates]);

  const earningRows = useMemo(
    () =>
      rewardCurrency
        ? [
            {
              id: rewardCurrency,
              currency: rewardCurrency,
              claimed: unclaimed?.claimedTotal ?? "0",
              claimable: unclaimed?.total ?? "0",
            },
          ]
        : [],
    [rewardCurrency, unclaimed?.claimedTotal, unclaimed?.total]
  );

  const canClaim = (Number.parseFloat(unclaimed?.total ?? "0") || 0) > 0;

  if (!affiliateEnabled) {
    return (
      <section className="LayoutContainer_root AffiliateProgram_layoutContainer LayoutContainer_mobile-top-lg2 LayoutContainer_mobile-bottom-lg2 LayoutContainer_column">
        <div className="Flex_root Flex_column AffiliateProgram_root">
          <h2 className="Heading_root Heading_h2 TitlePage_root AffiliateProgram_pageTitle">Shuffle Affiliate Program</h2>
          <p className="AffiliateHero_description">The affiliate program is not available right now.</p>
        </div>
      </section>
    );
  }

  const claimAll = async () => {
    setClaiming(true);
    try {
      await affiliateApi.claimAll();
      setNonce((n) => n + 1);
    } catch {
      // The button simply stays live; the reference shows no error here either.
    } finally {
      setClaiming(false);
    }
  };

  const claimOne = async (rewardId) => {
    setClaimingRewardId(rewardId);
    try {
      await affiliateApi.claimOne(rewardId);
      setNonce((n) => n + 1);
    } catch {
      /* keep row visible for retry */
    } finally {
      setClaimingRewardId(null);
    }
  };

  const openCreateCampaign = () => {
    if (!referralCode) return;
    refreshSavedCampaigns();
    setCreateCampaignOpen(true);
  };

  const rewardLines = unclaimed?.rows ?? [];

  return (
    <section className="LayoutContainer_root AffiliateProgram_layoutContainer LayoutContainer_mobile-top-lg2 LayoutContainer_mobile-bottom-lg2 LayoutContainer_column">
      <div className="Flex_root Flex_column AffiliateProgram_root">
        <h2 className="Heading_root Heading_h2 TitlePage_root AffiliateProgram_pageTitle">Shuffle Affiliate Program</h2>

        <div className="AffiliateProgram_tabContainer">
          <div className="Tab_root">
            <div className="Tab_tabsContainer" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={t.id === tab}
                  className={cx("Tab_tab", t.id === tab && "Tab_active")}
                  disabled={t.id === tab}
                  value={t.id}
                  onClick={() => navigate(`/affiliate/${t.id}`)}
                >
                  <p className="Tab_text">{t.label}</p>
                </button>
              ))}
            </div>
          </div>
          {tab === "campaigns" && (
            <div className="AffiliateProgram_buttonGroup">
              <button
                type="button"
                className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary"
                onClick={openCreateCampaign}
                disabled={!referralCode}
              >
                <span className="ButtonVariants_buttonContent">Create Campaign</span>
              </button>
            </div>
          )}
        </div>

        {tab === "overview" && (
          <Overview link={link} signups={signups} earnings={earnings} marketingHtml={overviewMarkup} />
        )}
        {tab === "referred-users" && <ReferredUsers members={members} fiat={fiat} />}
        {tab === "campaigns" && (
          <div className="Flex_root Flex_column Flex_sm4">
            {campaignGroups.map((c) => (
              <Campaigns
                key={c.key}
                name={c.name}
                link={c.link}
                signups={c.signups}
                earnings={earnings.total}
                commissionRate={commissionRate}
              />
            ))}
          </div>
        )}
        {tab === "earnings" && (
          /*
           * The two earnings cards are the one place the reference does NOT
           * convert to the display fiat — it prints the reward currency's own
           * amount with the code beside it (`0.00 INR`). Kept that way: the
           * platform pays commission in one currency and says which.
           */
          <Earnings
            currency={rewardCurrency}
            claimed={displayBalance(unclaimed?.claimedTotal ?? "0", rewardCurrency)}
            claimable={displayBalance(unclaimed?.total ?? "0", rewardCurrency)}
            rows={earningRows}
            claiming={claiming}
            canClaim={canClaim}
            onClaim={claimAll}
            rewardLines={rewardLines}
            onClaimOne={claimOne}
            claimingRewardId={claimingRewardId}
          />
        )}
      </div>

      {createCampaignOpen && referralCode && (
        <CreateCampaignModal
          referralCode={referralCode}
          onClose={() => setCreateCampaignOpen(false)}
          onCreated={(campaigns) => setSavedCampaigns(campaigns)}
        />
      )}
    </section>
  );
}
