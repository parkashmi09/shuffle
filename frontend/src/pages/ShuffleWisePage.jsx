import { cx } from "../lib/carousel";
import { navigate, usePath } from "../lib/router";
import SelfExclusion from "../components/shufflewise/SelfExclusion";
import GamblingLimits from "../components/shufflewise/GamblingLimits";

/**
 * `/shuffle-wise/*` — reference `pages/shuffle-wise/[tab]`.
 *
 * The site's responsible-gambling screen: a break from betting, and a cap on
 * what can be lost or staked in a period. Two tabs behind the same shell the
 * settings and transactions pages use, except that the tab strip here carries
 * `ShuffleWise_tabView` (which shrinks it to its content) and the section
 * carries `ShuffleWise_container`.
 *
 * Each tab renders `ShuffleWiseLayoutWithSupport_root`: the panel, and the Need
 * Help card beside it once the column is wide enough.
 *
 * There is no `/shuffle-wise` — the reference's own links all point at
 * `/shuffle-wise/self-exclusion`, and `App.jsx` redirects the bare path there.
 */

const TABS = [
  { id: "self-exclusion", label: "Self-exclusion", View: SelfExclusion },
  { id: "gambling-limits", label: "Gambling Limits", View: GamblingLimits },
];

export default function ShuffleWisePage() {
  const path = usePath();
  const active = TABS.find((t) => path === `/shuffle-wise/${t.id}`) || TABS[0];
  const View = active.View;

  return (
    <section className="LayoutContainer_root ShuffleWise_container LayoutContainer_mobile-top-lg2 LayoutContainer_column">
      <h2 className="Heading_root Heading_h2 TitlePage_root">Shuffle Wise</h2>

      <div className="ScrollableTab_root">
        <div className="Tab_root ShuffleWise_tabView">
          <div className="Tab_tabsContainer" role="tablist">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={tab.id === active.id}
                className={cx("Tab_tab", tab.id === active.id && "Tab_active")}
                disabled={tab.id === active.id}
                data-testid={tab.id}
                id={tab.id}
                value={tab.id}
                onClick={() => navigate(`/shuffle-wise/${tab.id}`)}
              >
                <p className="Tab_text">{tab.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <View />
    </section>
  );
}
