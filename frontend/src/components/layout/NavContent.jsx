import { useState } from "react";

/**
 * Navigation list shared by the desktop rail and the mobile menu panel —
 * a 1:1 port of the reference NavigationContent / NavList markup.
 */

import { cx } from "../../lib/carousel";

const casinoLinks = [
  { id: "originals", label: "Originals", icon: "original", href: "/casino/categories/originals" },
  { id: "slots", label: "Slots", icon: "slots", href: "/casino/categories/slots" },
  { id: "live-casino", label: "Live Casino", icon: "casino", href: "/casino/categories/live-casino" },
  { id: "shuffle-picks", label: "Shuffle Picks", icon: "shuffle-picks", href: "/casino/categories/shuffle-picks" },
  { id: "blackjack", label: "Blackjack", icon: "blackjack", href: "/casino/categories/blackjack" },
  { id: "roulette", label: "Roulette", icon: "roulette", href: "/casino/categories/roulette" },
  { id: "game-shows", label: "Game Shows", icon: "game-show", href: "/casino/categories/game-shows" },
  { id: "baccarat", label: "Baccarat", icon: "baccarat", href: "/casino/categories/baccarat" },
  { id: "providers", label: "Providers", icon: "providers", href: "/casino/providers" },
];

// Pinned promotions with their Contentful icons and time-left counters, as on the reference rail.
const promoLinks = [
  { id: "promo-race", label: "$100K Weekly Race", href: "/promotions/100000-weekly-race", icon: "trophy", counter: "16h" },
  { id: "promo-freak", label: "$20K Freak Show!", href: "/promotions/freak-show", icon: "promos/multi", counter: "5d" },
  { id: "promo-level", label: "Level Up Rewards!", href: "/promotions/level-up", icon: "promos/diamond", counter: "10d" },
  { id: "promo-mines", label: "$20K Mines Master!", href: "/promotions/mines-master", icon: "promos/highest-multiplier", counter: "11d" },
  { id: "promo-vip", label: "$30K VIP only", href: "/promotions/vip-hacksaw-heist", icon: "promos/vip", counter: "12d" },
  { id: "promo-chips", label: "Free Chips Drops!", href: "/promotions/free-chips-prize-and-drops", icon: "promos/vip-bonus", counter: "15d" },
];

const sportsTop = [
  { id: "upcoming", label: "Upcoming", icon: "calender-days", href: "/sports?section=upcoming", counter: "1335", counterClass: "Counter_violet" },
  { id: "bet-live", label: "Bet Live", icon: "bet-live", href: "/sports?section=bet-live", counter: "316", counterClass: "Counter_green", greenDot: true },
];
const sportsFeatured = [
  { id: "us-open-race", label: "$10k US Open Race!", icon: "sports/race-wager", href: "/sports/promotions/us-open-2026" },
  { id: "premier-league", label: "Premier League", icon: "sports/soccer", href: "/sports/soccer/1-england/17-premier-league" },
  { id: "laliga", label: "LaLiga", icon: "sports/soccer", href: "/sports/soccer/32-spain/8-laliga" },
  { id: "ufc-paris", label: "UFC Paris", icon: "sports/mma", href: "/sports/mma/1089-ufc/194848-ufc-fight-night-hooker-vs-parnasse" },
  { id: "blast-open", label: "BLAST Open Porto", icon: "sports/cs2", href: "/sports/cs2/counter-strike-2-international/14485-blast-open-fall-2026" },
  { id: "nfl", label: "NFL", icon: "sports/american-football", href: "/sports/american-football/43-usa/31-nfl" },
];
const allSports = [
  ["American Football", "american-football"], ["Aussie Rules", "aussie-rules"], ["Badminton", "badminton"], ["Baseball", "baseball"], ["Basketball", "basketball"], ["Boxing", "boxing"], ["Cricket", "cricket"], ["Darts", "darts"], ["Formula 1", "f1"], ["Futsal", "futsal"], ["Golf", "golf"], ["Handball", "handball"], ["Ice Hockey", "ice-hockey"], ["MMA", "mma"], ["Novelties", "novelties"], ["Rugby", "rugby-union"], ["Soccer", "soccer"], ["Table Tennis", "table-tennis"], ["Tennis", "tennis"], ["Volleyball", "volleyball"],
].map(([label, slug]) => ({ id: `sport-${slug}`, label, icon: `sports/${slug}`, href: `/sports/${slug}` }));
const allEsports = [
  ["Arena of Valor", "aov", "aov"], ["Counter-Strike 2", "cs2", "cs2"], ["CS2 Duels", "cs2-duels", "cs2-duels"], ["Dota 2", "dota2", "dota2"], ["Dota 2 Duels", "dota2-duels", "dota2-duels"], ["eCricket", "ecricket", "ecricket"], ["FIFA", "fifa", "efootball"], ["King of Glory", "kog", "kog"], ["League of Legends", "lol", "lol"], ["Mobile Legends", "ml", "ml"], ["NBA2K", "nba2k", "ebasketball"], ["Rainbow Six", "rainbowsix", "r6"], ["Rocket League", "rocketleague", "rocketleague"], ["Valorant", "valorant", "valorant"], ["Warcraft 3", "w3", "w3"],
].map(([label, icon, slug]) => ({ id: `esport-${slug}`, label, icon: `sports/${icon}`, href: `/sports/${slug}` }));

