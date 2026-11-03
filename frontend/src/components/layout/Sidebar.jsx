import NavContent, { SearchButton } from "./NavContent";
import { cx } from "../../lib/carousel";
import "./Sidebar.css";
import { useBrandExtras } from "../../lib/siteContent";
import { useGate } from "../../lib/gates";

/**
 * Desktop navigation rail — a 1:1 port of the reference DesktopNavigation
 * module. Hidden below 768px, where MobileNav takes over.
 */

export function ProductTabs({ expanded, product, onProductChange }) {
  // The owner's name for the sports tab (owner panel → Branding → Sportsbook).
  const sportsLabel = useBrandExtras()?.sportsbook?.tabName || "Sports";
  const on = useGate();
  if (expanded) {
    return (
      <div className="NavigationTab_root DesktopNavigation_showTabs">
        <div className="NavigationTab_container">
          {[
            ["casino", "Casino", "/"],
            ["sports", sportsLabel, "/sports?section=featured"],
          ].filter(([key]) => on(key)).map(([key, label, href]) => (
            <a
              key={key}
              className={product === key ? "NavigationTab_active" : ""}
              href={href}
              onClick={(e) => { e.preventDefault(); onProductChange(key); }}
            >
              <span>{label}</span>
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="NavigationTab_mobileContainer">
      {on("casino") && <a className={product === "casino" ? "NavigationTab_active" : ""} href="/" onClick={(e) => { e.preventDefault(); onProductChange("casino"); }}>
        <img alt="casino" src="/icons/dice.svg" />
      </a>}
      {on("sports") && <a className={product === "sports" ? "NavigationTab_active" : ""} href="/sports?section=featured" onClick={(e) => { e.preventDefault(); onProductChange("sports"); }}>
        <img alt={sportsLabel} src="/icons/sports/tennis.svg" />
      </a>}
    </div>
  );
}

export default function Sidebar({ expanded, active, product, onProductChange, onToggle, onSelect, onClose, variant }) {
  const on = useGate();
  return (
    <>
      <button type="button" className={cx("rail-scrim", expanded && "is-visible")} onClick={onClose} tabIndex={-1} aria-hidden="true" />

      <nav className={cx("DesktopNavigation_root DesktopNavigation_sidebar", expanded && "DesktopNavigation_isExpanded")} aria-label="Main navigation">
        <div className="DesktopNavigation_sidebarHeader">
          <button aria-label="Toggle menu" className="DesktopNavigation_menu" type="button" onClick={onToggle} aria-expanded={expanded}>
            <img alt="menu" height="16" src="/icons/menu.svg" width="19" />
          </button>
          {expanded ? (
            <ProductTabs expanded product={product} onProductChange={onProductChange} />
          ) : (
            <div className="NavigationTab_mobileContainer DesktopNavigation_hideTabs" aria-hidden="true">
              {on("casino") && <a className={product === "casino" ? "NavigationTab_active" : ""} href="/" tabIndex={-1}>
                <img alt="" src="/icons/dice.svg" />
              </a>}
              {on("sports") && <a className={product === "sports" ? "NavigationTab_active" : ""} href="/sports" tabIndex={-1}>
                <img alt="" src="/icons/sports/tennis.svg" />
              </a>}
            </div>
          )}
        </div>

        {!expanded && (
          <div>
            <div className="NavigationContent_navigationTabsContainer">
              <ProductTabs expanded={false} product={product} onProductChange={onProductChange} />
            </div>
          </div>
        )}

        <div>
          <SearchButton expanded={expanded} onOpen={() => { if (window.innerWidth < 1140) onClose(); }} />
        </div>

        <NavContent expanded={expanded} active={active} onSelect={onSelect} variant={variant} />
      </nav>
    </>
  );
}
