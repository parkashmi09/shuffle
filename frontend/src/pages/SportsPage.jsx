import { Fragment, useRef, useState } from "react";
import HeroBanners from "../components/casino/HeroBanners";
import ActivityBoard from "../components/casino/ActivityBoard";
import { CircleProgress, RankOrdinal, UserCell } from "../components/casino/PromoWidgets";
import { SwipeTrack } from "../components/ui/Carousel";
import { cx, useCarousel } from "../lib/carousel";
import { navigate, useSearch } from "../lib/router";
import { SeoArticle } from "./LatestReleasesPage";
import sports from "../data/sports.json";
import staticData from "../data/sports-static.json";
import fixtures from "../data/sports-fixtures.json";
import groupData from "../data/sports-groups.json";
import upcoming from "../data/sports-upcoming.json";
import liveData from "../data/sports-live.json";
import allSports from "../data/sports-all.json";
import seoHtml from "../data/seo-sports.html?raw";

/**
 * Sportsbook home — reference `/sports`. The original renders everything
 * below the banners client-side; the fixtures, same-game multis and
 * tournament standings here were captured from its live DOM.
 */

const stop = (e) => e.preventDefault();
const logo = (id) => `/images/sports/logos/${id}.png`;
const PITCH = "/images/sports/banner/sports-soccer.webp";
const TOOL_ICONS = { "2up": "/icons/2up.svg", "custom bet": "/icons/custom-bet.svg", play: "/icons/play.svg", stats: "/icons/sports-stats.svg" };

/** Featured / Upcoming / Bet Live / All Sports strip — reference `NavTabs` + `TabViewOutline`. */
function NavTabs({ active, onChange }) {
  return (
    <section className="LayoutContainer_root LayoutContainer_mobile-top-sm4 LayoutContainer_tablet-bottom-sm4 LayoutContainer_column">
      <div className="NavTabs_horizontalTabsWithArrowsWrapper">
        <button className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_iconTransparent NavTabs_arrow NavTabs_horizontalTabsArrowLeft" type="button">
          <span className="ButtonVariants_buttonContent">
            <img alt="arrow left" src="/icons/chevron.svg" />
          </span>
        </button>
        <div className="TabViewOutline_root">
          <div className="TabViewOutline_tabOutlineWrapper">
            {sports.tabs.map((t) => (
              <a
                key={t.id}
                className={cx("TabViewOutline_tabOutline", active === t.id && "TabViewOutline_tabOutlineActive")}
                data-testid={t.id}
                data-text={t.label}
                href={t.href}
                id={t.id}
                onClick={(e) => { e.preventDefault(); onChange(t.href); }}
              >
                <span className={cx("TabViewOutline_tabName", t.counter && "TabViewOutline_tabNameWithCounter")}>
                  {t.label}
                  {t.counter && (
                    <span className="TabViewOutline_counter" style={{ background: "rgb(20, 146, 0)" }}>
                      {t.counter}
                    </span>
                  )}
                </span>
              </a>
            ))}
          </div>
        </div>
        <button className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_iconTransparent NavTabs_arrow NavTabs_horizontalTabsArrowRight" type="button">
          <span className="ButtonVariants_buttonContent">
            <img alt="arrow right" src="/icons/chevron.svg" />
          </span>
        </button>
      </div>
    </section>
  );
}

/** Sport icon rail — reference `SportsCategoryCarousel`. */
function CategoryCarousel({ cats, selected, onSelect, section }) {
  const ref = useRef(null);
  const [atEnd, setAtEnd] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const scroll = (dir) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
    setAtStart(el.scrollLeft <= 0);
  };
  return (
    <section className="LayoutContainer_root LayoutContainer_column">
      <section className="SportsCategoryCarousel_root">
        <div ref={ref} className="SportsCategoryCarousel_categoryContainer" onScroll={onScroll}>
          {cats.map(([name, icon, alt, counter, code]) => (
            <a
              key={code}
              data-testid={`sports-category-${name}`}
              className={cx("SportsCategoryCarousel_slideItem", selected === code && "SportsCategoryCarousel_selected")}
              href={section ? `/sports?section=${section}&sport=${code}` : `/sports?sport=${code}`}
              onClick={(e) => { e.preventDefault(); onSelect(code); }}
            >
              <div className="SportsCategoryCarousel_icon">
                <img alt={alt} src={icon} />
              </div>
              {counter && <span className={cx("SportsCategoryCarousel_counterBadge", selected === code && "SportsCategoryCarousel_selected")}>{counter}</span>}
              <span className={cx("SportsCategoryCarousel_name", selected === code && "SportsCategoryCarousel_selected")}>{name}</span>
            </a>
          ))}
        </div>
        {!atStart && (
          <button type="button" className="SearchScrollableContainer_button SearchScrollableContainer_leftNav SearchScrollableContainer_showNav" aria-label="scroll to left" onClick={() => scroll(-1)}>
            <img alt="arrow left" src="/icons/chevron.svg" />
          </button>
        )}
        {!atEnd && (
          <button type="button" className="SearchScrollableContainer_button SearchScrollableContainer_rightNav SearchScrollableContainer_showNav" aria-label="scroll to right" onClick={() => scroll(1)}>
            <img alt="arrow right" src="/icons/chevron.svg" />
          </button>
        )}
      </section>
    </section>
  );
}