const footerLinks = [
  { id: "vip", label: "VIP", icon: "vip", href: "/vip-program" },
  { id: "blog", label: "Blog", icon: "blog", href: "/blog" },
  { id: "affiliate", label: "Affiliate", icon: "affiliate", href: "/affiliate" },
];

/** Wraps collapsed items in the reference's tooltip trigger span. */
function Trigger({ expanded, children }) {
  return expanded ? children : <span className="Tooltip_trigger NavigationLink_tooltipTrigger">{children}</span>;
}

export function NavLink({
  id,
  label,
  icon,
  href = "#",
  expanded,
  active,
  disabled,
  counter,
  counterClass = "Counter_violet",
  greenDot,
  linkClass,
  as: Tag = "a",
  onSelect,
}) {
  const hasCounter = counter != null;

  if (disabled) {
    return (
      <Trigger expanded={expanded}>
        <div className="NavigationLink_navItem NavigationLink_disabled">
          <img alt="icon" src={`/icons/${icon}.svg`} />
          {expanded && <span className="NavigationLink_navText">{label}</span>}
        </div>
      </Trigger>
    );
  }

  const props =
    Tag === "a"
      ? { href, onClick: (e) => { e.preventDefault(); onSelect?.(id); } }
      : { type: "button", onClick: () => onSelect?.(id) };

  return (
    <Trigger expanded={expanded}>
      <Tag
        className={cx(
          "NavigationLink_link",
          active && "NavigationLink_active",
          !expanded && hasCounter && "NavigationLink_dot",
          greenDot && "NavigationLink_greenDot",
          linkClass
        )}
        {...props}
      >
        <div className="NavigationLink_navItem">
          <img alt="icon" width="16" height="16" src={`/icons/${icon}.svg`} />
          {expanded && <span className="NavigationLink_navText">{label}</span>}
          {hasCounter && (
            <span className={cx("Counter_root", counterClass, "NavigationLinkCounter_counter", !expanded && "NavigationLinkCounter_isHidden")}>
              {counter}
            </span>
          )}
        </div>
      </Tag>
    </Trigger>
  );
}

export function SearchButton({ expanded, mobileOnly = false }) {
  return (
    <div
      className={cx(
        "SearchComponent_buttonContainer",
        mobileOnly ? "NavigationContent_mobileOnly" : "NavigationContent_searchDesktop",
        expanded ? "SearchComponent_expandedSearch" : "SearchComponent_expandedButtonContainer"
      )}
    >
      <button className="SearchComponent_searchButton" type="button" aria-label="Search">
        <img alt="search" loading="lazy" src="/icons/search.svg" />
        {expanded && <span>Search</span>}
      </button>
    </div>
  );
}

