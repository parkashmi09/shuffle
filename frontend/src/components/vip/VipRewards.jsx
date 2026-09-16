import { useCallback, useMemo, useState } from "react";
import { cx } from "../../lib/carousel";
import { bonus as bonusApi, rakeback as rakebackApi } from "../../lib/endpoints";
import { useApi } from "../../lib/useResource";
import { levelName } from "./vipTiers";

/**
 * "Your Rewards" — reference `VipRewardsCarousel` + `VipSidebarRewardBlock`.
 *
 * Four cards: the running rakeback balance, and the three recurring bonuses.
 * Two routes feed them, because on the backend they are two different things:
 *
 *   `GET /user/rakeback`  → `{ amount, currency, claimable, minimum, rate }`
 *   `GET /user/bonus`     → `{ currency, types: { daily, weekly, monthly } }`
 *
 * ── THE REFERENCE HAS SEVEN CARD STATES; THIS PLATFORM CAN TELL THREE ────
 *
 * `claimed / locked / cooldown / expired / claimable / view-only /
 * wager-to-unlock` is what the reference's reward block renders. Here:
 *
 *   LOCKED         the bonus needs a VIP level the player has not reached —
 *                  `eligible: false`. The button names the level, as the
 *                  reference's does; the status line above it does not.
 *   CLAIMABLE      an award is waiting and the player qualifies. The backend
 *                  computes `claimable` as *both*, which is the fix for a
 *                  legacy bug where the API reported ineligible and the claim
 *                  route paid out anyway; this side does not re-derive it.
 *   WAGER_TO_UNLOCK  eligible, nothing waiting. The reference would show a
 *                  countdown to the next claim — there is no next-claim
 *                  timestamp anywhere in `bonus.service.js`, so the card says
 *                  what it can stand behind rather than a time it cannot.
 *
 * `CLAIMED` is not a resting state here: a claimed award is deleted from the
 * pending set rather than flagged, so the card returns to waiting. It is used
 * for the moment right after a successful claim, so the click has an answer.
 *
 * Claims are real — `POST /user/bonus/claim/:type` and `POST /user/rakeback/claim`
 * both exist and both move money — so a failure is surfaced on the card rather
 * than swallowed, and the pair is re-read afterwards instead of being patched
 * locally.
 */

const STATUS = {
  CLAIMABLE: "claimable",
  CLAIMED: "claimed",
  LOCKED: "locked",
  WAGER: "wager",
};

/*
 * The three recurring cards, named and iconed as the live page names them.
 *
 * ── "DAILY RAKEBACK" IS THE REFERENCE'S WORD, NOT THIS BACKEND'S ─────────
 *
 * `bonus.constants.js` calls this type `daily` and pays it out of the
 * `dailybonus` column — it is a periodic bonus, and nothing about it is
 * computed from rake. The live page labels the same slot "Daily Rakeback", and
 * this is a clone of that page, so the label follows it. Worth knowing if the
 * two ever have to be reconciled: the *name* came from shuffle.com, the
 * *money* comes from `dailybonus`.
 */
const BONUS_CARDS = [
  { type: "daily", heading: "Daily Rakeback", icon: "/icons/daily-bonus.svg" },
  { type: "weekly", heading: "Weekly Bonus", icon: "/icons/weekly-bonus.svg" },
  { type: "monthly", heading: "Monthly Bonus", icon: "/icons/monthly-bonus.svg" },
];

/**
 * `2026-09-30T…` → `Expires in 22 days`. Null once the deadline has passed.
 *
 * Rounded, not truncated, in the two coarse buckets: a deadline 4 days and 23
 * hours out is "5 days" to a reader and "4 days" to `Math.floor`, and the
 * floor is the one that reads as wrong. Minutes are floored, because rounding
 * a minute *up* would promise time that has already gone.
 */
