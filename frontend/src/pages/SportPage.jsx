import { useState } from "react";
import ActivityBoard from "../components/casino/ActivityBoard";
import { cx } from "../lib/carousel";
import { navigate, useSearch } from "../lib/router";
import { MatchGroup, SportsHeading } from "./SportsPage";
import { groupsForSport } from "../lib/sportsData";
import pageData from "../data/sports-pages.json";

/**
 * A single sport, e.g. `/sports/soccer` — reference layout: breadcrumb, the
 * sport heading with its market and region filters, the section tabs and the
 * competition groups. Fixtures are the captured snapshot used across the
 * sportsbook pages.
 */

/** Back arrow + breadcrumb trail — reference `SportsBreadcrumbLayout`.
 *  `items` are `{ label, href, flag, icon, dropdown }`; the last one renders as
 *  the active crumb, or as the competition dropdown button when it has an icon. */
export function SportsBreadcrumb({ items }) {
  const [open, setOpen] = useState(false);
  const last = items.length - 1;
  return (
    <section className="LayoutContainer_root LayoutContainer_mobile-top-lg LayoutContainer_mobile-bottom-lg LayoutContainer_tablet-top-lg1 LayoutContainer_tablet-bottom-lg1 LayoutContainer_column">
      <div className="SportsBreadcrumbLayout_breadcrumbRoot">
        <button aria-label="back" className="SportsBreadcrumbLayout_backBtn" type="button" onClick={() => window.history.back()}>
          <img alt="arrow left" src="/icons/arrow-left.svg" />
        </button>
        <ul className="BreadcrumbList_list">
          {items.map((item, i) => {
            const isLast = i === last;
            const sep = !isLast && <li key={`${item.label}-sep`} className="BreadcrumbSeparator_separator SportsBreadcrumb_hideOnMobile" />;
            if (isLast && item.icon) {
              return (
                <li key={item.label} className="BreadcrumbDropdownList_root">
                  <div>
                    <button className="BreadcrumbDropdownList_dropdownBtn" type="button" onClick={() => setOpen((o) => !o)}>
                      <div className="ImageWithFallback_imageContainer" style={{ width: 16, height: 16 }}>
                        <img alt={item.label} height="16" loading="lazy" src={item.icon} width="16" />
                      </div>
                      <span>{item.label}</span>
                      <img alt="chevron" className={cx("BreadcrumbDropdownList_chevronIcon", open && "BreadcrumbDropdownList_chevronOpen")} src="/icons/chevron.svg" />
                    </button>
                  </div>
                </li>
              );
            }
            return [
              <li key={item.label} className={cx("BreadcrumbItem_root", isLast ? "BreadcrumbItem_active" : "SportsBreadcrumb_hideOnMobile")}>
                <div className="BreadcrumbItem_name">
                  <span className="BreadcrumbItem_text">
                    {isLast ? (
                      item.label
                    ) : (
                      <a className="BreadcrumbLink_root" href={item.href} onClick={(e) => { e.preventDefault(); navigate(item.href); }}>
                        {item.flag && (
                          <div className="ImageWithFallback_imageContainer SportsBreadcrumb_flag" style={{ width: 16, height: 16 }}>
                            <img alt={item.label} height="16" loading="lazy" src={item.flag} width="16" />
                          </div>
                        )}
                        <span>{item.label}</span>
                      </a>
                    )}
                  </span>
                </div>
              </li>,
              sep,
            ];
          })}
        </ul>
      </div>
    </section>
  );
}

