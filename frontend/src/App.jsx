import { useEffect } from "react";
import AppShell from "./components/layout/AppShell";
import CasinoHome from "./pages/CasinoHome";
import { CategoryPage } from "./pages/LatestReleasesPage";
import ProvidersPage from "./pages/ProvidersPage";
import ProviderPage from "./pages/ProviderPage";
import GamePage from "./pages/GamePage";
import { FavouritesPage, RecentlyPlayedPage } from "./pages/MyGamesPage";
import BlogPage from "./pages/BlogPage";
import BlogArticlePage from "./pages/BlogArticlePage";
import { AffiliatePage } from "./pages/StaticPage";
import AffiliateProgramPage from "./pages/AffiliateProgramPage";
import { usePublicSiteConfig } from "./lib/usePublicSiteConfig";
import VipPage from "./pages/VipPage";
import SportsPage from "./pages/SportsPage";
import ChallengesPage from "./pages/ChallengesPage";
import PromotionsPage from "./pages/PromotionsPage";
import PromotionArticlePage from "./pages/PromotionArticlePage";
import TransactionsPage from "./pages/TransactionsPage";
import SettingsPage from "./pages/SettingsPage";
import ShuffleWisePage from "./pages/ShuffleWisePage";
import { hasCategory } from "./lib/categories";
import { navigate, usePath } from "./lib/router";
import { useSession } from "./lib/sessionContext";
import { useGate } from "./lib/gates";
import { findPage, useSiteContent } from "./lib/siteContent";

const pages = {
  "/": CasinoHome,
  "/casino/providers": ProvidersPage,
  "/sports": SportsPage,
  "/vip-program": VipPage,
  "/blog": BlogPage,
  "/affiliate": AffiliatePage,
  "/challenges": ChallengesPage,
  "/promotions": PromotionsPage,
  // The reset email's link and Google's return: the lobby, with AppShell's auth modal / exchange over it.
  "/reset-password": CasinoHome,
  "/login/google": CasinoHome,
};

/** Dynamic routes: promotion articles under `/promotions/<slug>` and `/sports/promotions/<slug>`. */
function renderPage(path, content) {
  const Static = pages[path];
  if (Static) return <Static />;
  // Policy pages are the site admin's (Site content → pages); an unsaved slug falls through to the lobby.
  const info = findPage(content, path.match(/^\/info\/([^/]+)$/)?.[1]);
  if (info) return <BlogArticlePage key={info.slug} page={info} />;
  // SHFL token, airdrop and lottery are the reference's own product: no platform API behind them.
  if (/^\/(token|airdrop|lottery)$/.test(path)) return <Redirect to="/" />;
  if (/^\/(sports\/)?promotions\/[^/]+$/.test(path)) return <PromotionArticlePage path={path} />;
  if (/^\/blog\/([^/]+)$/.test(path)) {
    const slug = path.match(/^\/blog\/([^/]+)$/)[1];
    return <BlogArticlePage slug={slug} />;
  }
  // The reference's own tab slugs: `/transactions` is Deposits, the rest carry
  // their id. `key` remounts on a tab change so each starts its own read.
  // `/settings` has no page of its own — the reference lands on Account.
  // A player's own game lists. Signed out they are nobody's, so the shell
  // sends the visitor back to the lobby rather than showing an empty grid.
  if (path === "/favourites") return <MyGames><FavouritesPage /></MyGames>;
  // The path this port used before it was checked against the reference.
  if (path === "/casino/favourites") return <Redirect to="/favourites" />;
  if (path === "/casino/recently-played") return <MyGames><RecentlyPlayedPage /></MyGames>;
  if (path === "/settings") return <Redirect to="/settings/account" />;
  // Shuffle Wise has no bare route either — every link on the live site points
  // straight at the first tab.
  if (path === "/shuffle-wise") return <Redirect to="/shuffle-wise/self-exclusion" />;
  const wiseTab = path.match(/^\/shuffle-wise\/(self-exclusion|gambling-limits)$/);
  if (wiseTab) return <ShuffleWise key={wiseTab[1]} />;
  const settingsTab = path.match(/^\/settings\/(account|verify|security|preferences|sessions|ignored-users)$/);
  if (settingsTab) return <Settings key={settingsTab[1]} />;
  const txTab = path.match(/^\/transactions(?:\/(deposits|withdrawals|bets|sports-bets|tip-rain|other))?$/);
  if (txTab) return <MyGames><TransactionsPage key={txTab[1] || "deposits"} /></MyGames>;
  // The signed-in affiliate dashboard. `/affiliate` itself stays the marketing
  // page the reference serves to everyone; these four are the account menu's.
  const affiliateTab = path.match(/^\/affiliate\/(overview|referred-users|campaigns|earnings)$/)?.[1];
  if (affiliateTab) return <AffiliateProgram key={affiliateTab} tab={affiliateTab} />;
  // Every other `/sports/...` is the exchange (lobby, match, My Bets, Statement) — one page, so its
  // own navigations never remount it.
  if (path.startsWith("/sports/")) return <SportsPage />;
  const cat = path.match(/^\/casino\/categories\/([^/]+)$/)?.[1];
  if (cat && hasCategory(cat)) return <CategoryPage key={cat} slug={cat} />;
  const provider = path.match(/^\/casino\/providers\/([^/]+)$/)?.[1];
  if (provider) return <ProviderPage key={provider} slug={provider} />;
  // The screen behind a game tile. `key` remounts on a uuid change so opening
  // a second game starts its own launch rather than reusing the first's state.
  const gameUuid = path.match(/^\/casino\/games\/([^/]+)$/)?.[1];
  if (gameUuid) return <GamePage key={gameUuid} uuid={gameUuid} />;
  return <CasinoHome />;
}

