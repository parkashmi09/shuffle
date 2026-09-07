import { CarouselHeader, SwipeTrack } from "../ui/Carousel";
import { useCarousel } from "../../lib/carousel";
import { PromoBanner, RankOrdinal, UserCell } from "./PromoWidgets";

const tournaments = [
  {
    id: "freak-show",
    title: "$20,000 - Freak Show!",
    href: "/promotions/freak-show",
    countdown: "5d 13h 23m",
    image: "/images/banners/freak-show-tile.webp",
    kind: "qualifier",
    completed: 0,
    total: 6,
  },
  {
    id: "mines-master",
    title: "$20,000 - Mines Master!",
    href: "/promotions/mines-master",
    countdown: "11d 14h 20m",
    image: "/images/banners/mines-master-tile.webp",
    kind: "scores",
    scores: [
      { rank: 1, user: { name: "vladz", vip: "gold" }, value: "3,232.84x" },
      { rank: 2, user: null, value: "2,828.73x" },
      { rank: 3, user: null, value: "2,087.25x" },
    ],
  },
  {
    id: "weekly-race",
    title: "$100K WEEKLY Race",
    href: "/promotions/100000-weekly-race",
    countdown: "20h 20m 22s",
    image: "/images/banners/100KWEEKLY_RACE.png",
    kind: "scores",
    scores: [
      { rank: 1, user: { name: "Benwarner", vip: "opal" }, value: "$18,750.00" },
      { rank: 2, user: null, value: "$11,250.00" },
      { rank: 3, user: { name: "GOATZK", vip: "opal" }, value: "$7,500.00" },
    ],
  },
];

function Qualifier({ t }) {
  return (
    <div className="QualifierUserInfo_root">
      <div className="ProgressBarSection_graph">
        <div className="ProgressBarSection_graphContent QualifierUserInfo_progressContent">
          <label htmlFor={`progress-${t.id}`}>
            <span className="QualifierUserInfo_progressLabel">Your Progress</span>
            <div className="ProgressBarSection_rightContainer">
              <img alt="tick" className="ProgressBarSection_notVested" src="/icons/green-tick.svg" />
            </div>
          </label>
          <div className="ProgressBarSection_progress ProgressBarSection_skipBorder">
            <progress id={`progress-${t.id}`} value={(t.completed / t.total) * 100} max="100" />
          </div>
          <p className="ProgressBarSection_supportText QualifierUserInfo_progressFooter">
            <span>Completed</span>
            <span className="ProgressBarSection_tokenAmount">
              {t.completed}/{t.total}
            </span>
          </p>
        </div>
      </div>
      <div className="QualifierUserInfo_statusSection">
        <div className="QualifierUserInfo_statusInfo">
          <img alt="Not Qualified" className="QualifierUserInfo_statusIcon" height="16" src="/icons/tick-circle-green.svg" width="16" />
          <span className="QualifierUserInfo_unqualifiedText">Not qualified</span>
        </div>
        <a className="QualifierUserInfo_viewDetailsButton" href={t.href} onClick={(e) => e.preventDefault()}>
          <span className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_link">
            <span className="ButtonVariants_buttonContent QualifierUserInfo_viewBtnBackground">View Details</span>
          </span>
        </a>
      </div>
    </div>
  );
}

function Scores({ t }) {
  return (
    <div className="ScoresUserInfo_root">
      <section className="ScoresUserInfo_scoresLeaderboard">
        {t.scores.map((s, i) => (
          <div key={s.rank} className="Flex_root Flex_sm HomePromotionUserRank_entry HomePromotionUserRank_entryVisible" style={{ "--entry-i": i }}>
            <RankOrdinal rank={s.rank} />
            <UserCell user={s.user} />
            <div className="HomePromotionUserRank_prizeAmount">
              <span className="MultiplierCell_root ScoresUserInfo_myScoreCell">
                <img alt="increase" height="16" src="/icons/multi-increase.svg" width="16" />
                <span>{s.value}</span>
              </span>
            </div>
          </div>
        ))}
      </section>
      <div className="ScoresUserInfo_myRankSection">
        <span className="ScoresUserInfo_myRankGroup">
          <img alt="trophy" className="ScoresUserInfo_iconFilter" height="16" src="/icons/trophy.svg" width="16" />-
        </span>
        <a className="ScoresUserInfo_viewDetailsButton" href={t.href} onClick={(e) => e.preventDefault()}>
          <span className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_link">
            <span className="ButtonVariants_buttonContent ScoresUserInfo_viewBtnBackground">View Details</span>
          </span>
        </a>
      </div>
    </div>
  );
}

/** Active tournaments + race tiles — reference `ActiveTournamentsAndRaceBanner`. */
export default function TournamentsCarousel() {
  const { trackRef, carousel } = useCarousel();

  return (
    <section>
      <CarouselHeader viewAll={null} carousel={carousel}>
        <span className="LabelLink_root LabelLink_lg">
          <span className="LabelLink_prefix">
            <img alt="" className="ActiveTournamentsAndRaceBanner_tournamentTrophy" height="24" src="/icons/trophy.svg" width="24" />
          </span>
          <span className="LabelLink_label">Tournaments</span>
        </span>
      </CarouselHeader>
      <SwipeTrack trackRef={trackRef} carousel={carousel} large className="ActiveTournamentsAndRaceBanner_carouselContent">
        {tournaments.map((t) => (
          <div key={t.id} className="TournamentBannerCard_card ActiveTournamentsAndRaceBanner_tile">
            <PromoBanner image={t.image} href={t.href} title={t.title} countdown={t.countdown} />
            {t.kind === "qualifier" ? <Qualifier t={t} /> : <Scores t={t} />}
          </div>
        ))}
      </SwipeTrack>
    </section>
  );
}
