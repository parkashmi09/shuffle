import AppShell from "./components/layout/AppShell";
import CasinoHome from "./pages/CasinoHome";
import LotteryPage from "./pages/LotteryPage";
import AirdropPage from "./pages/AirdropPage";
import { CategoryPage } from "./pages/LatestReleasesPage";
import ProvidersPage from "./pages/ProvidersPage";
import { categories } from "./data/categories";
import BlogPage from "./pages/BlogPage";
import { VipPage, AffiliatePage } from "./pages/StaticPage";
import SportsPage from "./pages/SportsPage";
import ChallengesPage from "./pages/ChallengesPage";
import PromotionsPage from "./pages/PromotionsPage";
import PromotionArticlePage from "./pages/PromotionArticlePage";
import SportPage from "./pages/SportPage";
import CompetitionPage from "./pages/CompetitionPage";
import FixturePage from "./pages/FixturePage";
import sportsPages from "./data/sports-pages.json";
import { usePath } from "./lib/router";

const pages = {
  "/": CasinoHome,
  "/lottery": LotteryPage,
  "/airdrop": AirdropPage,
  "/casino/providers": ProvidersPage,
  "/sports": SportsPage,
  "/vip-program": VipPage,
  "/blog": BlogPage,
  "/affiliate": AffiliatePage,
  "/challenges": ChallengesPage,
  "/promotions": PromotionsPage,
};

/** Dynamic routes: promotion articles under `/promotions/<slug>` and `/sports/promotions/<slug>`. */
function renderPage(path) {
  const Static = pages[path];
  if (Static) return <Static />;
  if (/^\/(sports\/)?promotions\/[^/]+$/.test(path)) return <PromotionArticlePage path={path} />;
  if (/^\/blog\/[^/]+$/.test(path)) return <PromotionArticlePage path={path} kind="blog" />;
  const sport = path.match(/^\/sports\/([^/]+)(?:\/[^/]+)?$/)?.[1];
  if (sport && sportsPages.sports[sport]) return <SportPage key={sport} slug={sport} />;
  const comp = path.match(/^\/sports\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (comp) return <CompetitionPage key={path} category={comp[2]} competition={comp[3]} sport={comp[1]} />;
  const fx = path.match(/^\/sports\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (fx) return <FixturePage key={path} category={fx[2]} competition={fx[3]} event={fx[4]} sport={fx[1]} />;
  const cat = path.match(/^\/casino\/categories\/([^/]+)$/)?.[1];
  if (cat === "latest-releases" || categories[cat]) return <CategoryPage key={cat} slug={cat} />;
  return <CasinoHome />;
}

export default function App() {
  const path = usePath();
  return (
    <AppShell>{renderPage(path)}</AppShell>
  );
}