/** Section heading with icon + arrows — reference `CarouselHeader` with a `LabelLink` title. */
function SportsCarouselHeader({ icon, iconClass, title, carousel }) {
  return (
    <div className="Flex_root Flex_spaced">
      <h3 className="Heading_root Heading_h3 CarouselHeader_heading">
        <span className="LabelLink_root LabelLink_lg">
          <span className="LabelLink_prefix">
            <img alt="" width="24" height="24" className={iconClass} src={icon} />
          </span>
          <span className="LabelLink_label">{title}</span>
        </span>
      </h3>
      <div className="Flex_root Flex_sm4 Flex_center">
        <button disabled={carousel.atStart} aria-label="scroll left" className="CarouselHeader_navButton" type="button" onClick={carousel.prev}>
          <img className="CarouselHeader_leftArrow" width="16" height="16" alt="arrow left" src="/icons/chevron.svg" />
        </button>
        <button disabled={carousel.atEnd} aria-label="scroll right" className="CarouselHeader_navButton" type="button" onClick={carousel.next}>
          <img className="CarouselHeader_rightArrow" width="16" height="16" alt="arrow right" src="/icons/chevron.svg" />
        </button>
      </div>
    </div>
  );
}

function ToolbarIcon({ alt, href }) {
  const inner = (
    <span className="ButtonVariants_buttonContent ToolbarButton_buttonXs">
      <span className="ButtonIcon_root">
        <img alt={alt} width="16" height="16" src={TOOL_ICONS[alt]} />
      </span>
    </span>
  );
  const green = alt === "play" || alt === "stats";
  return (
    <div>
      <span className="Tooltip_trigger">
        {green ? (
          <button type="button" className="ButtonVariants_root ButtonVariants_buttonHeightXSmall ButtonVariants_iconTransparent ButtonVariants_hasIcon ToolbarButton_green">
            {inner}
          </button>
        ) : (
          <a className="" href={href} onClick={stop}>
            <span className="ButtonVariants_root ButtonVariants_buttonHeightXSmall ButtonVariants_iconTransparent ButtonVariants_hasIcon">{inner}</span>
          </a>
        )}
      </span>
    </div>
  );
}