/** The market and region filters that sit beside a sport title — reference `SportsHeader`. */
function SportFilters({ markets, regions }) {
  const [market, setMarket] = useState(markets[0]);
  const [region, setRegion] = useState(regions[0]);
  const [open, setOpen] = useState(null);
  return (
    <>
      <span className="Tooltip_trigger">
        <button className="SportsHeader_layoutToggle" type="button">
          <img alt="market" src="/icons/three-way-layout.svg" />
        </button>
      </span>
      <div className="FormControlWrapper_root Select_formWrapper" data-testid="market-filter">
        <div aria-hidden="true" data-testid="hidden-select-container" style={{ border: 0, clip: "rect(0px, 0px, 0px, 0px)", clipPath: "inset(50%)", height: 1, margin: -1, overflow: "hidden", padding: 0, position: "fixed", width: 1, whiteSpace: "nowrap", top: 0, left: 0 }}>
          <label>
            <select name="market-filter" value={market} onChange={(e) => setMarket(e.target.value)}>
              {markets.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          aria-expanded={open === "market"}
          aria-haspopup="listbox"
          aria-label="market-filter"
          className="Select_button SportsHeader_marketSelect"
          type="button"
          onClick={() => setOpen((o) => (o === "market" ? null : "market"))}
        >
          <span className="Select_item">
            <span className="Select_text">{market}</span>
          </span>
          <img alt="Toggle dropdown menu" className="Select_chevronIcon" src="/icons/chevron.svg" />
        </button>
      </div>
      <div className="FormControlWrapper_root Select_formWrapper" data-testid="filter">
        <div aria-hidden="true" data-testid="hidden-select-container" style={{ border: 0, clip: "rect(0px, 0px, 0px, 0px)", clipPath: "inset(50%)", height: 1, margin: -1, overflow: "hidden", padding: 0, position: "fixed", width: 1, whiteSpace: "nowrap", top: 0, left: 0 }}>
          <label>
            <select name="filter" value={region} onChange={(e) => setRegion(e.target.value)}>
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>
        <button
          aria-expanded={open === "region"}
          aria-haspopup="listbox"
          aria-label="filter"
          className="Select_button SportsHeader_marketSelect"
          type="button"
          onClick={() => setOpen((o) => (o === "region" ? null : "region"))}
        >
          <span className="Select_item">
            <span className="Select_text">{region}</span>
          </span>
          <img alt="Toggle dropdown menu" className="Select_chevronIcon" src="/icons/chevron.svg" />
        </button>
      </div>
    </>
  );
}

/** Featured / Upcoming / Bet Live / Outrights / All <Sport> — reference `NavTabs`. */
export function SectionTabs({ tabs, active, base }) {
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
            {tabs.map(([id, label, counter]) => {
              const href = id === "featured" ? base : `${base}?section=${id}`;
              return (
                <a
                  key={id}
                  className={cx("TabViewOutline_tabOutline", active === id && "TabViewOutline_tabOutlineActive")}
                  data-testid={id}
                  data-text={label}
                  href={href}
                  id={id}
                  onClick={(e) => { e.preventDefault(); navigate(href); }}
                >
                  <span className={cx("TabViewOutline_tabName", counter && "TabViewOutline_tabNameWithCounter")}>
                    {label}
                    {counter && (
                      <span className="TabViewOutline_counter" style={id === "bet-live" ? { background: "rgb(20, 146, 0)" } : undefined}>
                        {counter}
                      </span>
                    )}
                  </span>
                </a>
              );
            })}
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

export default function SportPage({ slug }) {
  const search = useSearch();
  const section = new URLSearchParams(search).get("section");
  const page = pageData.sports[slug];
  if (!page) return null;
  const tabs = page.tabs;
  const active = tabs.some((t) => t[0] === section) ? section : "featured";
  const groups = groupsForSport(slug, page);
  const toolbar = <SportFilters markets={page.markets} regions={pageData.regions} />;
  return (
    <div>
      <SportsBreadcrumb items={[{ label: "Home", href: "/sports" }, { label: page.title }]} />
      <section className="LayoutContainer_root LayoutContainer_mobile-bottom-md LayoutContainer_column">
        <SportsHeading alt={page.title} icon={page.icon} title={page.title} toolbar={toolbar} />
      </section>
      <SectionTabs active={active} base={`/sports/${slug}`} tabs={tabs} />
      <section className="LayoutContainer_root LayoutContainer_mobile-top-md LayoutContainer_column">
        {groups.map((g) => (
          <MatchGroup key={g.compHref} g={g} />
        ))}
      </section>
      <ActivityBoard />
    </div>
  );
}
