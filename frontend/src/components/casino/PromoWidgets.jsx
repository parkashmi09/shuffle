import { cx } from "../../lib/carousel";

const CIRCUMFERENCE = 2 * Math.PI * 28;

/** Ring progress indicator with the Shuffle mark inside. */
export function CircleProgress({ progress = 0, size }) {
  const offset = CIRCUMFERENCE * (1 - progress);
  return (
    <div className="CircleProgress_root" style={size ? { width: size, height: size } : undefined}>
      <svg aria-hidden="true" className="CircleProgress_svg" viewBox="-2 -2 64 64">
        <circle className="CircleProgress_track" cx="30" cy="30" r="28" fill="none" strokeWidth="6" />
        <circle
          className="CircleProgress_fill"
          cx="30"
          cy="30"
          r="28"
          fill="none"
          strokeWidth="6"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 30 30)"
        />
      </svg>
      <div className="CircleProgress_inner">
        <img alt="" height="24" src="/icons/shuffle-logo.svg" width="24" />
      </div>
    </div>
  );
}

const trophies = ["/icons/trophy-first.svg", "/icons/trophy-second.svg", "/icons/trophy-third.svg"];
const ordinal = (n) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) === 4 ? 0 : n % 10]}`;

export function RankOrdinal({ rank }) {
  const trophy = trophies[rank - 1];
  return (
    <div className="HomePromotionUserRank_entryRank">
      {trophy ? (
        <div className="Flex_root Flex_sm4">
          <img aria-hidden="true" alt={`rank ${rank}`} height="16" src={trophy} width="16" />
          <span className="HomePromotionUserRank_rankOrdinal">{ordinal(rank)}</span>
        </div>
      ) : (
        <span className="HomePromotionUserRank_rankOrdinal">{ordinal(rank)}</span>
      )}
    </div>
  );
}

export function UserCell({ user }) {
  if (!user) {
    return (
      <div className="AnonymousUser_root" title="This user has privacy enabled">
        <img alt="anonymous" height="16" src="/icons/anonymous.svg" width="16" />
        <span className="AnonymousUser_text">Hidden</span>
      </div>
    );
  }
  return (
    <button className="ButtonVariants_root ButtonVariants_buttonHeightAuto ButtonVariants_link ButtonVariants_hasIcon UserCell_userCell" type="button">
      <span className="ButtonVariants_buttonContent UserCell_userCellBackground">
        <span className="ButtonIcon_root">
          <span className="VipBadge_root">
            <span className="VipIcon_root">
              <img alt="vip icon" height="16" src={`/images/vip/${user.vip || "opal"}.svg`} width="16" />
            </span>
          </span>
        </span>
        <span className="UserCell_username">{user.name}</span>
      </span>
    </button>
  );
}

export function ShflAmount({ value, className, amountClass }) {
  return (
    <span className={cx("IconValue_root", className)}>
      <img alt="SHFL" className="CryptoIcon_root CryptoIcon_image" height="16" src="/icons/crypto/shfl.svg" width="16" />
      <span className={cx("FormattedAmount_root", amountClass, "formatted-amount-value")}>{value}</span>
    </span>
  );
}

/** Image banner with ring + title/countdown — reference `HomeBannerHeader`. */
export function PromoBanner({ image, href, title, countdown, countdownSuffix, progress = 0, size = "4.75rem" }) {
  return (
    <div className="HomeBannerHeader_banner">
      <img alt="tournament-tile" className="HomeBannerHeader_bg nimg-fill" decoding="async" loading="lazy" src={image} />
      <div className="Flex_root Flex_column Flex_lg2 HomeBannerHeader_bannerContent">
        <div>
          <CircleProgress progress={progress} size={size} />
        </div>
        <div className="HomePromotionHeading_weekInfo">
          <a className="TextLink_root HomePromotionHeading_link" href={href} onClick={(e) => e.preventDefault()}>
            <h4 className="HomePromotionHeading_weekLabel">{title}</h4>
          </a>
          <a className="HomePromotionHeading_countdown HomePromotionHeading_link" href={href} onClick={(e) => e.preventDefault()}>
            {countdown}&nbsp;{countdownSuffix && <span>{countdownSuffix}</span>}
            <img aria-hidden="true" alt="chevron" className="HomePromotionHeading_arrow" height="16" src="/icons/chevron-small.svg" width="16" />
          </a>
        </div>
      </div>
    </div>
  );
}
