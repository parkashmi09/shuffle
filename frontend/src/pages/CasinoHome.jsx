import { useState } from "react";
import HeroBanners from "../components/casino/HeroBanners";
import CategoryTabs from "../components/casino/CategoryTabs";
import GameCarousel from "../components/casino/GameCarousel";
import CategoryGrid from "../components/casino/CategoryGrid";
import ProviderCarousel from "../components/casino/ProviderCarousel";
import TournamentsCarousel from "../components/casino/TournamentsCarousel";
import ActivityBoard from "../components/casino/ActivityBoard";
import SeoArticle from "../components/casino/SeoArticle";
import { adminCategorySlug, categoryQuery } from "../lib/categories";
import { useGate } from "../lib/gates";
import { usePublicSiteConfig } from "../lib/usePublicSiteConfig";
import { useBanners, useCategory, useLobbySection, useProviders } from "../lib/catalogue";


const PAGE = 28;

/**
 * Home category tabs — furniture from the capture, games from the catalogue
 * where `categoryQuery` can express the tab (same path as CategoryPage).
 */
const categories = {
  ORIGINALS: {
    slug: "originals",
    title: "Originals",
    icon: "/icons/original.svg",
    href: "/casino/categories/originals",
  },
  SLOTS: {
    slug: "slots",
    title: "Slots",
    icon: "/icons/slots.svg",
    href: "/casino/categories/slots",
  },
  LIVE_CASINO: {
    slug: "live-casino",
    title: "Live Casino",
    icon: "/icons/casino.svg",
    href: "/casino/categories/live-casino",
  },
  TABLE_GAMES: {
    slug: "table-games",
    title: "Table Games",
    icon: "/icons/table-games.svg",
    href: "/casino/categories/table-games",
  },
};

/** One non-lobby tab — mounts only while selected so we don't prefetch every tab. */
function HomeCategoryTab({ slug, title, icon, href }) {
  const [count, setCount] = useState(PAGE);
  const { games, total, isLive } = useCategory(slug, {
    captured: [],
    ...categoryQuery(slug),
    admin: adminCategorySlug(slug),
    limit: count,
  });

  return (
    <CategoryGrid
      title={title}
      icon={icon}
      href={href}
      games={games}
      total={isLive ? total : 0}
      onShowMore={isLive ? () => setCount((c) => c + PAGE) : undefined}
    />
  );
}

/** The lobby search box's results — `GET /casino/games?search=`, the same read as a category page. */
function SearchResults({ q }) {
  const [count, setCount] = useState(PAGE);
  const { games, total, isLive, loading } = useCategory(`search:${q}`, { captured: [], search: q, limit: count });
  return (
    <>
      <CategoryGrid
        title={`Results for "${q}"`}
        icon="/icons/search.svg"
        href="/"
        games={games}
        total={isLive ? total : 0}
        onShowMore={isLive ? () => setCount((c) => c + PAGE) : undefined}
      />
      {!loading && !isLive && (
        <div className="CardGridEmpty_root">
          <img alt="" height="62" src="/icons/cross.svg" width="62" />
          <p>No games found</p>
        </div>
      )}
    </>
  );
}

/**
 * Casino lobby — reference home page. "Lobby" renders the full section stack;
 * any other tab shows that category as a wrapped grid.
 */
export default function CasinoHome() {
  const [tab, setTab] = useState("LOBBY");
  const [query, setQuery] = useState("");
  const q = query.trim();
  const category = tab === "LOBBY" ? null : categories[tab];

  // Each of these reads its route and keeps the capture when the table is
  // empty — see `lib/catalogue.js`. The lobby renders identically either way.
  const { banners } = useBanners();
  const on = useGate();
  // The site admin's home-section switches; unset or unanswered = shown.
  const { flags } = usePublicSiteConfig();
  const shown = (key) => flags?.[key] !== false;
  const { providers } = useProviders();
  const slots = useLobbySection("slots");
  const liveCasino = useLobbySection("live-casino");
  const gameShows = useLobbySection("game-shows");
  const shuffleGames = useLobbySection("shuffle-games");
  const shufflePicks = useLobbySection("shuffle-picks");
  const latestReleases = useLobbySection("latest-releases");

  return (
    <>
      {on("banners") && <HeroBanners banners={banners} />}
      <CategoryTabs active={tab} onChange={setTab} query={query} onQuery={setQuery} />

      <section className="LayoutContainer_root LayoutContainer_mobile-bottom-md2 LayoutContainer_tablet-bottom-0 LayoutContainer_column">
        <div className="Home_homeTabContainer">
          {q.length >= 2 ? (
            <SearchResults key={q} q={q} />
          ) : category ? (
            <HomeCategoryTab key={tab} {...category} />
          ) : (
            <div className="HomeTabLobby_homeTabLobbyWrapper">
              {/* No View all card on this row — removed on request. */}
              <GameCarousel section={shuffleGames} viewAll={false} />
              {shown("home_popularslots") && <GameCarousel section={slots} />}
              {shown("home_livecasino") && <GameCarousel section={liveCasino} />}
              <ProviderCarousel providers={providers} />
              <GameCarousel section={gameShows} />
              <GameCarousel section={shufflePicks} />
              <GameCarousel section={latestReleases} />
              {shown("home_promocards") && <TournamentsCarousel />}
            </div>
          )}
        </div>
      </section>

      {(shown("home_latestwins") || shown("home_leaderboard")) && (
        <ActivityBoard hideTabs={[...(shown("home_latestwins") ? [] : ["latest-bets", "high-roller-bets"]), ...(shown("home_leaderboard") ? [] : ["race"])]} />
      )}
      <SeoArticle />
    </>
  );
}
