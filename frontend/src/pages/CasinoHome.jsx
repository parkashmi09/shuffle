import { useState } from "react";
import HeroBanners from "../components/casino/HeroBanners";
import CategoryTabs from "../components/casino/CategoryTabs";
import GameCarousel from "../components/casino/GameCarousel";
import CategoryGrid from "../components/casino/CategoryGrid";
import ProviderCarousel from "../components/casino/ProviderCarousel";
import AirdropTile from "../components/casino/AirdropTile";
import TournamentsCarousel from "../components/casino/TournamentsCarousel";
import ActivityBoard from "../components/casino/ActivityBoard";
import SeoArticle from "../components/casino/SeoArticle";
import { sections } from "../data/catalog";
import { useBanners, useLobbySection, useProviders } from "../lib/catalogue";

const bySlug = Object.fromEntries(sections.map((s) => [s.id, s]));
const row = (id) => bySlug[id];
const pool = (...ids) => ids.flatMap((id) => row(id)?.games || []);

/** Category tabs — 28 cards per page like the reference, drawn from the lobby rows. */
const categories = {
  ORIGINALS: { title: "Originals", icon: "/icons/original.svg", href: "/casino/categories/originals", games: pool("shuffle-games", "shuffle-picks"), total: 33 },
  SLOTS: { title: "Slots", icon: "/icons/slots.svg", href: "/casino/categories/slots", games: pool("slots", "latest-releases"), total: 6488 },
  LIVE_CASINO: { title: "Live Casino", icon: "/icons/casino.svg", href: "/casino/categories/live-casino", games: pool("live-casino", "game-shows"), total: 412 },
  TABLE_GAMES: { title: "Table Games", icon: "/icons/table-games.svg", href: "/casino/categories/table-games", games: pool("shuffle-picks", "live-casino"), total: 190 },
};

/**
 * Casino lobby — reference home page. "Lobby" renders the full section stack;
 * any other tab shows that category as a wrapped grid.
 */
export default function CasinoHome() {
  const [tab, setTab] = useState("LOBBY");
  const category = tab === "LOBBY" ? null : categories[tab];

  // Each of these reads its route and keeps the capture when the table is
  // empty — see `lib/catalogue.js`. The lobby renders identically either way.
  const { banners } = useBanners("home");
  const { providers } = useProviders();
  const slots = useLobbySection("slots");
  const liveCasino = useLobbySection("live-casino");
  const gameShows = useLobbySection("game-shows");
  const shuffleGames = useLobbySection("shuffle-games");
  const shufflePicks = useLobbySection("shuffle-picks");
  const latestReleases = useLobbySection("latest-releases");

  return (
    <>
      <HeroBanners banners={banners} />
      <CategoryTabs active={tab} onChange={setTab} />

      <section className="LayoutContainer_root LayoutContainer_mobile-bottom-md2 LayoutContainer_tablet-bottom-0 LayoutContainer_column">
        <div className="Home_homeTabContainer">
          {category ? (
            <CategoryGrid {...category} />
          ) : (
            <div className="HomeTabLobby_homeTabLobbyWrapper">
              {/* No View all card on this row — removed on request. */}
              <GameCarousel section={shuffleGames} viewAll={false} />
              <GameCarousel section={slots} />
              <GameCarousel section={liveCasino} />
              <ProviderCarousel providers={providers} />
              <AirdropTile />
              <GameCarousel section={gameShows} />
              <GameCarousel section={shufflePicks} />
              <GameCarousel section={latestReleases} />
              <TournamentsCarousel />
            </div>
          )}
        </div>
      </section>

      <ActivityBoard />
      <SeoArticle />
    </>
  );
}