/** Live match tile with 1X2 odds — reference `FeaturedFixtureCard`. */
function FixtureCard({ f }) {
  const [picked, setPicked] = useState(null);
  return (
    <div className="FeaturedFixtureCard_cardWrapper">
      <a className="FeaturedFixtureCard_cardLink" aria-label={f.competitors.map((c) => c[0]).join(" vs ")} href={f.href} onClick={stop} />
      <div className="Flex_root Flex_column FeaturedFixtureCard_card">
        <div className="Flex_root Flex_md FeaturedFixtureCard_header">
          <div className="Flex_root Flex_sm4 FeaturedFixtureCard_leftContent">
            <a className="TextLink_root LabelLink_root" href={f.leagueHref} onClick={stop}>
              <span className="LabelLink_prefix">
                <img alt="SOCCER" width="20" height="20" className="FeaturedFixtureCard_sportIcon" src="/icons/sports/soccer.svg" />
              </span>
              <span className="LabelLink_label">{f.league}</span>
              <img height="16" width="16" alt="" className="LabelLink_chevron" src="/icons/chevron-small.svg" />
            </a>
          </div>
          <div className="Flex_root Flex_center ToolbarGroup_root ToolbarGroup_xs">
            <div>
              <span className="Tooltip_trigger">
                <div className="ToolbarButton_buttonXs">
                  <span className="Tag_tagBlock Tag_live Tag_md">LIVE</span>
                </div>
              </span>
            </div>
            {f.tools.map((tool) => (
              <ToolbarIcon key={tool} alt={tool} href={f.href} />
            ))}
            <div className="FixtureToolbar_marketCountButton">
              <a className="" href={f.href} onClick={stop}>
                <span className="ButtonVariants_root ButtonVariants_buttonHeightXSmall ButtonVariants_iconTransparent ButtonVariants_hasIcon">
                  <span className="ButtonVariants_buttonContent ToolbarButton_buttonXs">
                    <span className="ButtonIcon_root">
                      <span className="Counter_root Counter_neon FixtureToolbar_counter">{f.count}</span>
                    </span>
                  </span>
                </span>
              </a>
            </div>
          </div>
        </div>
        <div className="FeaturedFixtureCard_scoreboard" style={{ backgroundImage: `url("${PITCH}")` }}>
          <div className="Flex_root Flex_column Flex_lg FeaturedFixtureCard_competitors">
            {f.competitors.map(([name, id, score]) => (
              <div key={name} className="Flex_root Flex_sm4 FeaturedFixtureCard_competitor">
                <div className="ImageWithFallback_imageContainer" style={{ width: 20, height: 20 }}>
                  <img alt={name} width="20" height="20" loading="lazy" src={logo(id)} style={{ objectFit: "contain" }} />
                </div>
                <span className="FeaturedFixtureCard_competitorName">{name}</span>
                <span className="FeaturedFixtureCard_score">{score}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="FeaturedFixtureCard_selections">
          {f.selections.map(([name, odds], i) => {
            const suspended = odds === "Suspended";
            return (
              <button
                key={name}
                data-testid={i === 0 ? "bet-select" : ""}
                disabled={suspended}
                className={cx("ButtonVariants_root ButtonVariants_buttonHeightXLarge ButtonVariants_sportsBet SportsBetSelectionButton_root", picked === i && "SportsBetSelectionButton_selected")}
                type="button"
                onClick={() => setPicked((p) => (p === i ? null : i))}
              >
                <span className="ButtonVariants_buttonContent SportsBetSelectionButton_buttonBackground SportsBetSelectionButton_vertical">
                  <div className="SportsBetSelectionButton_selectionDetails">
                    <p className="SportsBetSelectionButton_selectionName">{name}</p>
                  </div>
                  {suspended ? (
                    <p className="SportsBetSelectionButton_oddsAndStatus SportsBetSelectionButton_warning">Suspended</p>
                  ) : (
                    <p className="SportsBetSelectionButton_oddsAndStatus">
                      <span className="Odds_oddsWrapper">
                        <span className="">{odds}</span>
                      </span>
                    </p>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TrendingCarousel() {
  const { trackRef, carousel } = useCarousel();
  return (
    <section className="FeaturedFixturesCarousel_root">
      <SportsCarouselHeader icon="/icons/global-star.svg" iconClass="FeaturedFixturesCarousel_icon" title="Trending Now" carousel={carousel} />
      <SwipeTrack trackRef={trackRef} carousel={carousel} large className="FeaturedFixturesCarousel_carouselContent">
        {fixtures.trending.map((f) => (
          <FixtureCard key={f.href} f={f} />
        ))}
      </SwipeTrack>
    </section>
  );
}

const HEADER_TEXT = {
  display: "flex",
  alignItems: "center",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  gap: "var(--spacing-sm4)",
};
const HEADER_DATE = {
  fontSize: "var(--text-md)",
  fontWeight: 400,
  lineHeight: 1.5,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  color: "var(--color-gray300)",
};
const MARKET_LINK = {
  transition: "var(--animation-duration)",
  fontSize: "var(--text-md)",
  fontWeight: 700,
  zIndex: "var(--z-above)",
  position: "relative",
  marginRight: "var(--spacing-sm3)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const LEAGUE_LINK = {
  transition: "var(--animation-duration)",
  color: "var(--color-white)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  zIndex: "var(--z-above)",
  position: "relative",
};

/** Kick-off time (or live phase) plus the fixture toolbar — reference `MatchEventHeader`. */
function FixtureHeader({ f }) {
  const phase = typeof f.live === "string" ? f.live : f.phase;
  return (
    <div className="Flex_root Flex_sm4 MatchEventHeader_matchElementHeader">
      <div style={HEADER_TEXT}>
        {f.si && (
          <a className="SportsIconLink_sportIcon" href={f.si[0]} onClick={stop}>
            <img alt={f.si[2]} src={f.si[1]} />
          </a>
        )}
        {f.live && <span className="Tag_tagBlock Tag_live Tag_md">LIVE</span>}
        <div
          className={cx("Flex_root Flex_sm1", f.marketName && "SportEventHeaderBlock_eventInfoWrap")}
          style={f.green ? { ...HEADER_DATE, color: "var(--color-success)" } : HEADER_DATE}
        >
          {f.live ? (
            <div className="Flex_root Flex_sm4" style={{ alignItems: "center" }}>
              {f.clock && <span className="MatchPhaseText_root">{f.clock}</span>}
              <span className="MatchPhaseText_root">{phase}</span>
            </div>
          ) : (
            <>
              {f.marketName && (
                <a className="SportEventHeaderBlock_eventLinkHover SportEventHeaderBlock_marketName" href={f.href} style={MARKET_LINK} onClick={stop}>
                  {f.marketName}
                </a>
              )}
              {f.status || f.date}
            </>
          )}
          {f.lg && (
            <a className="SportEventHeaderBlock_leagueLinkHover" href={f.lg[1]} style={LEAGUE_LINK} onClick={stop}>
              {f.lg[0]}
            </a>
          )}
        </div>
      </div>
      <div className="Flex_root Flex_center ToolbarGroup_root ToolbarGroup_xs MatchEventHeader_fixtureToolbar">
        {f.boost && (
          <div className="BoostButton_boostButton">
            <span className="Tooltip_trigger">
              <a href={f.href} onClick={stop}>
                <span className="ButtonVariants_root ButtonVariants_buttonHeightXSmall ButtonVariants_iconTransparent ButtonVariants_hasIcon">
                  <span className="ButtonVariants_buttonContent ToolbarButton_buttonXs">
                    <span className="ButtonIcon_root">
                      <span className="BoostButton_icon" />
                    </span>
                  </span>
                </span>
              </a>
            </span>
          </div>
        )}
        {(f.tools || []).map((t) => (
          <ToolbarIcon key={t} alt={t} href={t === "custom bet" ? `${f.href}?tab=SAME_GAME_MULTI_MARKETS` : f.href} />
        ))}
        {f.cnt && (
          <div className="FixtureToolbar_marketCountButton">
            <a href={f.href} onClick={stop}>
              <span className="ButtonVariants_root ButtonVariants_buttonHeightXSmall ButtonVariants_iconTransparent ButtonVariants_hasIcon">
                <span className="ButtonVariants_buttonContent ToolbarButton_buttonXs">
                  <span className="ButtonIcon_root">
                    <span className="Counter_root Counter_neon FixtureToolbar_counter">{f.cnt}</span>
                  </span>
                </span>
              </span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/** Set/period scores beside the competitors — reference `MatchEventTileLiveScore`. */
function ScoreBoards({ boards }) {
  if (!boards || !boards.length) return null;
  return (
    <div className="MatchEventTileLiveScore_eventScoreList">
      {boards.map((b, i) => (
        <div key={i} className="MatchEventTileLiveScore_eventScoreBoard">
          {b.v.map((v, j) => (
            <span key={j} className={cx("AnimateScoreNumber_root MatchEventTileLiveScore_eventScore", b.l && "MatchEventTileLiveScore_eventLiveScore")}>
              {v}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** One competitor line of a match row — reference `MatchEventInfoSection`. */
function Competitor({ team, href, away }) {
  return (
    <a className={cx("MatchEventInfoSection_competitor", away && "MatchEventInfoSection_awayTeam")} href={href} onClick={stop}>
      <div className="ImageWithFallback_imageContainer MatchEventInfoSection_competitorIcon" style={{ width: 20, height: 20 }}>
        <img alt={team[0]} width="20" height="20" loading="lazy" src={team[1]} style={{ objectFit: "contain" }} />
      </div>
      <span className="MatchEventInfoSection_competitorName">{team[0]}</span>
    </a>
  );
}

/** Odds button inside an expanded group — reference `SportsBetSelectionButton`. */
function GroupSelection({ sel, outright, first, picked, onPick }) {
  const name = sel[0];
  const odds = outright ? sel[2] : sel[1];
  const boosted = outright ? sel[3] : null;
  const suspended = odds === "Suspended";
  const on = picked === name;
  return (
    <button
      className={cx(
        "ButtonVariants_root",
        outright ? "ButtonVariants_buttonHeightMedium" : "ButtonVariants_buttonHeightXLarge",
        "ButtonVariants_sportsBet SportsBetSelectionButton_root SportsBetSelectionButton_rootWithZIndex",
        on && "SportsBetSelectionButton_selected",
      )}
      data-testid={first ? "bet-select" : ""}
      disabled={suspended}
      type="button"
      onClick={() => onPick(on ? null : name)}
    >
      <span className={cx("ButtonVariants_buttonContent SportsBetSelectionButton_buttonBackground", outright ? "SportsBetSelectionButton_horizontal" : "SportsBetSelectionButton_vertical")}>
        <div className="SportsBetSelectionButton_selectionDetails">
          {outright && (
            <div className="ImageWithFallback_imageContainer" style={{ width: 20, height: 20 }}>
              <img alt={name} width="20" height="20" loading="lazy" src={sel[1]} style={{ objectFit: "contain" }} />
            </div>
          )}
          <p className="SportsBetSelectionButton_selectionName">{name}</p>
        </div>
        <p className={cx("SportsBetSelectionButton_oddsAndStatus", suspended && "SportsBetSelectionButton_warning")}>
          {suspended ? (
            "Suspended"
          ) : boosted ? (
            <span className="BoostedOdds_boostedOdds">
              <span className="BoostedOdds_boostedOddsOriginal SportsBetSelectionButton_hideBoostOriginalHorizontal">
                <span className="Odds_oddsWrapper">
                  <span>{odds}</span>
                </span>
              </span>
              <span className="BoostedOdds_boostedOddsValue">
                <span className="BoostedOdds_boostedOddsNumber">
                  <span className="Odds_oddsWrapper">
                    <span>{boosted}</span>
                  </span>
                </span>
                <span className="BoostedOdds_boostedOddsIcon">
                  <img alt="boosted odds" aria-hidden="true" width="16" height="16" src="/icons/odds-boost-bolt.svg" />
                </span>
              </span>
            </span>
          ) : (
            <span className="Odds_oddsWrapper">
              <span>{odds}</span>
            </span>
          )}
        </p>
      </span>
    </button>
  );
}

/** Outright market body: the winner list — reference `MatchEventTileRaceWinner`. */
function OutrightBody({ f, picked, onPick }) {
  const [showAll, setShowAll] = useState(false);
  return (
    <div className="MatchEventTileRaceWinner_root">
      <div className="MatchEventTileRaceWinner_eventWrapper">
        <div className="MatchEventTileRaceWinner_eventSelectionSection">
          <div className="MatchEventTileRaceWinner_selections">
            <div className="MatchEventTileRaceWinner_container">
              {f.sels.map((s, i) => (
                <GroupSelection key={s[0]} sel={s} outright first={i === 0} picked={picked} onPick={onPick} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <button aria-expanded={showAll} className="MatchEventTileRaceWinner_showAllBtn" data-testid="show-all" type="button" onClick={() => setShowAll((s) => !s)}>
        {showAll ? "Show Less" : "Show All"}
      </button>
    </div>
  );
}

/** One fixture inside an expanded group — reference `MatchEventTiles` + `MatchEventTile`. */
function MatchRow({ f, market, cols, outright, first, noTopMargin }) {
  const [picked, setPicked] = useState(null);
  const columns = cols || f.cols || 2;
  return (
    <section className={cx("MatchEventTiles_marketCardWrapper", (first || noTopMargin) && "MatchEventTiles_marketCardNoMarginTop", first && outright && "MatchEventTiles_firstAndNoHeading")}>
      {market && (
        <div className="MarketTypes_marketTypeWrapper">
          <div className="MarketTypes_sectionSecondColumn MarketTypes_marginLeft">
            <p className="MarketTypes_grayText">{market}</p>
          </div>
        </div>
      )}
      <div className={cx("MatchEventTiles_marketEventCard", outright && "MatchEventTiles_marketEventCardWideGap")}>
        <FixtureHeader f={f} />
        <div className="MatchEventTiles_matchElementBody">
          {outright ? (
            <OutrightBody f={f} picked={picked} onPick={setPicked} />
          ) : (
            <div className="Flex_root Flex_column Flex_md2 MatchEventTile_eventWrapper">
              <div className="MatchEventInfoSection_eventInfoSection">
                <div className="MatchEventInfoSection_competitors">
                  <Competitor team={f.home} href={f.href} />
                  <Competitor team={f.away} href={f.href} away />
                </div>
                <ScoreBoards boards={f.boards} />
              </div>
              <div className="Flex_root Flex_column Flex_spaced MatchEventTile_eventSelectionSection">
                <div className={cx("MatchEventTile_container", columns === 3 ? "MatchEventTile_marketSelectionsWithThreeEqualColumns" : "MatchEventTile_marketSelectionsWithTwoEqualColumns")}>
                  {f.sels.map((s, i) => (
                    <GroupSelection key={s[0]} sel={s} first={i === 0} picked={picked} onPick={setPicked} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <a className="MatchEventTiles_linkOverlay" href={f.href} onClick={stop} />
        </div>
      </div>
    </section>
  );
}

/** The "Load more" link under a fixture list — reference `LoadMoreFixturesButton`. */
function LoadMoreButton() {
  return (
    <button className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_textLink LoadMoreFixturesButton_btnLoadMore" type="button">
      <span className="ButtonVariants_buttonContent">Load more</span>
    </button>
  );
}

/** Expandable competition row with its fixtures — reference `MatchEventTileGroup`. */
export function MatchGroup({ g }) {
  const [open, setOpen] = useState(true);
  const outright = g.outright;
  return (
    <div className="MatchEventTileGroup_root">
      <div className="Collapse_collapseRoot" aria-expanded={open}>
        <div className="Collapse_collapseHeader MatchEventTileGroup_collapseHeader" aria-expanded={open}>
          <button className="Collapse_collapseHeaderButton" aria-expanded={open} data-testid="collapse" type="button" aria-label={`Toggle ${g.compName}`} onClick={() => setOpen((o) => !o)} />
          <div className="Collapse_collapseTitle">
            <div className="Flex_root Flex_sm SportTitleLink_root" style={{ alignItems: "center" }}>
              {g.dateLabel ? (
                <span className="SportTitleLink_title">{g.dateLabel}</span>
              ) : (
              <>
              <a className="SportTitleLink_categoryName" href={g.catHref} onClick={stop}>
                <div className="ImageWithFallback_imageContainer SportTitleLink_countryFlag" style={{ width: 16, height: 16 }}>
                  <img alt={g.catName} width="16" height="16" loading="lazy" src={g.catFlag} />
                </div>
                <span className="SportTitleLink_categoryNameText">{g.catName}</span>
              </a>
              <span className="SportTitleLink_separator" />
              <a className="SportTitleLink_competitionName" href={g.compHref} onClick={stop}>
                <div className="ImageWithFallback_imageContainer SportTitleLink_tournamentIcon" style={{ width: 16, height: 16 }}>
                  <img alt={g.compName} width="16" height="16" loading="lazy" src={g.compIcon} />
                </div>
                <span className="SportTitleLink_competitionNameText">{g.compName}</span>
              </a>
              </>
              )}
            </div>
          </div>
          <div className="Collapse_collapseRightContent">
            <span className="CollapseToggleButton_collapseToggle">
              <img className={cx("Collapse_chevronIcon", open && "Collapse_chevronOpen")} alt="chevron" src="/icons/chevron.svg" />
            </span>
          </div>
        </div>
        <div className="Collapse_container" style={{ height: open ? "auto" : 0 }}>
          <div>
            <div className="Collapse_collapseBody MatchEventTileGroup_collapseBody">
              <div className={cx("MatchEventTileGroup_matchEventBody", g.loadMore && "MatchEventTileGroup_matchEventBodyWithLoadMore")}>
                {g.fx.map((f, i) => (
                  <MatchRow key={f.href} cols={g.cols} f={f} first={i === 0} market={i === 0 ? g.market : null} outright={outright} />
                ))}
                {g.loadMore && <LoadMoreButton />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Sport heading above one competition group — reference `FeaturedSportGroup` / `FeaturedOutright`. */
function SportGroup({ g }) {
  const body = <MatchGroup g={g} />;
  return (
    <div className={g.outright ? "FeaturedOutright_root" : "FeaturedSportGroup_root"}>
      <SportsHeading alt={g.sportAlt} href={g.sportHref} icon={g.sportIcon} title={g.title} />
      {g.outright ? body : <div>{body}</div>}
    </div>
  );
}

/** Linked sport title used above the fixture groups — reference `SportsHeader`. */
export function SportsHeading({ icon, alt, title, href, toolbar }) {
  const label = (
    <>
      <span className="LabelLink_prefix">
        <img alt={alt} className="SportsHeader_sportIcon" width="24" height="24" src={icon} />
      </span>
      <span className="LabelLink_label">{title}</span>
      {href && <img height="16" width="16" alt="" className="LabelLink_chevron LabelLink_lgChevron" src="/icons/chevron.svg" />}
    </>
  );
  return (
    <div className="Flex_root SportsHeader_wrapper" style={{ justifyContent: "space-between", alignItems: "center" }}>
      <h3 className="LabelLink_root LabelLink_lg">
        {href ? (
          <a className="TextLink_root LabelLink_innerLink" href={href} onClick={stop}>
            {label}
          </a>
        ) : (
          <span className="LabelLink_innerLink">{label}</span>
        )}
      </h3>
      <div className="SportsHeader_toolbar">{toolbar}</div>
    </div>
  );
}

/** Same-game multi card — reference `FeaturedCustomBetCard`. */
function SgmCard({ s }) {
  const sgmHref = `${s.href}?tab=SAME_GAME_MULTI_MARKETS`;
  return (
    <div className="FeaturedCustomBetCard_cardWrapper">
      <div className="Flex_root Flex_column FeaturedCustomBetCard_card">
        <a className="FeaturedCustomBetCard_cardLink" aria-label={s.label} href={sgmHref} onClick={stop}>
          <div className="FeaturedCustomBetCard_header">
            <img alt="" width="16" height="16" src="/icons/custom-bet.svg" />
            <span className="FeaturedCustomBetCard_headerText">3 Leg Same-Game Multi</span>
          </div>
          <div className="Flex_root Flex_center FeaturedCustomBetCard_competitors" style={{ backgroundImage: `url("${PITCH}")` }}>
            <div className="Flex_root Flex_md2 FeaturedCustomBetCard_competitorsInner">
              {s.teams.map(([name, id], i) => (
                <Fragment key={name}>
                  {i === 1 && <span className="FeaturedCustomBetCard_vs">vs</span>}
                  <div className="Flex_root Flex_column Flex_sm4 FeaturedCustomBetCard_competitor">
                    <div className="ImageWithFallback_imageContainer" style={{ width: 35, height: 35 }}>
                      <img alt={name} width="35" height="35" loading="lazy" src={logo(id)} style={{ objectFit: "contain" }} />
                    </div>
                    <span className="FeaturedCustomBetCard_teamName">{name}</span>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
        </a>
        <div className="Flex_root Flex_spaced FeaturedCustomBetCard_summary">
          <div className="Flex_root Flex_column Flex_sm1">
            <span className="FeaturedCustomBetCard_summaryText">3 Legs</span>
            <a className="TextLink_root LabelLink_root" href={sgmHref} onClick={stop}>
              <span className="LabelLink_label">{s.date}</span>
              <img height="16" width="16" alt="" className="LabelLink_chevron" src="/icons/chevron-small.svg" />
            </a>
          </div>
          <span className="Odds_oddsWrapper FeaturedCustomBetCard_odds">
            <span className="">{s.odds}</span>
          </span>
        </div>
        <div className="FeaturedCustomBetCard_divider" />
        <div className="Flex_root Flex_column Flex_sm5 FeaturedCustomBetCard_selections">
          <a className="TextLink_root LabelLink_root FeaturedCustomBetCard_competitionLink" href={s.competitionHref} onClick={stop}>
            <span className="LabelLink_label">{s.competition}</span>
            <img height="16" width="16" alt="" className="LabelLink_chevron" src="/icons/chevron-small.svg" />
          </a>
          {s.selections.map(([market, name]) => (
            <div key={market + name} className="FeaturedCustomBetCard_selection">
              <div className="Flex_root Flex_sm4 FeaturedCustomBetCard_selectionMarket">
                <img alt="SOCCER" width="16" height="16" className="FeaturedCustomBetCard_selectionIcon" src="/icons/sports/soccer.svg" />
                <span>{market}</span>
              </div>
              <span className="FeaturedCustomBetCard_selectionName">{name}</span>
            </div>
          ))}
        </div>
        <div className="Flex_root Flex_md FeaturedCustomBetCard_footer">
          <a className="FeaturedCustomBetCard_editButton" href={sgmHref} onClick={stop}>
            <span className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_tertiary">
              <span className="ButtonVariants_buttonContent FeaturedCustomBetCard_editButtonBg">Edit</span>
            </span>
          </a>
          <button className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_sportsBet FeaturedCustomBetCard_betButton" type="button">
            <span className="ButtonVariants_buttonContent FeaturedCustomBetCard_betButtonBg">
              <span className="FeaturedCustomBetCard_betButtonDetails">3 Leg SGM</span>
              <span className="Odds_oddsWrapper FeaturedCustomBetCard_betButtonOdds">
                <span className="">{s.odds}</span>
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function SgmCarousel() {
  const { trackRef, carousel } = useCarousel();
  return (
    <section className="FeaturedCustomBetsCarousel_root">
      <SportsCarouselHeader icon="/icons/custom-bet.svg" title="Popular SGMs" carousel={carousel} />
      <SwipeTrack trackRef={trackRef} carousel={carousel} large className="FeaturedCustomBetsCarousel_carouselContent">
        {fixtures.sgm.map((s) => (
          <SgmCard key={s.href} s={s} />
        ))}
      </SwipeTrack>
    </section>
  );
}

/** Wager-race tile — reference `TournamentBannerCard` with `ScoresUserInfo`. */
function TournamentTile({ t }) {
  return (
    <div className="TournamentBannerCard_card ActiveTournamentsAndRaceBanner_tile">
      <div className="HomeBannerHeader_banner">
        <img alt="tournament-tile" loading="lazy" decoding="async" className="HomeBannerHeader_bg" src={t.image} style={{ position: "absolute", height: "100%", width: "100%", inset: 0, color: "transparent" }} />
        <div className="Flex_root Flex_column Flex_lg2 HomeBannerHeader_bannerContent">
          <div>
            <CircleProgress progress={0} size="4.75rem" />
          </div>
          <div className="HomePromotionHeading_weekInfo">
            <a className="TextLink_root HomePromotionHeading_link" href={t.href} onClick={(e) => { e.preventDefault(); navigate(t.href); }}>
              <h4 className="HomePromotionHeading_weekLabel">{t.title}</h4>
            </a>
            <a className="HomePromotionHeading_countdown HomePromotionHeading_link" href={t.href} onClick={(e) => { e.preventDefault(); navigate(t.href); }}>
              {t.countdown}&nbsp;
              <img aria-hidden="true" width="16" className="HomePromotionHeading_arrow" height="16" alt="chevron" src="/icons/chevron-small.svg" />
            </a>
          </div>
        </div>
      </div>
      <div className="ScoresUserInfo_root">
        <section className="ScoresUserInfo_scoresLeaderboard">
          {t.ranks.map((r, i) => (
            <div key={r.rank} className="Flex_root Flex_sm HomePromotionUserRank_entry HomePromotionUserRank_entryVisible" style={{ "--entry-i": i }}>
              <RankOrdinal rank={r.rank} />
              <UserCell user={r.user} />
              <div className="HomePromotionUserRank_prizeAmount">
                <div className="FormattedUsdAmountWithTooltip_flex ScoresUserInfo_myScore">
                  <img alt="USD" width="16" height="16" src="/icons/fiat/USD.svg" />
                  <span className="Tooltip_trigger">{r.amount}</span>
                </div>
              </div>
            </div>
          ))}
        </section>
        <div className="ScoresUserInfo_myRankSection">
          <span className="ScoresUserInfo_myRankGroup">
            <img alt="trophy" width="16" height="16" className="ScoresUserInfo_iconFilter" src="/icons/trophy.svg" />-
          </span>
          <a className="ScoresUserInfo_viewDetailsButton" href={t.href} onClick={(e) => { e.preventDefault(); navigate(t.href); }}>
            <span className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_link">
              <span className="ButtonVariants_buttonContent ScoresUserInfo_viewBtnBackground">View Details</span>
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}

function TournamentsCarousel() {
  const { trackRef, carousel } = useCarousel();
  return (
    <section data-testid="active-tournaments-race-banner" className="ActiveTournamentsAndRaceBanner_sports">
      <SportsCarouselHeader icon="/icons/trophy.svg" iconClass="ActiveTournamentsAndRaceBanner_tournamentTrophy" title="Tournaments" carousel={carousel} />
      <SwipeTrack trackRef={trackRef} carousel={carousel} large className="ActiveTournamentsAndRaceBanner_carouselContent">
        {sports.tournaments.map((t) => (
          <TournamentTile key={t.href} t={t} />
        ))}
      </SwipeTrack>
    </section>
  );
}

/** Featured tab: trending fixtures, sport groups, same-game multis and tournaments. */
function FeaturedTab() {
  const [sport, setSport] = useState("POPULAR");
  const groups = groupData;
  return (
    <div>
      <CategoryCarousel cats={sports.categories.map(([n, i, a, c]) => [n, i, a, null, c])} selected={sport} onSelect={setSport} />
      <section className="LayoutContainer_root LayoutContainer_mobile-top-md LayoutContainer_column">
        <TrendingCarousel />
        {groups.slice(0, 5).map((g) => (
          <SportGroup key={g.title} g={g} />
        ))}
        <SgmCarousel />
        {groups.slice(5).map((g) => (
          <SportGroup key={g.title} g={g} />
        ))}
        <TournamentsCarousel />
      </section>
    </div>
  );
}

/** Upcoming tab: one flat, market-labelled list across every sport. */
function UpcomingTab() {
  const [sport, setSport] = useState("ALLSPORTS");
  return (
    <div>
      <CategoryCarousel cats={upcoming.cats} section="upcoming" selected={sport} onSelect={setSport} />
      <section className="LayoutContainer_root LayoutContainer_mobile-top-md LayoutContainer_column">
        <SportsHeading alt="all sports" icon={upcoming.headIcon} title={upcoming.heading} />
        <div className="MatchEventTileGroup_root">
          <div className="MatchEventTileGroup_matchEventBody MatchEventTileGroup_matchEventBodyWithoutCollapse MatchEventTileGroup_matchEventBodyWithLoadMore">
            {upcoming.fx.map((f) => (
              <MatchRow key={f.href} f={f} market={f.m} noTopMargin />
            ))}
            {upcoming.loadMore && <LoadMoreButton />}
          </div>
        </div>
      </section>
    </div>
  );
}

/** Bet Live tab: live events for one sport, grouped by competition. */
function BetLiveTab() {
  const [sport, setSport] = useState(liveData.cats[0][4]);
  const s = liveData.sports[sport] || liveData.sports[liveData.cats[0][4]];
  const [market, setMarket] = useState(s.markets[0]);
  const [open, setOpen] = useState(false);
  const pickSport = (code) => {
    setSport(code);
    const next = liveData.sports[code];
    if (next) setMarket(next.markets[0]);
    setOpen(false);
  };
  const toolbar = (
    <>
      <span className="Tooltip_trigger">
        <button className="SportsHeader_layoutToggle" type="button">
          <img alt="market" src="/icons/three-way-layout.svg" />
        </button>
      </span>
      <div className="FormControlWrapper_root Select_formWrapper" data-testid="market-filter">
        <button
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label="market-filter"
          className="Select_button SportsHeader_marketSelect"
          type="button"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="Select_item">
            <span className="Select_text">{s.markets.includes(market) ? market : s.markets[0]}</span>
          </span>
          <img alt="Toggle dropdown menu" className="Select_chevronIcon" src="/icons/chevron.svg" />
        </button>
      </div>
    </>
  );
  return (
    <div>
      <CategoryCarousel cats={liveData.cats} section="bet-live" selected={sport} onSelect={pickSport} />
      <section className="LayoutContainer_root LayoutContainer_mobile-top-md LayoutContainer_column">
        <SportsHeading alt={s.sport[3]} href={s.sport[1]} icon={s.sport[2]} title={s.sport[0]} toolbar={toolbar} />
        {s.groups.map((g) => (
          <MatchGroup key={g.compHref} g={g} />
        ))}
      </section>
    </div>
  );
}

/** All Sports tab: the searchable A-Z sport directory. */
function AllSportsTab() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const letters = allSports
    .map(([letter, rows]) => [letter, rows.filter(([name]) => name.toLowerCase().includes(q))])
    .filter(([, rows]) => rows.length);
  return (
    <section className="LayoutContainer_root LayoutContainer_mobile-bottom-md LayoutContainer_column">
      <div className="AllSports_allSportsToolbarWrapper">
        <div className="SearchInput_root">
          <span className="SearchInput_label">
            <img alt="search" loading="lazy" src="/icons/search.svg" />
          </span>
          <input className="SearchInput_input" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      <div className="AllSports_allSportsContainer">
        <div className="AllSportsList_container">
          {letters.map(([letter, rows]) => (
            <div key={letter}>
              <span className="AllSportsList_sportLetter">{letter}</span>
              <div className="AllSportsList_wrapper">
                {rows.map(([name, icon, href]) => (
                  <a key={href} className="SportItem_sportItemWrapper" href={href} onClick={stop}>
                    <div className="SportItem_sportItem">
                      <span className="SportItem_sportItemName">
                        <img alt={name} src={icon} />
                        <span>{name}</span>
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const TABS = { featured: FeaturedTab, upcoming: UpcomingTab, "bet-live": BetLiveTab, all: AllSportsTab };

export default function SportsPage() {
  // The reference keeps the section in the query string, so the rail's Upcoming
  // and Bet Live links and these tabs stay in sync.
  const search = useSearch();
  const section = new URLSearchParams(search).get("section");
  const tab = TABS[section] ? section : "featured";
  const Body = TABS[tab];
  return (
    <div>
      <HeroBanners banners={staticData.banners} />
      <div className="SportsHome_root">
        <NavTabs active={tab} onChange={navigate} />
        <Body />
      </div>
      <ActivityBoard />
      <SeoArticle html={seoHtml} />
    </div>
  );
}
