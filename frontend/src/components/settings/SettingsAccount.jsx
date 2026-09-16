import { useApi } from "../../lib/useResource";
import { useSession } from "../../lib/sessionContext";
import { betHistory, profile as profileApi } from "../../lib/endpoints";
import { CoinIcon } from "../wallet/CurrencySelect";

/**
 * Settings → Account — reference `UserInfoPanel` + `StatisticsPanel`.
 *
 * One panel: the player's card on the left, three figures on the right, and
 * the address below both. `Relative_root` is what lets `VerifiedStatus_root`
 * pin its tick inside the field's right edge.
 *
 * Total wagered is the one figure with no source. `GET /casino/bet-history/stats`
 * answers `{ bets, wins, bySource }` and nothing in any of the four services
 * totals a player's stake, so it renders as zero in the display currency rather
 * than as a number this clone cannot stand behind.
 */
export default function SettingsAccount() {
  const { user } = useSession();
  const { data: me } = useApi("settings:profile", () => profileApi.get());
  const { data: stats } = useApi("settings:bet-stats", () => betHistory.stats().catch(() => null));

  const joined = me?.joinedAt ? new Date(me.joinedAt) : null;
  // `9.8.2026` — the reference writes the join date dot-separated, day first.
  const joinDate = joined ? `${joined.getDate()}.${joined.getMonth() + 1}.${joined.getFullYear()}` : "—";

  return (
    <div className="Flex_root Flex_column Flex_lg3">
      <form className="Panel_panelWrapper" onSubmit={(event) => event.preventDefault()}>
        <h2 className="Panel_panelHeading">User Information</h2>
        <div className="UserInfoPanel_infoWrapper">
          <div className="UserInfoPanel_userInfoCard">
            <div className="Flex_root" style={{ alignItems: "center" }}>
              <div className="UserBadgeBlock_root">
                <div className="UserBadgeBlock_avatarContainer">
                  <div className="Avatar_root Avatar_background">
                    <img alt="avatar" width="40" height="40" src={me?.avatar || "/icons/user-profile.svg"} />
                  </div>
                </div>
                <div className="UserBadgeBlock_badge">
                  <h2 className="UserInfoPanel_heading">{me?.username || user?.name || "—"}</h2>
                  <span className="VipBadge_root">
                    <span className="VipIcon_root">
                      <img alt="vip icon" width="16" height="16" src="/images/vip/unranked.svg" />
                    </span>
                    <span>Unranked</span>
                  </span>
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
                  <span className="StatisticsPanel_infoValue">{stats?.bets ?? 0}</span>
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
                      $0.00
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
            <div className="VerifiedStatus_root">
              <img alt="tick" src="/icons/green-tick.svg" />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