/** A route with no page of its own. Navigating in an effect, not in render. */
function Redirect({ to }) {
  useEffect(() => { navigate(to); }, [to]);
  return null;
}

/** An account page reached signed out: the lobby, with the login sheet up asking for the account. */
function SignInFirst() {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("shuffle:auth", { detail: "login" }));
  }, []);
  return <CasinoHome />;
}

/** Favourites and Recently Played exist only for an account that has them. */
function MyGames({ children }) {
  const { signedIn, restoring } = useSession();
  if (restoring) return <div className="CardGrid_cardGridWrapper" />;
  if (!signedIn) return <SignInFirst />;
  return children;
}

/** Nothing here belongs to a visitor without an account. */
function Settings() {
  const { signedIn, restoring } = useSession();
  if (restoring) return <div className="Settings_settingsViewContainer" />;
  if (!signedIn) return <SignInFirst />;
  return <SettingsPage />;
}

/** A break from betting and a cap on staking are account settings, not a page for a visitor. */
function ShuffleWise() {
  const { signedIn, restoring } = useSession();
  if (restoring) return <div className="ShuffleWise_container" />;
  if (!signedIn) return <SignInFirst />;
  return <ShuffleWisePage />;
}

/** Signed out, the dashboard tabs have nothing to show — the marketing page does. */
function AffiliateProgram({ tab }) {
  const { signedIn, restoring } = useSession();
  const { affiliateEnabled } = usePublicSiteConfig();
  if (restoring) return <div className="AffiliateProgram_layoutContainer" />;
  if (!affiliateEnabled) return <AffiliatePage />;
  return signedIn ? <AffiliateProgramPage tab={tab} /> : <AffiliatePage />;
}

/** Path prefix → the owner/admin gate that must be open for it (`lib/gates.js`). First match wins. */
const ROUTE_GATES = [
  [/^\/vip-program$/, "vip"],
  [/^\/blog(\/|$)/, "blog"],
  [/^\/affiliate(\/|$)/, "affiliate"],
  [/^\/challenges$/, "challenges"],
  [/^\/(sports\/)?promotions(\/|$)/, "promotions"],
  [/^\/sports(\/|$)/, "sports"],
  [/^\/casino\//, "casino"],
];

export default function App() {
  const path = usePath();
  const on = useGate();
  const content = useSiteContent();
  const gate = ROUTE_GATES.find(([re]) => re.test(path))?.[1];
  // A page the owner or the site admin switched off is the lobby, like any unknown path.
  return (
    <AppShell>{gate && !on(gate) ? <CasinoHome /> : renderPage(path, content)}</AppShell>
  );
}
