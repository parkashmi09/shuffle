import { useCallback, useEffect, useState } from "react";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import Footer from "./Footer";
import PageLoader from "./PageLoader";
import AuthModal from "../auth/AuthModal";
import LogoutModal from "../auth/LogoutModal";
import WeeklyRaceModal from "../casino/WeeklyRaceModal";
import WalletModal from "../wallet/WalletModal";
import VaultModal from "../wallet/VaultModal";
import RedeemCodeModal from "../rewards/RedeemCodeModal";
import NotificationPanel from "./NotificationPanel";
import BetSlipPanel from "./BetSlipPanel";
import VipPanel from "./VipPanel";
import Alerts from "../ui/Alerts";
import { navIdForPath, navigate, routes, usePath, useSearch } from "../../lib/router";
import { captureReferralFromSearch } from "../../lib/referralCapture";
import { SessionProvider } from "../../lib/session";
import { FavouritesProvider } from "../../lib/favourites";
import { BetSlipProvider } from "../../lib/betSlip";
import { PoppedGameProvider } from "../../lib/poppedGame";
import PoppedGame from "../casino/PoppedGame";
import { useSession } from "../../lib/sessionContext";
import "./AppShell.css";

/**
 * Page shell — reference `CasinoLayout`: the rail on the left, and a
 * "magic-container" column carrying the sticky header, the scrolling page
 * content, the footer and the mobile navigation. The container's state class
 * tells the reference stylesheet how wide the content column is.
 */
export default function AppShell({ children }) {
  // The session wraps the shell rather than sitting inside it, so the header,
  // the auth modal and anything a page renders all read one source.
  return (
    <SessionProvider>
      {/* Inside the session and outside the shell: every game tile reads the
          starred set, and it is one read for the app rather than one per tile. */}
      <FavouritesProvider>
        {/* Outside the shell's page slot on purpose: a popped-out game keeps
            running while the player browses, so its dock must outlive the page
            they popped it from. */}
        {/* Above the shell because BOTH ends of the slip live in it: the
            header's bet-slip button reads the count, the rail reads the legs,
            and every odds button on every sports page asks it whether its own
            price is picked. */}
        <BetSlipProvider>
          <PoppedGameProvider>
            <Shell>{children}</Shell>
            <PoppedGame />
          </PoppedGameProvider>
        </BetSlipProvider>
      </FavouritesProvider>
    </SessionProvider>
  );
}

