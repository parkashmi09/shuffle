import { cx } from "../lib/carousel";
import { navigate, usePath } from "../lib/router";
import SettingsAccount from "../components/settings/SettingsAccount";
import SettingsVerify from "../components/settings/SettingsVerify";
import SettingsSecurity from "../components/settings/SettingsSecurity";
import SettingsPreferences from "../components/settings/SettingsPreferences";
import SettingsSessions from "../components/settings/SettingsSessions";
import SettingsIgnoredUsers from "../components/settings/SettingsIgnoredUsers";

/**
 * `/settings/*` — reference `pages/settings/[tab]`.
 *
 * Six tabs behind one shell: the title, a `ScrollableTab` strip (the same
 * `Tab_*` the transactions and affiliate pages use, wrapped so it scrolls
 * sideways rather than wrapping on a narrow column), and the tab's own panels
 * below.
 *
 * The tab is the URL. `/settings` redirects to `/settings/account`, which is
 * what the live site does — the bare path never renders anything of its own.
 */

const TABS = [
  { id: "account", label: "Account", View: SettingsAccount },
  { id: "verify", label: "Verify", View: SettingsVerify },
  { id: "security", label: "Security", View: SettingsSecurity },
  { id: "preferences", label: "Preferences", View: SettingsPreferences },
  { id: "sessions", label: "Sessions", View: SettingsSessions },
  { id: "ignored-users", label: "Ignored Users", View: SettingsIgnoredUsers },
];

export default function SettingsPage() {
  const path = usePath();
  const active = TABS.find((t) => path === `/settings/${t.id}`) || TABS[0];
  const View = active.View;

  return (
    <section className="LayoutContainer_root Settings_settingsViewContainer LayoutContainer_mobile-top-lg2 LayoutContainer_mobile-bottom-lg2 LayoutContainer_column">
      <h2 className="Heading_root Heading_h2 TitlePage_root">Settings</h2>

      <div className="Settings_settingsViewTabsWrapper">
        <div className="ScrollableTab_root">
          <div className="Tab_root">
            <div className="Tab_tabsContainer" role="tablist">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={tab.id === active.id}
                  className={cx("Tab_tab", tab.id === active.id && "Tab_active")}
                  disabled={tab.id === active.id}
                  value={tab.id}
                  onClick={() => navigate(`/settings/${tab.id}`)}
                >
                  <p className="Tab_text">{tab.label}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <View />
    </section>
  );
}
