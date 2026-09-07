import { useEffect, useState } from "react";

/** Minimal history-based router: `usePath()` / `useSearch()` + `navigate(url)`. */
const listeners = new Set();
const readPath = () => window.location.pathname;
const readSearch = () => window.location.search;

export function navigate(to) {
  const url = new URL(to, window.location.origin);
  const next = url.pathname + url.search;
  if (readPath() + readSearch() === next) return;
  window.history.pushState(null, "", next);
  listeners.forEach((l) => l());
  document.querySelector("#pageContent")?.scrollTo(0, 0);
}

function useLocationPart(read) {
  const [value, setValue] = useState(() => (typeof window === "undefined" ? "" : read()));
  useEffect(() => {
    const update = () => setValue(read());
    update();
    window.addEventListener("popstate", update);
    listeners.add(update);
    return () => {
      window.removeEventListener("popstate", update);
      listeners.delete(update);
    };
  }, [read]);
  return value;
}

/** Current pathname, re-rendering on navigation. */
export function usePath() {
  return useLocationPart(readPath);
}

/** Current query string (including the leading "?"), re-rendering on navigation. */
export function useSearch() {
  return useLocationPart(readSearch);
}

/** Sidebar / nav ids that have their own page. */
export const routes = {
  home: "/",
  lottery: "/lottery",
  airdrop: "/airdrop",
  latest: "/casino/categories/latest-releases",
  challenges: "/challenges",
  promotions: "/promotions",
  originals: "/casino/categories/originals",
  slots: "/casino/categories/slots",
  "live-casino": "/casino/categories/live-casino",
  "shuffle-picks": "/casino/categories/shuffle-picks",
  blackjack: "/casino/categories/blackjack",
  roulette: "/casino/categories/roulette",
  "game-shows": "/casino/categories/game-shows",
  baccarat: "/casino/categories/baccarat",
  providers: "/casino/providers",
  sports: "/sports",
  upcoming: "/sports?section=upcoming",
  "bet-live": "/sports?section=bet-live",
  // Listed so the All Sports section does not fall back to the Home nav id.
  "sports-all": "/sports?section=all",
  // Every sport in the rail's "All sports" / "All Esports" groups.
  "sport-american-football": "/sports/american-football",
  "sport-aussie-rules": "/sports/aussie-rules",
  "sport-badminton": "/sports/badminton",
  "sport-baseball": "/sports/baseball",
  "sport-basketball": "/sports/basketball",
  "sport-boxing": "/sports/boxing",
  "sport-cricket": "/sports/cricket",
  "sport-darts": "/sports/darts",
  "sport-f1": "/sports/f1",
  "sport-futsal": "/sports/futsal",
  "sport-golf": "/sports/golf",
  "sport-handball": "/sports/handball",
  "sport-ice-hockey": "/sports/ice-hockey",
  "sport-mma": "/sports/mma",
  "sport-novelties": "/sports/novelties",
  "sport-rugby-union": "/sports/rugby-union",
  "sport-soccer": "/sports/soccer",
  "sport-table-tennis": "/sports/table-tennis",
  "sport-tennis": "/sports/tennis",
  "sport-volleyball": "/sports/volleyball",
  "esport-aov": "/sports/aov",
  "esport-cs2": "/sports/cs2",
  "esport-cs2-duels": "/sports/cs2-duels",
  "esport-dota2": "/sports/dota2",
  "esport-dota2-duels": "/sports/dota2-duels",
  "esport-ecricket": "/sports/ecricket",
  "esport-efootball": "/sports/efootball",
  "esport-kog": "/sports/kog",
  "esport-lol": "/sports/lol",
  "esport-ml": "/sports/ml",
  "esport-ebasketball": "/sports/ebasketball",
  "esport-r6": "/sports/r6",
  "esport-rocketleague": "/sports/rocketleague",
  "esport-valorant": "/sports/valorant",
  "esport-w3": "/sports/w3",
  // Competitions pinned in the sportsbook rail.
  "us-open-race": "/sports/promotions/us-open-2026",
  "premier-league": "/sports/soccer/1-england/17-premier-league",
  laliga: "/sports/soccer/32-spain/8-laliga",
  "ufc-paris": "/sports/mma/1089-ufc/194848-ufc-fight-night-hooker-vs-parnasse",
  "blast-open": "/sports/cs2/counter-strike-2-international/14485-blast-open-fall-2026",
  nfl: "/sports/american-football/43-usa/31-nfl",
  vip: "/vip-program",
  blog: "/blog",
  affiliate: "/affiliate",
  "promo-race": "/promotions/100000-weekly-race",
  "promo-freak": "/promotions/freak-show",
  "promo-level": "/promotions/level-up",
  "promo-mines": "/promotions/mines-master",
  "promo-vip": "/promotions/vip-hacksaw-heist",
  "promo-chips": "/promotions/free-chips-prize-and-drops",
};

export const navIdForPath = (path) => Object.keys(routes).find((k) => routes[k] === path) || null;
