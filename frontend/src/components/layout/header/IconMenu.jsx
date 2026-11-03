/**
 * The round icon buttons on the right of the bar — reference
 * `Header/IconMenu/*`.
 *
 * Three of them, read off the live signed-in header: **bet slip**, **VIP** and
 * **chat** — not a notification bell, which two earlier passes here guessed at.
 * Notifications live in the account menu instead. Each is
 * `ButtonVariants_tertiaryRound`, the reference's own 40px circle, and the
 * whole group carries `Flex_root Flex_sm5` alongside `IconMenu_root` exactly as
 * the live DOM does.
 *
 * The bets button opens the exchange's My Bets; VIP opens the right-hand rail
 * (`layout/VipPanel.jsx`). There is no in-site chat, so Chat opens Live Support
 * (`useSupportHref`) and is inert when the site has no support link. `keepEnabledStyle` is the variant the stylesheet provides for that
 * case: it holds the enabled background on a `:disabled` button, so an unbuilt
 * destination still matches the others instead of greying out.
 */
import { navigate } from "../../../lib/router";
import { useGate } from "../../../lib/gates";
import { openExternal, useSupportHref } from "../../../lib/siteContent";

/** The count bubble — the rail's own `Counter`, which the reference reuses here. */
function Badge({ count }) {
  if (!count) return null;
  return (
    <div className="IconMenuItem_badgeWrapper">
      <span className="Counter_root Counter_neon">{count > 99 ? "99+" : count}</span>
    </div>
  );
}

function IconButton({ icon, alt, label, badge, onClick, disabled = false }) {
  return (
    <div className="IconMenu_menu">
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={disabled}
        onClick={onClick}
        className={`ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_tertiaryRound ButtonVariants_hasIcon${
          disabled ? " ButtonVariants_keepEnabledStyle" : ""
        }`}
      >
        <span className="ButtonVariants_buttonContent">
          <span className="ButtonIcon_root">
            <img alt={alt} height="16" width="16" src={icon} />
          </span>
        </span>
      </button>
      <Badge count={badge} />
    </div>
  );
}

export default function IconMenu() {
  const on = useGate();
  const supportHref = useSupportHref();
  return (
    <div className="Flex_root Flex_sm5 IconMenu_root">
      <div className="IconMenu_menuWrapper">
        {on("sports") && (
          <IconButton icon="/icons/bet-slip.svg" alt="bet slip" label="My Bets" onClick={() => navigate("/sports/my-bets")} />
        )}
        {on("vip") && (
          <IconButton
            icon="/icons/crown.svg"
            alt="crown"
            label="VIP Club"
            onClick={() => window.dispatchEvent(new CustomEvent("shuffle:vip"))}
          />
        )}
        <IconButton icon="/icons/chat.svg" alt="chat" label="Chat" disabled={!supportHref} onClick={() => openExternal(supportHref)} />
      </div>
    </div>
  );
}
