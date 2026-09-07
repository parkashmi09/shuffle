import NavContent, { SearchButton } from "./NavContent";
import { cx } from "../../lib/carousel";
import { ProductTabs } from "./Sidebar";

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
      <button className="MobileNavItem_button" type="button" onClick={it.id === "menu" ? onToggleMenu : undefined}>
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
            <SearchButton expanded />
          </div>
          <NavContent expanded active={active} onSelect={onSelect} mobile variant={variant} />
        </div>
      </div>

      <div className="MobileNavigation_root">
        {items.map((it) => (
          <div key={it.id}>{item(it)}</div>
        ))}
      </div>
    </>
  );
}
