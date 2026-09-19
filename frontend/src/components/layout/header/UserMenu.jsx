import { useEffect, useRef, useState } from "react";
import { cx } from "../../../lib/carousel";
import { navigate } from "../../../lib/router";
import { usePublicSiteConfig } from "../../../lib/usePublicSiteConfig";
import { useApi } from "../../../lib/useResource";
import { vip as vipApi } from "../../../lib/endpoints";
import VipBadge from "../../vip/VipBadge";
import { tierFor } from "../../vip/vipTiers";

/**
 * The account button and its dropdown — reference `Header/UserMenu/*`.
 *
 * The reference opens this on **hover** (and `:focus-within`), not on click —
 * `UserMenu.module.scss` has no open state, only `&:hover .userMenuWrapper ~ div`.
 * That CSS is reproduced verbatim in `shuffle-header.css`, so desktop needs no
 * JavaScript. The click handler here is for touch, where there is no hover.
 *
 * ── THE ITEM LIST ────────────────────────────────────────────────────────
 *
 * Read off the live signed-in header, not guessed. Thirteen rows: a VIP card
 * that links to `/vip-program`, then eleven entries, then Logout. An earlier
 * pass here invented a shorter list from what the backend happens to serve; the
 * order and labels below are the site's.
 *
 * The panel is a `<div>`, and each row is a `<button>` or `<a>` directly inside
 * it — no `<ul>`/`<li>`, despite `ExpandMenuElement_expandMenu` carrying
 * `list-style-type: none`.
 *
 * Five rows act: Wallet opens the modal, VIP, Token and Affiliate Program go
 * to their pages, and Logout ends the session. The other six have no screen yet
 * (§4.3), so they are `disabled` rather than pointed at a path that would fall
 * through to the lobby.
 */



/** Everything below the VIP card. `href` where the live site uses an anchor. */
const items = [
  { id: "wallet", label: "Wallet", icon: "/icons/wallet.svg" },
  { id: "vip", label: "VIP", icon: "/icons/crown.svg", href: "/vip-program" },
  { id: "vault", label: "Vault", icon: "/icons/shield-lock.svg" },
  { id: "token", label: "Token", icon: "/icons/token-white.svg", href: "/token" },
  { id: "affiliate", label: "Affiliate Program", icon: "/icons/affiliate.svg", href: "/affiliate/overview" },
  { id: "notifications", label: "Notifications", icon: "/icons/notifications.svg" },
  { id: "transactions", label: "Transactions", icon: "/icons/transactions.svg", href: "/transactions" },
  { id: "redeem", label: "Redeem Code", icon: "/icons/redeem-code.svg" },
  { id: "settings", label: "Settings", icon: "/icons/setting.svg", href: "/settings/account" },
  { id: "wise", label: "Shuffle Wise", icon: "/icons/shuffle-wise.svg", href: "/shuffle-wise/self-exclusion" },
  { id: "support", label: "Live Support", icon: "/icons/live-support.svg" },
];

/**
 * The card at the top of the panel.
 *
 * Live data: `GET /user/vip` gives `{ level, card, progressPct, … }`, which is
 * the tier badge and the progress bar. The `<progress>` element and its wrapper
 * are the reference's `ProgressBarSection`, already in the captured stylesheet.
 */
function VipCard({ name, vip }) {
  const tier = tierFor(vip);
  const pct = Number(vip?.progressPct ?? 0);

  return (
    <a
      className="UserMenuVipCard_userMenuVipWrapper"
      href="/vip-program"
      onClick={(e) => { e.preventDefault(); navigate("/vip-program"); }}
    >
      <div className="UserMenuVipCard_name">
        <div className="Avatar_root Avatar_background">
          <img alt="avatar" width="40" height="40" src="/icons/user-profile.svg" />
        </div>
        <span className="UserMenuVipCard_username">{name}</span>
      </div>
      <hr className="UserMenuVipCard_lineBreak" />
      <VipBadge icon={tier.icon} label={tier.label} />
      <div className="ProgressBarSection_graph">
        <div className="ProgressBarSection_graphContent UserMenuVipCard_progressBarContent">
          <div className="ProgressBarSection_progress ProgressBarSection_skipBorder">
            <progress value={pct} max="100" />
          </div>
          <p className="ProgressBarSection_supportText">
            <span className="UserMenuVipCard_levelPercentage">{pct.toFixed(2)}%</span>
          </p>
        </div>
      </div>
    </a>
  );
}

