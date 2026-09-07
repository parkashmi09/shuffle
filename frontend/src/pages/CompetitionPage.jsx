import { useState } from "react";
import ActivityBoard from "../components/casino/ActivityBoard";
import { cx } from "../lib/carousel";
import { navigate, useSearch } from "../lib/router";
import { MatchGroup } from "./SportsPage";
import { SectionTabs, SportsBreadcrumb } from "./SportPage";
import { allGroups, groupsForSport } from "../lib/sportsData";
import pageData from "../data/sports-pages.json";
import competitions from "../data/sports-competitions.json";

/**
 * One competition, e.g. `/sports/soccer/1-england/17-premier-league`. The
 * reference lists its fixtures grouped by day, above them any promotion running
 * on the competition, and puts the competition itself in the breadcrumb as a
 * dropdown.
 */

const ACRONYMS = new Set(["nfl", "nba", "mlb", "nhl", "khl", "ufc", "atp", "wta", "epl", "lpl", "ncaa", "usa", "uk", "tt", "srl", "mma", "cs2", "acc"]);

/** "17-premier-league" -> "Premier League"; keeps known acronyms upper case. */
function labelFromSlug(slug) {
  return (slug || "")
    .replace(/^\d+-/, "")
    .split("-")
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Collapsible promotion strip above a competition's fixtures. */
function PromotionBanner({ promo }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="Collapse_collapseRoot" aria-expanded={open}>
      <div className="Collapse_collapseHeader SportsContentPromotionBanner_collapseHeader" aria-expanded={open}>
        <button aria-expanded={open} className="Collapse_collapseHeaderButton" data-testid="collapse" type="button" onClick={() => setOpen((o) => !o)} />
        <div className="Collapse_collapseTitle">
          <span className="SportsContentPromotionBanner_title">
            <img alt="" height="16" src="/icons/specials.svg" width="16" />
            <span className="SportsContentPromotionBanner_titleText">{promo.title}</span>
          </span>
        </div>
        <div className="Collapse_collapseRightContent">
          <span className="CollapseToggleButton_collapseToggle">
            <img alt="chevron" className={cx("Collapse_chevronIcon", open && "Collapse_chevronOpen")} src="/icons/chevron.svg" />
          </span>
        </div>
      </div>
      <div className="Collapse_container" style={{ height: open ? "auto" : 0 }}>
        <div>
          <div
            className="Collapse_collapseBody SportsContentPromotionBanner_body"
            role="link"
            tabIndex={0}
            onClick={() => navigate(promo.href)}
            onKeyDown={(e) => { if (e.key === "Enter") navigate(promo.href); }}
          >
            {promo.image && (
              <a className="SportsContentPromotionBanner_imageWrap" href={promo.href} onClick={(e) => { e.preventDefault(); navigate(promo.href); }}>
                <img alt={promo.alt} className="SportsContentPromotionBanner_image" loading="lazy" src={promo.image} />
              </a>
            )}
            <div className="Flex_root Flex_column Flex_sm3 SportsContentPromotionBanner_content">
              <div className="SportsContentPromotionBanner_heading">
                <h3 className="Heading_root Heading_h3">{promo.heading}</h3>
              </div>
              <p className="SportsContentPromotionBanner_description">
                <span className="SportsContentPromotionBanner_descriptionText">{promo.text}</span>{" "}
                <a className="TextLink_root SportsContentPromotionBanner_learnMore" href={promo.href} onClick={(e) => { e.preventDefault(); navigate(promo.href); }}>
                  Learn more
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CompetitionPage({ sport, category, competition }) {
  const search = useSearch();
  const section = new URLSearchParams(search).get("section");
  const [market, setMarket] = useState(null);
  const [open, setOpen] = useState(false);
  const compHref = `/sports/${sport}/${category}/${competition}`;
  const known = competitions[compHref];
  const page = pageData.sports[sport];
  const match = allGroups().find((g) => g.compHref === compHref);
  const sportTitle = page ? page.title : labelFromSlug(sport);
  const catLabel = known ? known.category.label : match ? match.catName : labelFromSlug(category);
  const catHref = known ? known.category.href : match ? match.catHref : `/sports/${sport}/${category}`;
  const catFlag = known ? known.category.flag : match ? match.catFlag : null;
  const compName = known ? known.title : match ? match.compName : labelFromSlug(competition);
  const compIcon = known ? known.icon : match ? match.compIcon : page ? page.icon : "/icons/globe.svg";
  // Fixtures grouped by day when captured; otherwise whatever group we hold for this competition.
  const groups = known ? known.dateGroups : match ? [match] : groupsForSport(sport, page).slice(0, 1);
  const tabs = known ? known.tabs : page ? page.tabs : [["featured", "Featured"], ["upcoming", "Upcoming"], ["bet-live", "Bet Live"], ["all", `All ${sportTitle}`]];
  const active = tabs.some((t) => t[0] === section) ? section : "featured";
  const markets = page ? page.markets : ["Winner"];
  const selected = market && markets.includes(market) ? market : markets[0];
  return (
    <div>
      <SportsBreadcrumb
        items={[
          { label: "Home", href: "/sports" },
          { label: sportTitle, href: `/sports/${sport}` },
          { label: catLabel, href: catHref, flag: catFlag },
          { label: compName, icon: compIcon },
        ]}
      />
      <section className="LayoutContainer_root LayoutContainer_mobile-bottom-md LayoutContainer_column">
        <div className="Flex_root SportsHeader_wrapper SportsHeader_wrapperNoMargin" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h3 className="LabelLink_root LabelLink_lg">
            <span className="LabelLink_prefix">
              <div className="ImageWithFallback_imageContainer" style={{ width: 24, height: 24 }}>
                <img alt={compName} height="24" loading="lazy" src={compIcon} width="24" />
              </div>
            </span>
            <span className="LabelLink_label">{compName}</span>
          </h3>
          <div className="SportsHeader_toolbar">
            <span className="Tooltip_trigger">
              <button className="SportsHeader_layoutToggle" type="button">
                <img alt="market" src="/icons/three-way-layout.svg" />
              </button>
            </span>
            <div className="FormControlWrapper_root Select_formWrapper" data-testid="market-filter">
              <div aria-hidden="true" data-testid="hidden-select-container" style={{ border: 0, clip: "rect(0px, 0px, 0px, 0px)", clipPath: "inset(50%)", height: 1, margin: -1, overflow: "hidden", padding: 0, position: "fixed", width: 1, whiteSpace: "nowrap", top: 0, left: 0 }}>
                <label>
                  <select name="market-filter" value={selected} onChange={(e) => setMarket(e.target.value)}>
                    {markets.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-label="market-filter"
                className="Select_button SportsHeader_marketSelect"
                type="button"
                onClick={() => setOpen((o) => !o)}
              >
                <span className="Select_item">
                  <span className="Select_text">{selected}</span>
                </span>
                <img alt="Toggle dropdown menu" className="Select_chevronIcon" src="/icons/chevron.svg" />
              </button>
            </div>
          </div>
        </div>
      </section>
      <SectionTabs active={active} base={compHref} tabs={tabs} />
      {known && known.promo && (
        <section className="LayoutContainer_root LayoutContainer_mobile-top-sm5 LayoutContainer_column">
          <PromotionBanner promo={known.promo} />
        </section>
      )}
      <section className="LayoutContainer_root LayoutContainer_mobile-top-sm5 LayoutContainer_column">
        {groups.map((g, i) => (
          <MatchGroup key={g.compHref || g.dateLabel || i} g={g} />
        ))}
      </section>
      <ActivityBoard />
    </div>
  );
}
