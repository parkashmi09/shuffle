import { cx } from "../../lib/carousel";
import { useCategoryOn } from "../../lib/catalogue";

const tabs = [
  { id: "LOBBY", label: "Lobby", icon: "/icons/home.svg" },
  { id: "ORIGINALS", slug: "originals", label: "Originals", icon: "/icons/original.svg" },
  { id: "SLOTS", slug: "slots", label: "Slots", icon: "/icons/slots.svg" },
  { id: "LIVE_CASINO", slug: "live-casino", label: "Live Casino", icon: "/icons/casino.svg" },
  { id: "TABLE_GAMES", slug: "table-games", label: "Table Games", icon: "/icons/table-games.svg" },
];

/** Category tab strip + search box — reference `Home_wrapper`. */
export default function CategoryTabs({ active, onChange, query = "", onQuery }) {
  const categoryOn = useCategoryOn();
  return (
    <section className="LayoutContainer_root LayoutContainer_mobile-top-sm1 LayoutContainer_mobile-bottom-lg1 LayoutContainer_column">
      <div className="Home_wrapper">
        <div className="Tab_root">
          <div className="Tab_tabsContainer" role="tablist">
            {tabs.filter((t) => !t.slug || categoryOn(t.slug)).map((t) => (
              <button
                key={t.id}
                aria-selected={active === t.id}
                className={cx("Tab_tab", active === t.id && "Tab_active")}
                disabled={active === t.id}
                id={t.id}
                role="tab"
                type="button"
                value={t.id}
                onClick={() => onChange(t.id)}
              >
                <span className="Tab_icon">
                  <img alt={t.label} height="16" src={t.icon} width="16" />
                </span>
                <p className="Tab_text">{t.label}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="Home_homeTabSectionSearch">
          <div className="TextInput_formControlWrapper">
            <div className="InputWrapper_root">
              <span className="TextInput_inputPrefix">
                <img alt="search" src="/icons/search.svg" />
              </span>
              <input className="Input_root Input_hasPrefix" placeholder="Search" aria-label="Search games" value={query} onChange={(e) => onQuery?.(e.target.value)} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