function Shell({ children }) {
  const { signedIn, logout } = useSession();
  // The reference opens the rail by default only on wide desktops (≥1140px).
  const [railExpanded, setRailExpanded] = useState(() => typeof window === "undefined" || window.innerWidth >= 1140);
  const [menuOpen, setMenuOpen] = useState(false);
  const path = usePath();
  const search = useSearch();

  useEffect(() => {
    captureReferralFromSearch(search);
  }, [search]);
  const [navState, setNav] = useState(null);
  // Promotion articles that are not pinned in the rail still light up the Promotions group.
  // The sportsbook sections (Upcoming, Bet Live) live on `/sports` behind a query string.
  // The category chips append `?sport=...`, which is not a rail destination, so the
  // lookup keeps the section only.
  const sectionParam = new URLSearchParams(search).get("section");
  const nav = navIdForPath(sectionParam ? `${path}?section=${sectionParam}` : path) || navIdForPath(path) || (/^\/(sports\/)?promotions\//.test(path) ? "promotions" : /^\/shuffle-wise\//.test(path) ? "shuffle-wise" : /^\/affiliate\//.test(path) ? "affiliate" : /^\/casino\/providers\//.test(path) ? "providers" : navState) || "home";
  // The reference trims the rail to the site-wide links on non-casino routes and clears the product tab.
  // Site-wide (non-casino) routes: lottery, VIP, blog, affiliate and the account
  // pages (transactions, settings, Shuffle Wise); the sportsbook gets its own rail.
  const isSports = /^\/sports(\/|$)/.test(path);
  const navVariant = isSports ? "sports" : /^\/(lottery|vip-program|affiliate|blog|transactions|settings|shuffle-wise)(\/|$)/.test(path) ? "minimal" : "casino";
  const product = isSports ? "sports" : "casino";
  const setProduct = (p) => navigate(p === "sports" ? "/sports" : "/");
  const [auth, setAuth] = useState(null); // null | "login" | "register"
  const [raceOpen, setRaceOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [redeemCodeOpen, setRedeemCodeOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  /**
   * The right rail. Both panels stay mounted so their close animates as well as
   * their open; these flags only move one in and out of the layout.
   *
   * ONE DOCK, so they are mutually exclusive — `right-side-opened-only` and
   * `both-side-opened` describe a content column with ONE panel beside it, and
   * two asides docked at once would push the column to a width no breakpoint
   * on the site has a rule for. Opening either closes the other, which is also
   * what the reference does.
   */
  const [rightRail, setRightRail] = useState(null); // null | "notifications" | "bet-slip" | "vip"
  const notificationsOpen = rightRail === "notifications";
  const betSlipOpen = rightRail === "bet-slip";
  const vipOpen = rightRail === "vip";
  const rightRailOpen = rightRail !== null;
  const [notificationFilter, setNotificationFilter] = useState("ALL");
  // Stable identity: the modals key effects off their close handler.
  const closeWallet = useCallback(() => setWalletOpen(false), []);
  const closeVault = useCallback(() => setVaultOpen(false), []);

  useEffect(() => {
    const floating = (railExpanded && window.innerWidth < 1140 && window.innerWidth >= 768) || (menuOpen && window.innerWidth < 768);
    document.body.style.overflow = floating ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [railExpanded, menuOpen]);

  // Static pages (VIP, affiliate) open the auth modal through a window event.
  // A signed-in visitor has nothing to sign in to, so the event is ignored.
  useEffect(() => {
    const onAuth = (e) => {
      if (signedIn) return;
      setAuth(e.detail || "register");
    };
    const onRace = () => setRaceOpen(true);
    // The wallet is opened from three places — the header button, the rail's
    // Profile group and the account menu — so it travels as an event rather
    // than a callback threaded through all three.
    const onWallet = () => { if (signedIn) setWalletOpen(true); };
    // The vault is opened from the rail's Profile group and the account menu.
    const onVault = () => { if (signedIn) setVaultOpen(true); };
    const onRedeemCode = () => { if (signedIn) setRedeemCodeOpen(true); };
    const onNotifications = () => {
      if (signedIn) setRightRail((current) => (current === "notifications" ? null : "notifications"));
    };
    /**
     * The bet slip is NOT gated on a session. A visitor builds a slip first and
     * signs in to place it — gating the panel would mean the odds buttons had
     * somewhere to put a pick that could not be opened.
     */
    const onBetSlip = () => setRightRail((current) => (current === "bet-slip" ? null : "bet-slip"));
    /** Signed out too: the panel's own pitch is what asks for an account. */
    const onVip = () => setRightRail((current) => (current === "vip" ? null : "vip"));
    const onLogout = () => { if (signedIn) setLogoutOpen(true); };
    window.addEventListener("shuffle:auth", onAuth);
    window.addEventListener("shuffle:weekly-race", onRace);
    window.addEventListener("shuffle:wallet", onWallet);
    window.addEventListener("shuffle:vault", onVault);
    window.addEventListener("shuffle:redeem-code", onRedeemCode);
    window.addEventListener("shuffle:notifications", onNotifications);
    window.addEventListener("shuffle:bet-slip", onBetSlip);
    window.addEventListener("shuffle:vip", onVip);
    window.addEventListener("shuffle:logout", onLogout);
    return () => {
      window.removeEventListener("shuffle:auth", onAuth);
      window.removeEventListener("shuffle:weekly-race", onRace);
      window.removeEventListener("shuffle:wallet", onWallet);
      window.removeEventListener("shuffle:vault", onVault);
      window.removeEventListener("shuffle:redeem-code", onRedeemCode);
      window.removeEventListener("shuffle:notifications", onNotifications);
      window.removeEventListener("shuffle:bet-slip", onBetSlip);
      window.removeEventListener("shuffle:vip", onVip);
      window.removeEventListener("shuffle:logout", onLogout);
    };
  }, [signedIn]);


  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setRailExpanded(false);
      setMenuOpen(false);
      setRightRail(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let wide = window.innerWidth >= 1140;
    const onResize = () => {
      const nowWide = window.innerWidth >= 1140;
      if (nowWide !== wide) {
        wide = nowWide;
        setRailExpanded(nowWide);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const selectNav = (id, action, href) => {
    setNav(id);
    setMenuOpen(false);
    // The rail's Profile → Wallet opens the modal rather than navigating; the
    // reference does the same, and there is no /wallet page on either site.
    if (id === "profile-wallet") {
      setWalletOpen(true);
      if (window.innerWidth < 1140) setRailExpanded(false);
      return;
    }
    // The rail's Profile → Vault opens the modal rather than navigating.
    if (id === "profile-vault") {
      setVaultOpen(true);
      if (window.innerWidth < 1140) setRailExpanded(false);
      return;
    }
    // The pinned weekly race opens its dialog rather than navigating, as on the reference.
    if (id === "promo-race") {
      setRaceOpen(true);
      if (window.innerWidth < 1140) setRailExpanded(false);
      return;
    }
    // Only navigate using routes[id] if NavLink didn't already handle it (e.g., if it was a button without a specific href).
    if (!href && routes[id]) navigate(routes[id]);
    if (window.innerWidth < 1140) setRailExpanded(false);
  };

  return (
    <div className="CasinoLayout_root">
      <Sidebar
        expanded={railExpanded}
        active={nav}
        product={navVariant === "minimal" ? null : product}
        onProductChange={setProduct}
        onToggle={() => setRailExpanded((o) => !o)}
        onSelect={selectNav}
        onClose={() => setRailExpanded(false)}
        variant={navVariant}
      />

      {/*
        The state class is what every rail-aware breakpoint on the site reads,
        so it has to name BOTH rails: the content column is a different width
        with the notification panel docked, and the tables, hero grids and
        filter rows all re-flow off this one word.
      */}
      <main className={`CasinoLayout_pageContentWrapper magic-container ${
        railExpanded
          ? rightRailOpen ? "both-side-opened" : "left-side-opened-only"
          : rightRailOpen ? "right-side-opened-only" : "no-side-opened"
      }`}>
        <TopBar onAuth={setAuth} />
        <div id="pageContent" className="CasinoLayout_pageContent">
          <div className="CasinoLayout_mainContent">
            <PageLoader>{children}</PageLoader>
          </div>
          <Footer />
        </div>

        {/* Floating live-support launcher (desktop only, as in the reference) */}
        <div className="LiveChat_supportButtonWrapper">
          <button className="ButtonVariants_root ButtonVariants_buttonHeightLarge ButtonVariants_primaryRound ButtonVariants_hasIcon" type="button" aria-label="Live support">
            <span className="ButtonVariants_buttonContent">
              <span className="ButtonIcon_root">
                <img alt="headphone" src="/icons/headphone.svg" />
              </span>
            </span>
          </button>
        </div>

        <MobileNav
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((o) => !o)}
          active={nav}
          onSelect={selectNav}
          product={navVariant === "minimal" ? null : product}
          onProductChange={setProduct}
          variant={navVariant}
        />
      </main>

      {/*
        A flex sibling of the page column, not an overlay — see
        `NotificationPanel` for why that is what makes it slide. Signed out
        there is nothing to show, so it is not rendered at all.
      */}
      {signedIn && (
        <NotificationPanel
          open={notificationsOpen}
          filter={notificationFilter}
          onFilterChange={setNotificationFilter}
          onClose={() => setRightRail(null)}
        />
      )}

      {/*
        Rendered signed out as well, unlike the notification panel: a visitor
        can fill a slip and is asked for an account at the point of placing it,
        not at the point of picking. Same dock, and the two never open together.
      */}
      <BetSlipPanel open={betSlipOpen} onClose={() => setRightRail(null)} />

      {/* Also rendered signed out — where it pitches the programme instead of
          reporting a rank. Same dock; the three never open together. */}
      <VipPanel open={vipOpen} onClose={() => setRightRail(null)} />

      {/* A session arriving while the modal is open — restored from storage, or
          signed in on another tab — makes it redundant. Derived rather than
          closed from an effect, so there is no render where a login form sits
          over a signed-in page. */}
      {auth !== null && !signedIn && <AuthModal tab={auth} onTabChange={setAuth} onClose={() => setAuth(null)} />}
      {raceOpen && <WeeklyRaceModal onClose={() => setRaceOpen(false)} />}
      {walletOpen && signedIn && <WalletModal onClose={closeWallet} />}
      {vaultOpen && signedIn && <VaultModal onClose={closeVault} />}
      {redeemCodeOpen && signedIn && <RedeemCodeModal onClose={() => setRedeemCodeOpen(false)} />}
      {logoutOpen && signedIn && <LogoutModal onClose={() => setLogoutOpen(false)} onConfirm={logout} />}

      {/* Last, and outside every modal: the toast stack is `position: fixed`
          above `--z-mobile-modal`, so a message raised by a dialog is still
          readable while that dialog is closing. */}
      <Alerts />
    </div>
  );
}