function MenuRow({ item, onClose }) {
  // Wallet opens a modal rather than going anywhere.
  if (item.id === "wallet") {
    return (
      <button
        type="button"
        className="ExpandMenuElement_menuItem"
        onClick={() => {
          // The panel is a hover menu; leaving it open behind the modal means it
          // is still there when the modal closes.
          onClose();
          window.dispatchEvent(new CustomEvent("shuffle:wallet"));
        }}
      >
        <span className="ExpandMenuElement_menuIcon">
          <img alt="" height="16" width="16" src={item.icon} />
        </span>
        {item.label}
      </button>
    );
  }

  // Vault opens a modal rather than going anywhere.
  if (item.id === "vault") {
    return (
      <button
        type="button"
        className="ExpandMenuElement_menuItem"
        onClick={() => {
          onClose();
          window.dispatchEvent(new CustomEvent("shuffle:vault"));
        }}
      >
        <span className="ExpandMenuElement_menuIcon">
          <img alt="" height="16" width="16" src={item.icon} />
        </span>
        {item.label}
      </button>
    );
  }

  // Notifications opens the right rail rather than going anywhere.
  if (item.id === "notifications") {
    return (
      <button
        type="button"
        className="ExpandMenuElement_menuItem"
        onClick={() => {
          onClose();
          window.dispatchEvent(new CustomEvent("shuffle:notifications"));
        }}
      >
        <span className="ExpandMenuElement_menuIcon">
          <img alt="" height="16" width="16" src={item.icon} />
        </span>
        {item.label}
      </button>
    );
  }

  if (item.id === "redeem") {
    return (
      <button
        type="button"
        className="ExpandMenuElement_menuItem"
        onClick={() => {
          onClose();
          window.dispatchEvent(new CustomEvent("shuffle:redeem-code"));
        }}
      >
        <span className="ExpandMenuElement_menuIcon">
          <img alt="" height="16" width="16" src={item.icon} />
        </span>
        {item.label}
      </button>
    );
  }

  /*
   * A row with an `href` has a page behind it.
   *
   * This field was declared with the list and then never read, so VIP and
   * Affiliate rendered as disabled buttons like the rows that genuinely have
   * nowhere to go — clicking either did nothing, even though both pages exist.
   *
   * An anchor, because that is what the reference uses and because a real
   * `href` is what gives the row a middle-click, a context menu and a status
   * bar. The click is intercepted so it routes on this side instead of
   * reloading the app.
   */
  if (item.href) {
    return (
      <a
        className="ExpandMenuElement_menuItem"
        href={item.href}
        onClick={(e) => {
          e.preventDefault();
          onClose();
          navigate(item.href);
        }}
      >
        <span className="ExpandMenuElement_menuIcon">
          <img alt="" height="16" width="16" src={item.icon} />
        </span>
        {item.label}
      </a>
    );
  }

  return (
    <button type="button" className="ExpandMenuElement_menuItem" disabled>
      <span className="ExpandMenuElement_menuIcon">
        <img alt="" height="16" width="16" src={item.icon} />
      </span>
      {item.label}
    </button>
  );
}

/*
 * No `onLogout`: the row below dispatches `shuffle:logout` rather than calling
 * a handler, so the shell can put its confirmation in front of the sign-out.
 */
export default function UserMenu({ user }) {
  const { affiliateEnabled } = usePublicSiteConfig();
  const menuItems = affiliateEnabled ? items : items.filter((i) => i.id !== "affiliate");
  const [open, setOpen] = useState(false);
  const root = useRef(null);

  // The card only renders for a signed-in caller, which is the only case this
  // component mounts in, so the read needs no `enabled` guard.
  const { data: vip } = useApi("vip:progress", () => vipApi.progress());

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!root.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={cx("UserMenu_root", open && "UserMenu_open")} ref={root}>
      <button
        type="button"
        className="UserMenu_userMenuWrapper"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account: ${user.name}`}
        onClick={() => setOpen((o) => !o)}
      >
        {/* A `div`, not a nested button — `.userMenuWrapper > div { pointer-events:
            none }` in the reference expects exactly this, and `Avatar_root` is
            what makes it a circle. */}
        <div className="Avatar_root UserMenu_avatarButton">
          <img alt="avatar" width="40" height="40" src={user.avatar || "/icons/user-profile.svg"} />
        </div>
      </button>

      {/*
        Always rendered, never `display: none`. The wrapper sits at `opacity: 0`
        with `pointer-events: none`, and the hover/focus rules lift both — which
        is what makes the panel fade rather than appear. Mounting it on hover
        would skip the transition it was written for.
      */}
      <div className="ExpandMenuElement_menuWrapper">
        <div className="ExpandMenuElement_expandMenu">
          <VipCard name={user.name} vip={vip} />
          {menuItems.map((item) => (
            <MenuRow key={item.id} item={item} onClose={() => setOpen(false)} />
          ))}
          <button
            type="button"
            className="ExpandMenuElement_menuItem"
            onClick={() => {
              setOpen(false);
              window.dispatchEvent(new CustomEvent("shuffle:logout"));
            }}
          >
            <span className="ExpandMenuElement_menuIcon">
              <img alt="" height="16" width="16" src="/icons/logout.svg" />
            </span>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