function expiresIn(deadline) {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;

  const minutes = ms / 60000;
  if (minutes < 60) return `Expires in ${Math.max(1, Math.floor(minutes))}m`;
  const hours = minutes / 60;
  if (hours < 24) return `Expires in ${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return `Expires in ${days} ${days === 1 ? "day" : "days"}`;
}

/*
 * The status line above a card's artwork.
 *
 * These are the reference's own strings and its own switch — locked and
 * eligible-but-empty both read "Wager to Unlock". An earlier pass put
 * "Reach VIP 20" on the locked one, which reads better but is not what the
 * reference says, and the level it names is already on the button underneath.
 */
function statusText(status, { expiry, error }) {
  if (error) return error;
  switch (status) {
    case STATUS.CLAIMED:
      return "Claimed";
    case STATUS.LOCKED:
    case STATUS.WAGER:
      return "Wager to Unlock";
    default:
      return expiry ?? "Claim now";
  }
}

/**
 * One card. `Card_root` + `Card_pageVariant` is the reference's shared card
 * shell; everything `VipSidebarRewardBlock_*` on top of it is the reward
 * skin — the header line, the coloured status text and the not-a-button that
 * stands in for the claim button when there is nothing to claim.
 */
function RewardCard({ heading, icon, status, expiry, minVipRank, busy, error, onClaim }) {
  const tone = status === STATUS.CLAIMED ? "claimed" : status === STATUS.LOCKED ? "locked" : null;
  const toneClass = tone ? `VipSidebarRewardBlock_${tone}` : null;

  return (
    <section className="Card_root Card_pageVariant" data-testid={heading}>
      <div className="Card_header VipRewardsCarousel_vipRewardBlockIconContainer">
        <p className={cx("VipSidebarRewardBlock_vipStatusText", toneClass)}>
          {statusText(status, { expiry, error })}
        </p>
        <img
          src="/icons/small-gift.svg"
          height="16"
          width="16"
          alt="gift"
          className={cx("VipSidebarRewardBlock_giftIcon", toneClass)}
        />
      </div>

      <div className="Flex_root Flex_column Flex_sm5 Card_content Card_pageVariant">
        <img src={icon} alt="" />
        {/* Heading only. The reference renders no `Card_description` here —
            an earlier pass put the pending amount under the name, which is a
            line the live card does not have and which pushed it 22px taller
            than the reference's 257. The figure belongs in the claim flow. */}
        <div className="Flex_root Flex_column Flex_center Flex_sm1">
          <div className="Card_heading">
            <p className={cx("VipSidebarRewardBlock_vipRewardHeader", toneClass)}>{heading}</p>
          </div>
        </div>
      </div>

      <div className="Flex_root Flex_wide Flex_center Card_lastButton">
        <div className="Flex_root Flex_wide VipSidebarRewardBlock_button">
          {status === STATUS.CLAIMABLE ? (
            <button
              type="button"
              disabled={busy}
              onClick={onClaim}
              className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_success"
            >
              <span className="ButtonVariants_buttonContent">Claim</span>
            </button>
          ) : status === STATUS.LOCKED || status === STATUS.CLAIMED ? (
            <div className={cx("VipSidebarRewardBlock_vipAlternativeBtn", toneClass, "VipRewardsCarousel_vipClaimedBtn")}>
              <img
                src={status === STATUS.CLAIMED ? "/icons/tick-complete.svg" : "/icons/lock.svg"}
                className={cx("VipSidebarRewardBlock_giftIcon", toneClass)}
                alt={status === STATUS.CLAIMED ? "complete" : "locked"}
                width="16"
                height="16"
              />
              {status === STATUS.CLAIMED ? "Claimed" : minVipRank || "Locked"}
            </div>
          ) : (
            <button
              type="button"
              disabled
              className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary"
            >
              <span className="ButtonVariants_buttonContent">Claim</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default function VipRewards({ levels }) {
  const { data: rake, reload: reloadRake } = useApi("vip:rakeback", () => rakebackApi.amount());
  const { data: bonuses, reload: reloadBonuses } = useApi("vip:bonus", () => bonusApi.overview());

  /* `{ [cardId]: "busy" | "claimed" | errorMessage }` — per card, so one
     failing claim does not put the other three into an error state. */
  const [claims, setClaims] = useState({});

  const claim = useCallback(async (id, call, reload) => {
    setClaims((c) => ({ ...c, [id]: "busy" }));
    try {
      await call();
      setClaims((c) => ({ ...c, [id]: "claimed" }));
      reload();
    } catch (error) {
      setClaims((c) => ({ ...c, [id]: error?.message || "Claim failed" }));
    }
  }, []);

  const cards = useMemo(() => {
    const list = [];

    if (rake) {
      const claimed = claims.rakeback === "claimed";
      list.push({
        id: "rakeback",
        heading: "Instant Rakeback",
        icon: "/icons/rake.svg",
        status: claimed ? STATUS.CLAIMED : rake.claimable ? STATUS.CLAIMABLE : STATUS.WAGER,
      });
    }

    for (const card of BONUS_CARDS) {
      const entry = bonuses?.types?.[card.type];
      if (!entry) continue;
      const claimed = claims[card.type] === "claimed";
      list.push({
        id: card.type,
        heading: card.heading,
        icon: card.icon,
        /* The rank's name, not its number: the reference's locked button
           reads "Bronze 1", and `minVipLevel` is an ordinal the player has
           never been shown. Falls back to the ordinal if the ladder has not
           loaded yet, which is briefly true on a cold page. */
        minVipRank: levelName(levels, entry.minVipLevel) || `VIP ${entry.minVipLevel}`,
        expiry: expiresIn(entry.award?.deadline),
        status: claimed
          ? STATUS.CLAIMED
          : !entry.eligible
            ? STATUS.LOCKED
            : entry.claimable
              ? STATUS.CLAIMABLE
              : STATUS.WAGER,
      });
    }

    return list;
  }, [rake, bonuses, claims, levels]);

  /* The badge counts what can be acted on right now, which is what the
     reference's notification count is. */
  const claimable = cards.filter((c) => c.status === STATUS.CLAIMABLE).length;

  return (
    <div className="VipOverviewSectionWrapper_root">
      <div className="VipRewardsCarousel_headingWrapper">
        <img src="/icons/small-gift.svg" height="24" width="24" alt="gift" className="VipRewardsCarousel_headingIcon" />
        <span className="VipSectionTitle_root">Your Rewards</span>
        <div className="VipRewardsCarousel_rewardsBadge">{claimable}</div>
      </div>

      {cards.length ? (
        <div className="VipRewardsCarousel_rewardsGrid">
          {cards.map((card) => {
            const state = claims[card.id];
            return (
              <div key={card.id} className="VipRewardsCarousel_rewardsWrapper">
                <RewardCard
                  {...card}
                  busy={state === "busy"}
                  error={state && state !== "busy" && state !== "claimed" ? state : null}
                  onClaim={() =>
                    claim(
                      card.id,
                      card.id === "rakeback" ? () => rakebackApi.claim() : () => bonusApi.claim(card.id),
                      card.id === "rakeback" ? reloadRake : reloadBonuses
                    )
                  }
                />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="VipPageOverview_description">You currently don’t have any VIP Rewards available to claim.</p>
      )}
    </div>
  );
}
