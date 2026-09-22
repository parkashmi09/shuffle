import { useState } from "react";
import ActivityBoard from "../components/casino/ActivityBoard";
import { cx } from "../lib/carousel";
import { navigate, useSearch } from "../lib/router";
import { SportsBreadcrumb } from "./SportPage";
import { GameCard } from "../components/casino/GameCarousel";
import { sections } from "../data/catalog";
import { bannerForSport, fixtureRowFor } from "../lib/sportsData";
import { selectionId, useBetSlip } from "../lib/betSlipContext";
import pageData from "../data/sports-pages.json";
import fixtureData from "../data/sports-fixtures-detail.json";

/**
 * One fixture, e.g. `/sports/soccer/31-italy/23-serie-a/71945228-…`. The reference
 * puts the competitors and kick-off time in a banner, then the market list under a
 * row of market-group tabs. Markets come in two layouts: the default grid of
 * selections, and a two-column ladder for handicap and total lines.
 *
 * The reference also mounts a SportRadar match widget and a game-ad rail beside the
 * markets; both are third-party embeds, so they are left out here.
 */

/** This competition's other fixtures, grouped by day, for the last crumb's popup. */
function fixtureDropdown(competitionHref) {
  const groups = [];
  for (const [href, e] of Object.entries(fixtureData)) {
    if (e.competitionHref !== competitionHref) continue;
    let g = groups.find((x) => x.dateLabel === e.dateLabel);
    if (!g) {
      g = { dateLabel: e.dateLabel, items: [] };
      groups.push(g);
    }
    // An outright tournament in the same competition has a name rather than two sides.
    g.items.push({ href, label: e.name || `${e.home[0]} vs ${e.away[0]}` });
  }
  return groups.length ? groups : null;
}

/** The games the reference pins in the rail, in its order. */
const RAIL_GAMES = [
  "/games/originals/keno",
  "/games/originals/dice",
  "/games/originals/limbo",
  "/games/originals/plinko",
  "/games/originals/mines",
  "/games/originals/blackjack",
  "/games/hacksaw-le-prechaun",
  "/games/hacksaw-wanted-dead-or-a-wild",
  "/games/originals/blitz",
];

const byHref = new Map(sections.flatMap((s) => s.games || []).map((g) => [g.href, g]));
const railTiles = RAIL_GAMES.map((h) => byHref.get(h)).filter(Boolean);

/** The reference names the market group in the query, e.g. the Popular SGMs cards
 *  link to `?tab=SAME_GAME_MULTI_MARKETS`. */
const TAB_BY_PARAM = {
  SAME_GAME_MULTI_MARKETS: "Same-Game Multi",
  QUICK_COMBOS: "Quick Combos",
};

const ACRONYMS = new Set(["nfl", "nba", "mlb", "nhl", "ufc", "atp", "wta", "usa", "srl", "mma", "cs2", "tt", "lol"]);