export function TokenCard({ expanded }) {
  return (
    <div className={cx("NavigationToken_token", !expanded && "NavigationToken_collapsed")}>
      <div className="NavigationToken_tokenInfo">
        <a className="NavigationToken_iconLink" href="/token" onClick={(e) => e.preventDefault()}>
          <img alt="token" src="/icons/token.svg" />
        </a>
        <div className="NavigationToken_textContainer">
          <p>
            Shuffle <span className="NavigationToken_code">(SHFL)</span>
          </p>
          <p className="NavigationToken_coming">
            <span className="NavigationToken_code">$0.3093</span>&nbsp;
            <span className="TokenPercentageText_negative">-0.55%</span>
          </p>
        </div>
      </div>
      <div className="NavigationToken_btnContainer">
        <a className="NavigationToken_linkBtn NavigationToken_linkBtnDisabled" href="/?modal=wallet">
          Convert
        </a>
        <a className="NavigationToken_linkBtn" href="/token" onClick={(e) => e.preventDefault()}>
          Dashboard
        </a>
      </div>
    </div>
  );
}

/** Collapsible link group — reference `ExpandableLinks` (Promotions, All sports, All Esports). */
function ExpandableGroup({ expanded, icon, label, links, active, onSelect, open, onToggle }) {
  return (
    <div className={cx("ExpandableLinks_root", expanded ? "ExpandableLinks_expanded" : "ExpandableLinks_collapsed", open ? "ExpandableLinks_isOpen" : "ExpandableLinks_isClosed")}>
      <Trigger expanded={expanded}>
        <button aria-label={open ? "close" : "open"} aria-expanded={open} className={cx("ExpandableLinks_toggleButton", open && "ExpandableLinks_toggleButtonOpen")} type="button" onClick={onToggle}>
          <span className="ExpandableLinks_title">
            <img alt="icon" height="16" src={`/icons/${icon}.svg`} width="16" />
            {expanded ? <span className="ExpandableLinks_truncate">{label}</span> : <img alt="arrow" className="ExpandableLinks_arrow" src="/icons/chevron.svg" />}
          </span>
          {expanded && (
            <span aria-hidden="true" className={cx("ExpandableLinks_arrowButton", open && "ExpandableLinks_arrowButtonOpen")}>
              <img alt="arrow" src="/icons/chevron.svg" width="16" />
            </span>
          )}
        </button>
      </Trigger>
      <div className={cx("ExpandableLinks_navs", open ? "ExpandableLinks_show" : "ExpandableLinks_hidden")}>
        {links.map((l) => (
          <NavLink key={l.id} {...l} counterClass={l.counter ? "Counter_text" : undefined} expanded={expanded} active={active === l.id} linkClass="ExpandableLinks_nestedLinks" onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

/** The scrolling part of the navigation: token card + all links. */
/** `variant="minimal"` is the reduced list the reference shows on non-casino routes such as the lottery. */
export default function NavContent({ expanded, active, onSelect, mobile = false, variant = "casino" }) {
  const casino = variant === "casino";
  const sportsbook = variant === "sports";
  const [promosOpen, setPromosOpen] = useState(false);
  // The two sport directories behave as one accordion: opening either closes the
  // other, so only one long list is ever pushed into the rail at a time.
  const [openDirectory, setOpenDirectory] = useState(null);
  const toggleDirectory = (id) => setOpenDirectory((cur) => (cur === id ? null : id));

  return (
    // The reference applies `isExpanded` here only while the rail is collapsed
    // (the icon tab strip takes the extra 80px).
    <div className={cx("NavigationContent_navContent", !expanded && !mobile && "NavigationContent_isExpanded")}>
      <div className={cx("NavigationSideAnimate_root NavigationSideAnimate_ready", expanded && "NavigationSideAnimate_isExpanded")}>
        {mobile && <SearchButton expanded mobileOnly />}
        <TokenCard expanded={expanded} />

        <div className={cx("NavList_root", expanded && "NavList_isExpanded")}>
          <NavLink id={sportsbook ? "sports" : "home"} label="Home" icon="home" href={sportsbook ? "/sports" : "/"} expanded={expanded} active={active === (sportsbook ? "sports" : "home")} onSelect={onSelect} />
          {sportsbook && sportsTop.map((l) => <NavLink key={l.id} {...l} expanded={expanded} active={active === l.id} onSelect={onSelect} />)}
          {casino && (
            <>
              <NavLink id="favourites" label="Favourites" icon="star" expanded={expanded} disabled />
              <NavLink id="latest" label="Latest Releases" icon="latest-releases" href="/casino/categories/latest-releases" expanded={expanded} active={active === "latest"} onSelect={onSelect} />
              <NavLink id="recent" label="Recently Played" icon="recent-played" expanded={expanded} disabled />
              <NavLink id="challenges" label="Challenges" icon="challenge" href="/challenges" expanded={expanded} active={active === "challenges"} counter="26" onSelect={onSelect} />
            </>
          )}

          <div className={cx("NavigationLineBreakWrapper_root", expanded && "NavigationLineBreakWrapper_expanded")}>
            <div className="NavigationLottery_root">
              <NavLink
                id="lottery"
                label="SHFL Lottery"
                icon="8"
                href="/lottery"
                expanded={expanded}
                active={active === "lottery"}
                greenDot
                linkClass="NavigationLottery_lottery"
                counter={<span className="NavigationLottery_date">5d</span>}
                counterClass="Counter_text"
                onSelect={onSelect}
              />
            </div>
            <div className="NavigationTokenAirdrop_root">
              <NavLink
                id="airdrop"
                label="SHFL Airdrop"
                icon="token-white"
                href="/airdrop"
                expanded={expanded}
                active={active === "airdrop"}
                greenDot
                counter={<span className="NavigationTokenAirdrop_date">6d</span>}
                counterClass="Counter_text"
                onSelect={onSelect}
              />
            </div>
            <ExpandableGroup
              expanded={expanded}
              icon="promotions"
              label="Promotions"
              links={[...promoLinks, { id: "promotions", label: "All Promotions", icon: "promotions", href: "/promotions" }]}
              active={active}
              onSelect={onSelect}
              open={promosOpen}
              onToggle={() => setPromosOpen((o) => !o)}
            />
          </div>

          {sportsbook && sportsFeatured.map((l) => <NavLink key={l.id} {...l} expanded={expanded} active={active === l.id} onSelect={onSelect} />)}
          {sportsbook && (
            <div className={cx("NavigationLineBreakWrapper_root", expanded && "NavigationLineBreakWrapper_expanded")}>
              <ExpandableGroup expanded={expanded} icon="all-sports" label="All sports" links={allSports} active={active} onSelect={onSelect} open={openDirectory === "sports"} onToggle={() => toggleDirectory("sports")} />
              <ExpandableGroup expanded={expanded} icon="esports" label="All Esports" links={allEsports} active={active} onSelect={onSelect} open={openDirectory === "esports"} onToggle={() => toggleDirectory("esports")} />
            </div>
          )}

          {casino && casinoLinks.map((l) => (
            <NavLink key={l.id} {...l} expanded={expanded} active={active === l.id} onSelect={onSelect} />
          ))}

          {casino && <hr className={cx("NavDivider_root", expanded && "NavDivider_isExpanded")} />}

          {footerLinks.map((l) => (
            <NavLink key={l.id} {...l} expanded={expanded} active={active === l.id} onSelect={onSelect} />
          ))}
          <NavLink id="support" label="Live Support" icon="live-support" expanded={expanded} as="button" onSelect={() => {}} />
        </div>
      </div>
    </div>
  );
}
