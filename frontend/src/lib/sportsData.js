import pageData from "../data/sports-pages.json";
import groupData from "../data/sports-groups.json";
import liveData from "../data/sports-live.json";

/** Competition groups for a sport, from whichever capture holds them. */
export function groupsForSport(slug, page) {
  if (page && page.groups && page.groups.length) return page.groups;
  const href = `/sports/${slug}`;
  const fromHome = groupData.filter((g) => g.sportHref === href && !g.outright);
  if (fromHome.length) return fromHome;
  const live = Object.values(liveData.sports).find((s) => s.sport[1] === href);
  return live ? live.groups : [];
}

/** Every competition group we hold, across the three captures. */
export function allGroups() {
  const out = [];
  for (const s of Object.values(pageData.sports)) if (s.groups) out.push(...s.groups);
  out.push(...groupData);
  for (const s of Object.values(liveData.sports)) out.push(...s.groups);
  return out;
}