/** "23-serie-a" -> "Serie A"; "cagliari-calcio-vs-us-lecce" -> "Cagliari Calcio vs US Lecce". */
function labelFromSlug(slug) {
  return (slug || "")
    .replace(/^\d+-/, "")
    .split("-")
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** One competitor either side of the VS block — reference `PreLiveCompetitor`. */
function Competitor({ team }) {
  return (
    <div className="PreLiveCompetitor_preLiveCompetitorWrapper">
      <div className="PreLiveCompetitor_competitionIcon">
        <div className="ImageWithFallback_imageContainer" style={{ width: 70, height: 70 }}>
          {team[1] && <img alt={team[0]} height="70" loading="lazy" src={team[1]} width="70" style={{ objectFit: "contain" }} />}
        </div>
      </div>
      <span className="PreLiveCompetitor_preLiveCompetitorName">{team[0]}</span>
    </div>
  );
}

/** An outright tournament's banner: one name and a start time where a fixture shows
 *  two competitors — reference `PreMatchRaceWinner`. */
function TournamentBanner({ fx }) {
  return (
    <div className="PreMatchRaceWinner_wrapper">
      <div className="PreMatchRaceWinner_preMatchLogo">
        <div className="ImageWithFallback_imageContainer" style={{ width: 80, height: 80 }}>
          {fx.logo && <img alt={fx.name} height="80" loading="lazy" src={fx.logo} width="80" style={{ objectFit: "contain" }} />}
        </div>
      </div>
      <span className="PreMatchRaceWinner_preMatchName">{fx.name}</span>
      <div className="PreMatchRaceWinner_preLiveStartDate">
        <div className="PreMatchRaceWinner_startTimeCountdown">{fx.date}</div>
      </div>
    </div>
  );
}

/**
 * A single odds button — reference `SportsBetSelectionButton`.
 *
 * Lit because the price is in the slip, not because this button remembers
 * being pressed: markets here collapse and re-mount, and local state did not
 * survive that. `odds` is already the struck price — `original` is the
 * crossed-out one beside a boost — so the slip takes `odds`.
 */
function Selection({ sel, fixture }) {
  const slip = useBetSlip();
  const [name, odds, icon, original] = sel;
  const suspended = odds === "Suspended" || !odds;
  const leg = { ...fixture, name, odds };
  const id = selectionId(leg);
  const on = slip.has(id);
  return (
    <button
      className={cx(
        "ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_sportsBet SportsBetSelectionButton_root",
        on && "SportsBetSelectionButton_selected",
      )}
      disabled={suspended}
      type="button"
      onClick={() => slip.toggle({ ...leg, id })}
    >
      <span className="ButtonVariants_buttonContent SportsBetSelectionButton_buttonBackground SportsBetSelectionButton_horizontal">
        <div className="SportsBetSelectionButton_selectionDetails">
          {icon && (
            <div className="ImageWithFallback_imageContainer" style={{ width: 20, height: 20 }}>
              <img alt={name} height="20" loading="lazy" src={icon} width="20" style={{ objectFit: "contain" }} />
            </div>
          )}
          <p className="SportsBetSelectionButton_selectionName">{name}</p>
        </div>
        <p className={cx("SportsBetSelectionButton_oddsAndStatus", suspended && "SportsBetSelectionButton_warning")}>
          {suspended ? (
            "Suspended"
          ) : original ? (
            <span className="BoostedOdds_boostedOdds">
              <span className="BoostedOdds_boostedOddsOriginal SportsBetSelectionButton_hideBoostOriginalHorizontal">
                <span className="Odds_oddsWrapper">
                  <span>{original}</span>
                </span>
              </span>
              <span className="BoostedOdds_boostedOddsValue">
                <span className="BoostedOdds_boostedOddsNumber">
                  <span className="Odds_oddsWrapper">
                    <span>{odds}</span>
                  </span>
                </span>
                <span className="BoostedOdds_boostedOddsIcon">
                  <img alt="boosted odds" aria-hidden="true" height="16" src="/icons/odds-boost-bolt.svg" width="16" />
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

/** One collapsible market — reference `SportsMarketCollapse` inside `StackedCollapseGroup`. */
function Market({ m, open, onToggle, fixture }) {
  /** The market's own title is part of a leg's identity — see `selectionId`. */
  const marketFixture = { ...fixture, market: m.title };
  return (
    <div className="Collapse_collapseRoot StackedCollapseGroup_item" aria-expanded={open}>
      <div className="Collapse_collapseHeader StackedCollapseGroup_itemHeader" aria-expanded={open}>
        <button aria-expanded={open} className="Collapse_collapseHeaderButton" data-testid="collapse" type="button" onClick={onToggle} />
        <div className="Collapse_collapseTitle">
          <div className="MarketCollapseHeader_root">
            <span className="MarketCollapseHeader_title">{m.title}</span>
          </div>
        </div>
        <div className="Collapse_collapseRightContent">
          <div className="Collapse_collapseRightPanel" />
          <span className="CollapseToggleButton_collapseToggle">
            <img alt="chevron" className={cx("Collapse_chevronIcon", open && "Collapse_chevronOpen")} src="/icons/chevron.svg" />
          </span>
        </div>
      </div>
      <div className="Collapse_container" style={{ height: open ? "auto" : 0 }}>
        <div>
          <div className="Collapse_collapseBody StackedCollapseGroup_itemBody SportsMarketCollapse_subCollapseBody">
            {m.layout === "ladder" ? (
              <div className="LadderMarketLayout_contaienr">
                <section className={cx("LadderMarketLayout_root", m.double && "LadderMarketLayout_doubleColumn")}>
                  {m.cols.map((col) => (
                    <div key={col.head} className="LadderMarketLayout_column">
                      <div className="LadderMarketLayout_heading">
                        {col.icon && (
                          <div className="ImageWithFallback_imageContainer" style={{ width: 20, height: 20 }}>
                            <img alt={col.head} height="20" loading="lazy" src={col.icon} width="20" style={{ objectFit: "contain" }} />
                          </div>
                        )}
                        <p className="LadderMarketLayout_headingText">{col.head}</p>
                      </div>
                      <div className="LadderMarketLayout_selections">
                        {col.sels.map((s) => (
                          <Selection key={s[0]} sel={s} fixture={marketFixture} />
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              </div>
            ) : (
              <div className="DefaultMarketLayout_container">
                <section
                  className={cx(
                    "DefaultMarketLayout_root",
                    m.cols === 3 ? "DefaultMarketLayout_marketSelectionsWithThreeEqualColumns" : "DefaultMarketLayout_marketSelectionsWithTwoEqualColumns",
                  )}
                >
                  {m.sels.map((s) => (
                    <Selection key={s[0]} sel={s} fixture={marketFixture} />
                  ))}
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Chevrons that fold inward once every market is collapsed — reference `ExpandCollapse`. */
function ExpandCollapseIcon({ collapsed }) {
  return (
    <svg fill="none" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
      <title>{collapsed ? "Expand" : "Collapse"}</title>
      <path
        className={cx("ExpandCollapse_topPath", !collapsed && "ExpandCollapse_rotate180")}
        d="M12 4.70001L8 0.700012L4 4.70001"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
      <path
        className={cx("ExpandCollapse_bottomPath", !collapsed && "ExpandCollapse_negRotate180")}
        d="M4 11.3L8 15.3L12 11.3"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
    </svg>
  );
}

/** The sub-group filters the Same-Game Multi tab adds — reference `SgmSubGroupTabs`.
 *  Its list is not the market-group tab row (that one also carries Handicap), so it
 *  comes from the capture. */
function SgmFilters({ groups }) {
  const [active, setActive] = useState(groups[0]);
  return (
    <div className="SearchScrollableContainer_root">
      <div className="SgmSubGroupTabs_filterGroup">
        {groups.map((g) => (
          <button
            key={g}
            className={cx(
              "ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_outline SgmSubGroupTabs_filterButton",
              active === g && "SgmSubGroupTabs_active",
            )}
            type="button"
            onClick={() => setActive(g)}
          >
            <span className="ButtonVariants_buttonContent SgmSubGroupTabs_filterButtonContent">{g}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** The bet-builder bar under the filters — reference `SportsCustomBetSection`. With
 *  nothing picked the reference shows it disabled, which is the state here: the slip
 *  itself needs an account. */
function CustomBetBar() {
  return (
    <div className="Collapse_collapseRoot SportsCustomBetSection_collapseRoot" aria-expanded={false}>
      <div>
        <div>
          <div className="Collapse_collapseHeader SportsCustomBetSection_collapseHeader Collapse_disabled">
            <div className="Flex_root Flex_sm4 Flex_center Collapse_collapseTitle">
              <span>Total Odds:</span>
            </div>
            <div className="SportsCustomBetSection_collapseRightContent">
              <div className="Flex_root Flex_sm4 SportsCustomBetSection_buttonsGroup">
                <button className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_secondary" disabled type="button">
                  <span className="ButtonVariants_buttonContent">Clear All</span>
                </button>
                <button className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_primary" disabled type="button">
                  <span className="ButtonVariants_buttonContent">Add Bet</span>
                </button>
              </div>
              <button className="SportsCustomBetSection_collapseButton" disabled type="button">
                <span className="CollapseToggleButton_collapseToggle CollapseToggleButton_toggleButtonDisabled">
                  <img alt="chevron" className="Collapse_chevronIcon" src="/icons/chevron.svg" />
                </span>
              </button>
            </div>
            <div className="Flex_root Flex_sm4 SportsCustomBetSection_buttonsGroup SportsCustomBetSection_buttonsGroupMobile">
              <button className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_secondary" disabled type="button">
                <span className="ButtonVariants_buttonContent">Clear All</span>
              </button>
              <button className="ButtonVariants_root ButtonVariants_buttonHeightSmall ButtonVariants_primary" disabled type="button">
                <span className="ButtonVariants_buttonContent">Add Bet</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The market-group tabs, the market filter and the collapse-all button — reference
 *  `MarketGroupAndSearchBar`. */
function MarketBar({ tabs, collapsed, onToggleAll, query, onQuery, active, onActive }) {
  const setActive = onActive;
  return (
    <div className="Flex_root Flex_column Flex_wide Flex_md2">
      <div className="MarketGroupAndSearchBar_tabsWrapper">
        <div className="Tab_root">
          <div className="Tab_tabsContainer">
            {tabs.map((label) => (
              <a
                key={label}
                className={cx("Tab_tab", active === label && "Tab_active")}
                href="#"
                onClick={(e) => { e.preventDefault(); setActive(label); }}
              >
                {label === "Same-Game Multi" && (
                  <span className="Tab_icon">
                    <img alt="" className="SportsFixtureContentLayout_customBetIcon" src="/icons/custom-bet.svg" />
                  </span>
                )}
                <p className="Tab_text">{label}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="Flex_root Flex_wide Flex_sm5">
        <div className="SearchInput_root MarketGroupAndSearchBar_searchMarketsWrapper">
          <span className="SearchInput_label">
            <img alt="search" loading="lazy" src="/icons/search.svg" />
          </span>
          <input className="SearchInput_input" placeholder="Filter markets" value={query} onChange={(e) => onQuery(e.target.value)} />
        </div>
        <span className="Tooltip_trigger">
          <button
            aria-label={collapsed ? "Expand all markets" : "Collapse all markets"}
            className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_icon ButtonVariants_hasIcon MarketGroupAndSearchBar_iconButton"
            type="button"
            onClick={onToggleAll}
          >
            <span className="ButtonVariants_buttonContent">
              <span className="ButtonIcon_root">
                <ExpandCollapseIcon collapsed={collapsed} />
              </span>
            </span>
          </button>
        </span>
      </div>
    </div>
  );
}

/** The rail beside the markets — reference `SportsEventAside`. The reference's stats
 *  frame is a third-party embed we cannot mount, and it shows this same placeholder
 *  whenever that frame fails to load. */
function EventAside({ stats = true }) {
  return (
    <aside className="SportsEventAside_sidePanel">
      {stats && (
        <div className="SportRadarWidget_root">
          <div className="Flex_root Flex_column Flex_sm4 Flex_center StatsWidgetFrameErrorPlaceholder_root">
            <img alt="" className="StatsWidgetFrameErrorPlaceholder_icon" src="/icons/error.svg" />
            <p className="StatsWidgetFrameErrorPlaceholder_message">Stats widget is currently unavailable.</p>
          </div>
        </div>
      )}
      <details className="SportsAds_root" open>
        <summary>
          Popular games
          <img alt="chevron" src="/icons/chevron.svg" />
        </summary>
        <div className="SportsAds_content">
          {railTiles.map((g, i) => (
            <GameCard key={g.href} className="SportsAds_tile" game={g} index={i} />
          ))}
        </div>
        <a
          className="SportsAds_footer"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          View all games
        </a>
      </details>
    </aside>
  );
}

/** Scoreboard / Live Stream toggle — reference `SportsEventStreamSwitch`. The stream
 *  itself is a third-party embed, so the control flips but the banner stays put. */
function StreamSwitch() {
  const [stream, setStream] = useState(false);
  return (
    <section className="SportsEventStreamSwitch_root">
      <div className="SportsEventStreamSwitch_switch">
        <button className="SportsEventStreamSwitch_clickable" type="button" onClick={() => setStream(false)}>
          Scoreboard
        </button>
        <label className={cx("Switch_switchWrapper Switch_labelFloat SportsEventStreamSwitch_switch", stream && "Switch_checked")}>
          <input checked={stream} className="Switch_hiddenCheckbox" type="checkbox" onChange={(e) => setStream(e.target.checked)} />
          <div className="Switch_switchElement">
            <span className="Switch_knob" />
          </div>
        </label>
        <button className="SportsEventStreamSwitch_clickable" type="button" onClick={() => setStream(true)}>
          Live Stream
        </button>
      </div>
    </section>
  );
}

/** A fixture we hold no full capture for still has a tile somewhere in the
 *  sportsbook; that row gives the competitors, the kick-off and its one market. */
function fromRow(href) {
  const row = fixtureRowFor(href);
  if (!row) return null;
  return {
    sport: href.split("/")[2],
    sportIcon: row.sportIcon,
    competitionHref: href.split("/").slice(0, 5).join("/"),
    home: row.home,
    away: row.away,
    date: row.date,
    tabs: ["Top Markets"],
    markets: row.market && row.sels.length ? [{ title: row.market, layout: "default", cols: row.cols, sels: row.sels }] : [],
  };
}

export default function FixturePage({ sport, category, competition, event }) {
  const search = useSearch();
  const href = `/sports/${sport}/${category}/${competition}/${event}`;
  const fx = fixtureData[href] || fromRow(href);
  const page = pageData.sports[sport];
  const sportTitle = page ? page.title : labelFromSlug(sport);
  // Without a capture for this fixture the names still come from the slug, and the
  // reference's own "no markets" panel stands in for the market list.
  const vs = labelFromSlug(event).split(/\s+Vs\s+/i);
  const eventName = fx && fx.name ? fx.name : vs.filter(Boolean).join(" vs ");
  const sportIcon = fx ? fx.sportIcon : page ? page.icon : "/icons/globe.svg";
  /**
   * What a leg picked on this page carries into the bet slip. The market is
   * filled in per market by `Market`; everything else is the fixture and is the
   * same for all of them.
   */
  const slipFixture = {
    href,
    event: eventName,
    league: fx?.competitionName || labelFromSlug(competition),
    live: Boolean(fx?.live),
  };
  const tabs = fx ? fx.tabs : [];
  const crumbs = fx && fx.crumbs;
  const banner = bannerForSport(sport);
  const wantedTab = TAB_BY_PARAM[new URLSearchParams(search).get("tab")];
  const tabList = fx ? fx.tabs : [];
  const [activeTab, setActiveTab] = useState(null);
  const active = activeTab || (wantedTab && tabList.includes(wantedTab) ? wantedTab : tabList[0]);
  const sgm = active === "Same-Game Multi";
  // Collapsed markets are held here so the bar's button can fold every one at once
  // while each header still toggles on its own.
  const [collapsed, setCollapsed] = useState(() => new Set());
  // Typing in the bar narrows the list by market name.
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const markets = fx ? fx.markets.filter((m) => !needle || m.title.toLowerCase().includes(needle)) : [];
  const allCollapsed = markets.length > 0 && markets.every((m) => collapsed.has(m.title));
  const toggleAll = () => setCollapsed(allCollapsed ? new Set() : new Set(markets.map((m) => m.title)));
  const toggleOne = (title) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  return (
    <div>
      <SportsBreadcrumb
        items={[
          { label: "Home", href: "/sports" },
          { label: sportTitle, href: `/sports/${sport}` },
          {
            label: crumbs ? crumbs.categoryLabel : labelFromSlug(category),
            href: `/sports/${sport}/${category}`,
            flag: crumbs && crumbs.categoryFlag,
          },
          {
            // The competition badge sits in the same 16px slot the flag uses.
            label: crumbs ? crumbs.competitionLabel : labelFromSlug(competition),
            href: `/sports/${sport}/${category}/${competition}`,
            flag: crumbs && crumbs.competitionLogo,
          },
          { label: eventName, dropdown: fx && fixtureDropdown(fx.competitionHref) },
        ]}
      />
      <section className="LayoutContainer_root SportsFixtureContentLayout_root LayoutContainer_mobile-bottom-lg1 LayoutContainer_tablet-bottom-0 LayoutContainer_column">
        <div className="SportsEventBanner_wrapper">
          <div
            className="SportsEventBanner_sportsEventBackground"
            style={banner ? { backgroundImage: `url("${banner}")` } : undefined}
          >
            <div className="PreLiveWidget_sportsEventWidget">
              <div className="PreLiveWidget_preLiveWrapper">
                <div className="PreLiveWidget_preLiveContent PreLiveWidget_preLiveStartTimeContent">
                  <div className="PreLiveWidget_preLiveStartDate">
                    <div className="PreLiveWidget_startTimeCountdown">{fx ? fx.date : ""}</div>
                  </div>
                  <a
                    className="SportsIconLink_sportIcon SportsIconLink_forcePurple"
                    href={`/sports/${sport}`}
                    onClick={(e) => { e.preventDefault(); navigate(`/sports/${sport}`); }}
                  >
                    <img alt={sportTitle} src={sportIcon} />
                  </a>
                </div>
              </div>
            </div>
            {fx && fx.kind === "outright" && (
              <div className="PreLiveWidget_preLiveDesktop">
                <TournamentBanner fx={fx} />
              </div>
            )}
            {fx && fx.kind !== "outright" && (
              <div className="PreLiveWidget_preLiveDesktop">
                <Competitor team={fx.home} />
                <div className="PreLiveFixtureDate_wrapper">
                  <div className="PreLiveFixtureDate_versusBlock">
                    <span className="PreLiveFixtureDate_versusText">VS</span>
                    <div className="PreLiveFixtureDate_preLiveStartDate">
                      <div className="PreLiveFixtureDate_startTimeCountdown">{fx.date}</div>
                    </div>
                  </div>
                </div>
                <Competitor team={fx.away} />
              </div>
            )}
          </div>
          <StreamSwitch />
        </div>
        <div className="Flex_root Flex_wide Flex_lg1">
          <div className="Flex_root Flex_column Flex_wide Flex_md2 SportsFixtureContentLayout_mainContent">
            <div className="Flex_root Flex_column Flex_md2 SportsFixtureContentLayout_sportsEventContentWrapper">
              {tabs.length > 0 && (
                <MarketBar
                  active={active}
                  collapsed={allCollapsed}
                  query={query}
                  tabs={tabs}
                  onActive={setActiveTab}
                  onQuery={setQuery}
                  onToggleAll={toggleAll}
                />
              )}
              {sgm && fx && fx.sgmGroups && <SgmFilters groups={fx.sgmGroups} />}
              {sgm && <CustomBetBar />}
              <div className="SportsFixtureContentLayout_markListWrapper">
                <div className="AllMarkets_root">
                  <div className="AllMarkets_content">
                    <section>
                      {fx && markets.length > 0 ? (
                        <div>
                          {markets.map((m) => (
                            <Market key={m.title} m={m} open={!collapsed.has(m.title)} onToggle={() => toggleOne(m.title)} fixture={slipFixture} />
                          ))}
                        </div>
                      ) : (
                        <div className="SportsFixturesEmpty_sportsFixturesEmptyPanel">
                          <img alt="" src="/icons/race.svg" />
                          <div className="SportsFixturesEmpty_sportsFixturesEmptyText">No markets available</div>
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <EventAside stats={!fx || fx.kind !== "outright"} />
        </div>
      </section>
      <ActivityBoard />
    </div>
  );
}
