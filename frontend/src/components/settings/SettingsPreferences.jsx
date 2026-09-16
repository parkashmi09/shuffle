import { useCallback, useMemo, useState } from "react";
import { useSession } from "../../lib/sessionContext";
import { useApi } from "../../lib/useResource";
import { preferences as preferencesApi } from "../../lib/endpoints";
import { FIAT_CODES } from "../../lib/currencies";
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
 * ── WHERE THESE LIVE ─────────────────────────────────────────────────────
 *
 * Fiat View and its currency are the session's own `displayCurrency`, which the
 * header already reads and which already persists — turning the switch off
 * shows balances in the coin's own amount, which is exactly what the reference
 * describes.
 *
 * Three of the switches have a column: the user service's `preferences` module
 * (`GET/PATCH /user/preferences`, the old `userconfig` table) stores
 * `emailNotifications`, `pushNotifications` and `hideBalance`, so Email
 * marketing, Promotion Notifications and Streamer Mode are saved on the server
 * and follow the player to another browser. `hideBalance` is the nearest column
 * to Streamer Mode — both hide figures that should not be on a stream — and is
 * used as such rather than left unwired.
 *
 * Private Mode, Odds Preference and Hide zero balances have no column and no
 * route. They stay in `localStorage` under one key, which at least makes them
 * survive a reload. They are real settings with a local store, not fake ones —
 * and the moment a field exists, `save` is the only thing that changes.
 */

const STORE_KEY = "shuffle.preferences";

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

const DEFAULTS = {
  odds: "decimal",
  privateMode: false,
  emailMarketing: true,
  promotionNotifications: true,
  streamerMode: false,
  hideZeroBalances: false,
};

function read() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") };
  } catch {
    // A locked-down browser throws rather than answering null.
    return { ...DEFAULTS };
  }
}

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
  const { displayCurrency, setDisplayCurrency } = useSession();
  const [local, setLocal] = useState(read);
  // Which server-backed switches this visit has already changed. Until one is
  // touched the server's value is the truth; after, the local one is, because
  // `stored` is the answer from before the write.
  const [touched, setTouched] = useState(() => []);
  const { data: stored } = useApi("settings:preferences", () => preferencesApi.get().catch(() => null));

  const prefs = useMemo(() => {
    if (!stored) return local;
    const merged = { ...local };
    for (const [key, field] of Object.entries(SERVER_FIELDS)) {
      if (!touched.includes(key)) merged[key] = Boolean(stored[field]);
    }
    return merged;
  }, [local, stored, touched]);

  const save = useCallback((patch) => {
    // A switch with a column goes to the server; the rest only have the
    // browser. Both paths update the same object, so the UI does not care.
    const body = {};
    for (const [key, field] of Object.entries(SERVER_FIELDS)) {
      if (key in patch) body[field] = patch[key];
    }
    const server = Object.keys(SERVER_FIELDS).filter((key) => key in patch);
    if (server.length) {
      setTouched((current) => [...new Set([...current, ...server])]);
      // Nothing to show if it fails — the next read corrects the switch.
      preferencesApi.update(body).catch(() => {});
    }
    setLocal((current) => {
      const next = { ...current, ...patch };
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch {
        // Nothing to do — the toggle still works for this session.
      }
      return next;
    });
  }, []);

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
              <Switch checked onChange={() => {}} className="SwitchGroup_switch" />
              <div className="SwitchGroup_switchLabelDesc" style={{ opacity: 1 }}>
                <h5 className="Heading_root Heading_h5 SwitchGroup_heading">Fiat View</h5>
                <p>Balances will be displayed in your selected currency</p>
              </div>
            </div>
            <div className="FiatPreference_fiatPreferenceSelectWrapper">
              <WalletSelect options={fiatOptions} value={displayCurrency} onChange={setDisplayCurrency} />
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

          {/* Disabled on the live page too — it only has meaning once the wallet
              list it filters is on screen. */}
          <div className="ReferenceContainer_root">
            <div className="ReferenceContainer_content">
              <SwitchRow
                disabled
                checked={prefs.hideZeroBalances}
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
