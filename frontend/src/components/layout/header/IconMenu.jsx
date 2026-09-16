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
 * None has a screen behind it yet (`docs/FRONTEND-BACKEND-INTEGRATION.md` §4.3)
 * and chat has no backend module at all (§4.4), so they are rendered and inert.
 * `keepEnabledStyle` is the variant the stylesheet provides for that case: it
 * holds the enabled background on a `:disabled` button, so an unbuilt
 * destination still matches the others instead of greying out.
 */

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

export default function IconMenu({ openBets = 0 }) {
  return (
    <div className="Flex_root Flex_sm5 IconMenu_root">
      <div className="IconMenu_menuWrapper">
        {/* The live header labels this one "show bets panel" — it opens the bet
            slip, which this clone has no sportsbook for yet. */}
        <IconButton icon="/icons/bet-slip.svg" alt="bet slip" label="show bets panel" badge={openBets} disabled />
        <IconButton icon="/icons/crown.svg" alt="crown" label="VIP Club" disabled />
        <IconButton icon="/icons/chat.svg" alt="chat" label="Chat" disabled />
      </div>
    </div>
  );
}
