import { useState } from "react";
import { useApi } from "../../lib/useResource";
import { useSession } from "../../lib/sessionContext";
import { profile as profileApi, vip as vipApi } from "../../lib/endpoints";
import { useGate } from "../../lib/gates";
import { tierFor } from "../vip/vipTiers";
import { CoinIcon } from "../wallet/CurrencySelect";
import { AvatarPickerModal, ChangeEmailModal } from "./ProfileEditors";
import { avatarSrc } from "../../lib/adapters";

/**
 * Settings → Account — reference `UserInfoPanel` + `StatisticsPanel`.
 *
 * One panel: the player's card on the left, three figures on the right, and
 * the address below both. `Relative_root` is what lets `VerifiedStatus_root`
 * pin its tick inside the field's right edge.
 *
 * Total Bets and Total wagered are `GET /user/profile/stats` (`bets`, `wagered.usd`); "—" until it answers.
 */
export default function SettingsAccount() {
  const { user } = useSession();
  const { data: me, reload } = useApi("settings:profile", () => profileApi.get());
  // `avatar` | `email` while one of the two editors is open (never for an agent's player: their agent keeps these).
  const [editing, setEditing] = useState(null);
  // shortcut: only this panel re-reads; the header avatar follows on the next `/auth/me` (page load). Add a session refresh if it must update live.
  const saved = reload;
  const on = useGate();
  const { data: stats } = useApi("settings:profile-stats", () => profileApi.stats(), { enabled: !on.agentPlayer });
  const wagered = stats?.wagered?.usd != null ? `$${Number(stats.wagered.usd).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
  // `GET /user/vip`; Unranked until it answers, on a failed read, or with VIP switched off.
  const { data: vip } = useApi("vip:progress", () => vipApi.progress(), { enabled: on.ready && on("vip") });
  const tier = tierFor(vip);

  const joined = me?.joinedAt ? new Date(me.joinedAt) : null;
  // `9.8.2026` — the reference writes the join date dot-separated, day first.
  const joinDate = joined ? `${joined.getDate()}.${joined.getMonth() + 1}.${joined.getFullYear()}` : "—";

  // The agent keeps an agent's player's details: their name and id, to read.
  if (on.agentPlayer) {
    return (
      <div className="Flex_root Flex_column Flex_lg3">
        <form className="Panel_panelWrapper" onSubmit={(event) => event.preventDefault()}>
          <h2 className="Panel_panelHeading">User Information</h2>
          <div className="FormControlWrapper_root">
            <label className="Label_root" htmlFor="settings-username">Username</label>
            <div className="InputWrapper_root">
              <input id="settings-username" readOnly className="Input_root Input_outline" value={me?.username || user?.name || ""} />
            </div>
          </div>
          <div className="FormControlWrapper_root">
            <label className="Label_root" htmlFor="settings-user-id">User ID</label>
            <div className="InputWrapper_root">
              <input id="settings-user-id" readOnly className="Input_root Input_outline" value={user?.id ?? ""} />
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="Flex_root Flex_column Flex_lg3">
      <form className="Panel_panelWrapper" onSubmit={(event) => event.preventDefault()}>
        <h2 className="Panel_panelHeading">User Information</h2>
        <div className="UserInfoPanel_infoWrapper">
          <div className="UserInfoPanel_userInfoCard">
            <div className="Flex_root" style={{ alignItems: "center" }}>
              <div className="UserBadgeBlock_root">
                <div className="UserBadgeBlock_avatarContainer">
                  <button type="button" className="Avatar_root Avatar_background AvatarPicker_trigger" aria-label="Change avatar" onClick={() => setEditing("avatar")}>
                    <img alt="avatar" width="40" height="40" src={avatarSrc(me?.avatar) || "/icons/user-profile.svg"} />
                  </button>
                </div>
                <div className="UserBadgeBlock_badge">
                  <h2 className="UserInfoPanel_heading">{me?.username || user?.name || "—"}</h2>
                  {on("vip") && (
                    <span className="VipBadge_root">
                      <span className="VipIcon_root">
                        <img alt="vip icon" width="16" height="16" src={tier.icon} />
                      </span>
                      <span>{tier.label}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <section className="StatisticsPanel_root">
            <div className="StatisticsPanel_statisticsInfo">
              <div className="StatisticsPanel_infoItem">
                <div className="StatisticsPanel_betValueWrapper">
                  <span className="StatisticsPanel_infoTitle">Join Date</span>
                  <span className="StatisticsPanel_infoValue">{joinDate}</span>
                </div>
              </div>
              <div className="StatisticsPanel_infoItem">
                <div className="StatisticsPanel_betValueWrapper">
                  <span className="StatisticsPanel_infoTitle">Total Bets</span>
                  <span className="StatisticsPanel_infoValue">{stats?.bets ?? "—"}</span>
                </div>
              </div>
              <div className="StatisticsPanel_infoItem">
                <div className="StatisticsPanel_betValueWrapper">
                  <span className="StatisticsPanel_infoTitle">Total wagered</span>
                  {/* USD, not the display fiat — the reference writes this one
                      figure in dollars whatever the player reads elsewhere. */}
                  <span className="StatisticsPanel_infoValue">
                    <span className="IconValue_root FormattedAmount_root">
                      <CoinIcon code="USD" />
                      {wagered}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Third cell of the same two-column grid, so it sits under the
              player's card at the card's width — not full width below both. */}
          <div className="Relative_root">
          <div className="FormControlWrapper_root">
            <label className="Label_root" htmlFor="settings-email">Email</label>
            <div className="InputWrapper_root">
              <input id="settings-email" readOnly className="Input_root Input_outline" value={me?.email || user?.email || ""} />
            </div>
          </div>
            {me?.emailVerified === true && (
              <div className="VerifiedStatus_root">
                <img alt="tick" src="/icons/green-tick.svg" />
              </div>
            )}
            <button type="button" className="PasswordInput_forgotPasswordText" onClick={() => setEditing("email")}>
              Change Email
            </button>
          </div>
        </div>
      </form>
      {editing === "avatar" && <AvatarPickerModal current={me?.avatar} onClose={() => setEditing(null)} onSaved={saved} />}
      {editing === "email" && <ChangeEmailModal onClose={() => setEditing(null)} onSaved={saved} />}
    </div>
  );
}
