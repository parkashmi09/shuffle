import { useCallback, useMemo, useState } from "react";
import { useSession } from "../../lib/sessionContext";
import { useApi } from "../../lib/useResource";
import { preferences as preferencesApi } from "../../lib/endpoints";
import { FIAT_CODES } from "../../lib/currencies";
import { PREF_DEFAULTS, readStoredPreferences, writeStoredPreferences } from "../../lib/playerPreferences";
import WalletSelect from "../wallet/CurrencySelect";
import Switch from "./Switch";

/**
 * Settings → Preferences — reference `Preferences`.
 *
 * One panel of rows, each a switch with a heading and a description, two of
 * them carrying a select as well. `Preferences_preferenceSwitchList` draws the
 * hairline between them from its own `:not(:last-child)` rule, so the rows need
 * no separator markup.
 *
 * ── WHAT ACTUALLY WORKS ──────────────────────────────────────────────────
 *
 * | Control                    | Store                         | Effect                                      |
 * |----------------------------|-------------------------------|---------------------------------------------|
 * | Fiat View + currency       | session / localStorage        | Header & wallet show fiat or coin amounts   |
 * | Email marketing            | `PATCH /user/preferences`     | `emailNotifications` column                 |
 * | Promotion Notifications    | `PATCH /user/preferences`     | `pushNotifications` column                  |
 * | Streamer Mode              | `hideBalance` on server       | Masks balances in header & wallet pickers   |
 * | Hide zero balances         | localStorage + session        | Filters zero rows in header & wallet lists  |
 * | Odds Preference            | localStorage only             | Sportsbook is still capture — format unused |
 * | Private Mode               | localStorage only             | No "hide my stats" column on the backend    |
 */

const ODDS = [
  { value: "decimal", label: "Decimal" },
  { value: "fractional", label: "Fractional" },
  { value: "american", label: "American" },
];

/** Which switch maps to which column on `/user/preferences`. */
const SERVER_FIELDS = {
  emailMarketing: "emailNotifications",
  promotionNotifications: "pushNotifications",
  streamerMode: "hideBalance",
};

