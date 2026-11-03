import NavContent, { SearchButton } from "./NavContent";
import { openSearch } from "../../lib/router";
import { cx } from "../../lib/carousel";
import { ProductTabs } from "./Sidebar";
import { openExternal, useBrandExtras, useSupportHref } from "../../lib/siteContent";
import { useGate } from "../../lib/gates";

const items = [
  { id: "menu", label: "Menu", icon: "menu", button: true },
  { id: "search", label: "Search", icon: "search", button: true },
  { id: "chat", label: "Chat", icon: "chat", button: true },
  { id: "rewards", label: "Rewards", icon: "rewards", href: "/vip-program" },
  { id: "sports", label: "Sports", icon: "sport", href: "/sports" },
];

/**
 * Mobile navigation — reference `MobileNavigation` bottom bar plus the
 * `MobileNavigationBar` slide-up menu panel. Both are hidden from 768px up.
 */
export default function MobileNav({ menuOpen, onToggleMenu, active, onSelect, product, onProductChange, variant }) {
  const closeMenu = menuOpen ? onToggleMenu : undefined;
  const sportsLabel = useBrandExtras()?.sportsbook?.tabName;
  const on = useGate();
  const supportHref = useSupportHref();
  // Rewards is the VIP programme: gone for an agent's player (and when the owner/admin turns VIP off).
  const shown = items.filter((it) => (it.id !== "rewards" || on("vip")) && (it.id !== "sports" || on("sports"))).map((it) => (it.id === "sports" && sportsLabel ? { ...it, label: sportsLabel } : it));
  const searchFromBar = () => { openSearch(); closeMenu?.(); };
  const item = (it) => {
    const body = (
      <div className="MobileNavItemContent_mobileNavItemWrapper" style={{ color: "#FFFFFF", opacity: 1 }}>
        <span className="MobileNavItemContent_mobileNavIcon">
          <img src={`/icons/${it.icon}.svg`} alt={it.label.toLowerCase()} />
        </span>
        <span className="MobileNavItemContent_mobileNavText">{it.label}</span>
      </div>
    );
    return it.button ? (
      <button
        className="MobileNavItem_button"
        type="button"
        disabled={it.id === "chat" && !supportHref}
        onClick={it.id === "menu" ? onToggleMenu : it.id === "search" ? searchFromBar : () => openExternal(supportHref)}
      >
        {body}
      </button>
    ) : (
      <a href={it.href} onClick={(e) => { e.preventDefault(); onSelect(it.id); }}>
        {body}
      </a>
    );
  };

  return (
    <>
      <div className={cx("MobileNavigationBar_container", menuOpen && "MobileNavigationBar_active")}>
        <div className="MobileNavigationBar_root">
          <div className="NavigationContent_navTabList NavigationContent_mobileOnly NavigationContent_navTabListExpanded">
            <div className="NavigationContent_mobileNavigationTabsContainer">
              <ProductTabs expanded product={product} onProductChange={onProductChange} />
            </div>
          </div>
          <div>
            <SearchButton expanded onOpen={closeMenu} />
          </div>
          <NavContent expanded active={active} onSelect={onSelect} mobile variant={variant} />
        </div>
      </div>

      <div className="MobileNavigation_root">
        {shown.map((it) => (
          <div key={it.id}>{item(it)}</div>
        ))}
      </div>
    </>
  );
}
