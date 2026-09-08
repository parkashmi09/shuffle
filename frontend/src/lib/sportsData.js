import pageData from "../data/sports-pages.json";
import groupData from "../data/sports-groups.json";
import liveData from "../data/sports-live.json";
import upcomingData from "../data/sports-upcoming.json";
import competitions from "../data/sports-competitions.json";
import cardData from "../data/sports-fixtures.json";

/** Competition groups for a sport, from whichever capture holds them. */
export function groupsForSport(slug, page) {
  if (page && page.groups && page.groups.length) return page.groups;
  const href = `/sports/${slug}`;
  const fromHome = groupData.filter((g) => g.sportHref === href && !g.outright);
  if (fromHome.length) return fromHome;
  const live = Object.values(liveData.sports).find((s) => s.sport[1] === href);
  return live ? live.groups : [];
}

/** Outright markets held for a sport. `groupsForSport` deliberately skips these,
 *  and their `sportHref` points at the tournament rather than the sport. */
export function outrightsForSport(slug) {
  const href = `/sports/${slug}`;
  return groupData.filter((g) => g.outright && (g.sportHref === href || g.sportHref.startsWith(`${href}/`)));
}

/** Every competition group we hold, across the three captures. */
export function allGroups() {
  const out = [];
  for (const s of Object.values(pageData.sports)) if (s.groups) out.push(...s.groups);
  out.push(...groupData);
  for (const s of Object.values(liveData.sports)) out.push(...s.groups);
  return out;
}

/**
 * Every fixture the sportsbook links to, indexed by href. The rows carry the
 * competitors, the kick-off and the market shown on the tile, which is enough to
 * open a real fixture page for a match we hold no full capture for.
 */
let rowIndex = null;

function buildRowIndex() {
  const index = new Map();
  const add = (f, market, cols, sportIcon) => {
    if (!f || !f.href || index.has(f.href) || !f.home || !f.away) return;
    index.set(f.href, {
      home: f.home,
      away: f.away,
      date: f.date || f.startTime || null,
      market: market || null,
      cols: cols || f.cols || 2,
      sels: f.sels || [],
      sportIcon: sportIcon || (f.si ? f.si[1] : null),
    });
  };
  // The flat upcoming lists carry their own market name per row.
  for (const rows of Object.values(upcomingData.bySport || {})) rows.forEach((f) => add(f, f.m, f.cols));
  (upcomingData.fx || []).forEach((f) => add(f, f.m, f.cols));
  // Competition groups name the market once for the whole group.
  const groups = [...groupData];
  for (const s of Object.values(liveData.sports)) groups.push(...s.groups);
  for (const p of Object.values(pageData.sports)) if (p.groups) groups.push(...p.groups);
  for (const c of Object.values(competitions)) if (c.dateGroups) groups.push(...c.dateGroups);
  for (const g of groups) (g.fx || []).forEach((f) => add(f, g.market, g.cols, g.sportIcon));
  // The home page cards keep the teams under a different key.
  for (const c of cardData.trending || []) {
    if (!c.teams) continue;
    add({ href: c.href, home: c.teams[0], away: c.teams[1], date: c.startTime, sels: c.selections }, null, (c.selections || []).length, c.sportIcon);
  }
  // The SGM cards name their teams by logo id, and their rows list picks rather
  // than prices, so they contribute the competitors and kick-off only.
  const logo = (id) => (id && !String(id).startsWith("/") ? `/images/sports/logos/${id}.png` : id);
  for (const c of cardData.sgm || []) {
    if (!c.teams) continue;
    const teams = c.teams.map((t) => [t[0], logo(t[1])]);
    add({ href: c.href, home: teams[0], away: teams[1], date: c.date, sels: [] });
  }
  return index;
}

/** The row we hold for one fixture, or null. */
export function fixtureRowFor(href) {
  if (!rowIndex) rowIndex = buildRowIndex();
  return rowIndex.get(href) || null;
}

/**
 * The pitch behind a fixture banner and the home cards. Most sports use
 * `sports-<slug>`, but the esports files are named after the game rather than the
 * slug (`cs2` is `esports-counter-strike-2`, `lol` is `esports-league-of-legends`)
 * and a few others differ too, so the exceptions are listed rather than derived.
 * Sports absent here have no banner on the reference either.
 */
const BANNERS = {
  dota2: "esports-dota2",
  "dota2-duels": "esports-dota2-duels",
  cs2: "esports-counter-strike-2",
  "cs2-duels": "esports-cs2-duels",
  lol: "esports-league-of-legends",
  valorant: "esports-valorant",
  r6: "esports-rainbow-six",
  rocketleague: "esports-rocket-league",
  ecricket: "esports-ecricket",
  efootball: "esports-fifa",
  kog: "esports-king-of-glory",
  aov: "esports-arena-of-valor",
  ml: "esports-mobile-legends",
  w3: "esports-warcraft",
  "rugby-union": "sports-rugby",
};

/** Background image for a sport's banner, or null when it has none. */
export function bannerForSport(slug) {
  const NONE = new Set(["ebasketball", "mma"]);
  if (!slug || NONE.has(slug)) return null;
  return `/images/sports/banner/${BANNERS[slug] || `sports-${slug}`}.webp`;
}
