import { useEffect, useState } from "react";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import Footer from "./Footer";
import PageLoader from "./PageLoader";
import AuthModal from "../auth/AuthModal";
import WeeklyRaceModal from "../casino/WeeklyRaceModal";
import { navIdForPath, navigate, routes, usePath, useSearch } from "../../lib/router";
import "./AppShell.css";

/**
 * Page shell — reference `CasinoLayout`: the rail on the left, and a
 * "magic-container" column carrying the sticky header, the scrolling page
 * content, the footer and the mobile navigation. The container's state class
 * tells the reference stylesheet how wide the content column is.
 */
export default function AppShell({ children }) {
  // The reference opens the rail by default only on wide desktops (≥1140px).
  const [railExpanded, setRailExpanded] = useState(() => typeof window === "undefined" || window.innerWidth >= 1140);
  const [menuOpen, setMenuOpen] = useState(false);
  const path = usePath();
  const search = useSearch();
  const [navState, setNav] = useState(null);
  // Promotion articles that are not pinned in the rail still light up the Promotions group.
  // The sportsbook sections (Upcoming, Bet Live) live on `/sports` behind a query string.
  // The category chips append `?sport=...`, which is not a rail destination, so the
  // lookup keeps the section only.
  const sectionParam = new URLSearchParams(search).get("section");
  const nav = navIdForPath(sectionParam ? `${path}?section=${sectionParam}` : path) || navIdForPath(path) || (/^\/(sports\/)?promotions\//.test(path) ? "promotions" : navState) || "home";
  // The reference trims the rail to the site-wide links on non-casino routes and clears the product tab.
  // Site-wide (non-casino) routes: lottery, VIP, blog and affiliate; the sportsbook gets its own rail.
  const isSports = /^\/sports(\/|$)/.test(path);
  const navVariant = isSports ? "sports" : /^\/(lottery|vip-program|affiliate|blog)(\/|$)/.test(path) ? "minimal" : "casino";
  const product = isSports ? "sports" : "casino";
  const setProduct = (p) => navigate(p === "sports" ? "/sports" : "/");
  const [auth, setAuth] = useState(null); // null | "login" | "register"
  const [raceOpen, setRaceOpen] = useState(false);

  useEffect(() => {
    const floating = (railExpanded && window.innerWidth < 1140 && window.innerWidth >= 768) || (menuOpen && window.innerWidth < 768);
    document.body.style.overflow = floating ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [railExpanded, menuOpen]);

  // Static pages (VIP, affiliate) open the auth modal through a window event.
  useEffect(() => {
    const onAuth = (e) => setAuth(e.detail || "register");
    const onRace = () => setRaceOpen(true);
    window.addEventListener("shuffle:auth", onAuth);
    window.addEventListener("shuffle:weekly-race", onRace);
    return () => {
      window.removeEventListener("shuffle:auth", onAuth);
      window.removeEventListener("shuffle:weekly-race", onRace);
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setRailExpanded(false);
      setMenuOpen(false);
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

  const selectNav = (id) => {
    setNav(id);
    setMenuOpen(false);
    // The pinned weekly race opens its dialog rather than navigating, as on the reference.
    if (id === "promo-race") {
      setRaceOpen(true);
      if (window.innerWidth < 1140) setRailExpanded(false);
      return;
    }
    if (routes[id]) navigate(routes[id]);
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

      <main className={`CasinoLayout_pageContentWrapper magic-container ${railExpanded ? "left-side-opened-only" : "no-side-opened"}`}>
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

      {auth !== null && <AuthModal tab={auth} onTabChange={setAuth} onClose={() => setAuth(null)} />}
      {raceOpen && <WeeklyRaceModal onClose={() => setRaceOpen(false)} />}
    </div>
  );
}