/** A heading, its description, and the switch that owns them. */
function SwitchRow({ checked, onChange, heading, description, disabled = false }) {
  return (
    <div className="Flex_root Flex_lg1" style={{ alignItems: "center" }}>
      <Switch checked={checked} onChange={onChange} disabled={disabled} className="SwitchGroup_switch" />
      <div className="SwitchGroup_switchLabelDesc" style={{ opacity: disabled ? 0.6 : 1 }}>
        <h5 className="Heading_root Heading_h5 SwitchGroup_heading">{heading}</h5>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function SettingsPreferences() {
  const {
    displayCurrency,
    setDisplayCurrency,
    fiatView,
    setFiatView,
    hideZeroBalances,
    setHideZeroBalances,
    hideBalance,
    setHideBalance,
  } = useSession();

  const [local, setLocal] = useState(readStoredPreferences);
  // Which server-backed switches this visit has already changed. Until one is
  // touched the server's value is the truth; after, the local one is, because
  // `stored` is the answer from before the write.
  const [touched, setTouched] = useState(() => []);
  const { data: stored } = useApi("settings:preferences", () => preferencesApi.get().catch(() => null));

  const prefs = useMemo(() => {
    const merged = { ...PREF_DEFAULTS, ...local, fiatView, hideZeroBalances, streamerMode: hideBalance };
    if (!stored) return merged;
    for (const [key, field] of Object.entries(SERVER_FIELDS)) {
      if (key === "streamerMode") {
        if (!touched.includes(key)) merged.streamerMode = Boolean(stored[field]);
        continue;
      }
      if (!touched.includes(key)) merged[key] = Boolean(stored[field]);
    }
    return merged;
  }, [local, stored, touched, fiatView, hideZeroBalances, hideBalance]);

  const save = useCallback(
    (patch) => {
      const body = {};
      for (const [key, field] of Object.entries(SERVER_FIELDS)) {
        if (key in patch) body[field] = patch[key];
      }
      const server = Object.keys(SERVER_FIELDS).filter((key) => key in patch);
      if (server.length) {
        setTouched((current) => [...new Set([...current, ...server])]);
        preferencesApi.update(body).catch(() => {});
      }

      if ("streamerMode" in patch) setHideBalance(Boolean(patch.streamerMode));
      if ("fiatView" in patch) setFiatView(Boolean(patch.fiatView));
      if ("hideZeroBalances" in patch) setHideZeroBalances(Boolean(patch.hideZeroBalances));

      setLocal((current) => {
        const next = writeStoredPreferences({ ...current, ...patch });
        return next;
      });
    },
    [setFiatView, setHideZeroBalances, setHideBalance]
  );

  const fiatOptions = useMemo(
    () => FIAT_CODES.map((code) => ({ value: code, label: code, icon: code })),
    []
  );

  return (
    <div className="Preferences_root">
      <form className="Panel_panelWrapper" onSubmit={(event) => event.preventDefault()}>
        <h2 className="Panel_panelHeading">Preferences</h2>
        <div className="Preferences_preferenceSwitchList">
          <div className="FiatPreference_fiatPreferenceWrapper">
            <div className="Flex_root Flex_lg1" style={{ alignItems: "center" }}>
              <Switch
                checked={prefs.fiatView}
                onChange={(on) => save({ fiatView: on })}
                className="SwitchGroup_switch"
              />
              <div className="SwitchGroup_switchLabelDesc" style={{ opacity: 1 }}>
                <h5 className="Heading_root Heading_h5 SwitchGroup_heading">Fiat View</h5>
                <p>Balances will be displayed in your selected currency</p>
              </div>
            </div>
            <div
              className="FiatPreference_fiatPreferenceSelectWrapper"
              style={{ opacity: prefs.fiatView ? 1 : 0.5, pointerEvents: prefs.fiatView ? "auto" : "none" }}
            >
              <WalletSelect
                options={fiatOptions}
                value={displayCurrency}
                onChange={setDisplayCurrency}
                disabled={!prefs.fiatView}
              />
            </div>
          </div>

          <div className="ReferenceContainer_root">
            <div className="ReferenceContainer_content">
              <h5 className="Heading_root Heading_h5 Preferences_heading">Odds Preference</h5>
              <p>Odds for sports betting will be displayed in this format</p>
            </div>
            <div className="ReferenceContainer_actionContainer">
              <WalletSelect
                variant="plain"
                options={ODDS}
                value={prefs.odds}
                onChange={(odds) => save({ odds })}
              />
            </div>
          </div>

          <SwitchRow
            checked={prefs.privateMode}
            onChange={(privateMode) => save({ privateMode })}
            heading="Private Mode"
            description="Other users won't be able to view your wins, losses and wagered statistics"
          />

          <SwitchRow
            checked={prefs.emailMarketing}
            onChange={(emailMarketing) => save({ emailMarketing })}
            heading="Email marketing"
            description="Receive notifications for offers and promotions. Critical information regarding your account will always be sent"
          />

          <SwitchRow
            checked={prefs.promotionNotifications}
            onChange={(promotionNotifications) => save({ promotionNotifications })}
            heading="Promotion Notifications"
            description="You will receive promotional notifications updating you of the latest promotions, events and more! "
          />

          <div className="ReferenceContainer_root">
            <div className="ReferenceContainer_content">
              <SwitchRow
                checked={prefs.streamerMode}
                onChange={(streamerMode) => save({ streamerMode })}
                heading="Streamer Mode"
                description="Sensitive information will not be displayed"
              />
            </div>
            <div className="ReferenceContainer_actionContainer" />
          </div>

          <div className="ReferenceContainer_root">
            <div className="ReferenceContainer_content">
              <SwitchRow
                checked={prefs.hideZeroBalances}
                onChange={(on) => save({ hideZeroBalances: on })}
                heading="Hide zero balances"
                description="Wallets with zero balance are hidden from view"
              />
            </div>
            <div className="ReferenceContainer_actionContainer" />
          </div>
        </div>
      </form>
    </div>
  );
}
