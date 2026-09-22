/**
 * Main-column header — reference `Header` module.
 *
 * Two states behind one bar.
 *
 * **Signed out** is the capture, untouched: logo, Login, Register.
 *
 * **Signed in** is `HeaderWalletActions`. Its stylesheet comes from the
 * reference's own SCSS modules, preserved in the capture at
 * `assets/webpack---_N_E/src/components/Header/`; its markup was then read off
 * the live signed-in header, element by element, rather than inferred from the
 * CSS:
 *
 *     navMenu
 *       btnContainer   → BalanceSelect + the Wallet button
 *     userActions      → IconMenu (bet slip, VIP, chat) + UserMenu (account)
 *
 * The same two children carry every width: the balance pill stays on the bar
 * down to 320px on the reference, so there is no second row beneath it. Below
 * `sm` the reference drops `IconMenu` and shows the square logo mark instead
 * of the wordmark; see the notes at each.
 *
 * The logo shows through the desktop wrapper once the content column is wide
 * enough (driven by the `.magic-container` state classes on the layout).
 */
import { navigate } from "../../lib/router";
import { useSession } from "../../lib/sessionContext";
import { useSiteFeatures } from "../../lib/useSiteFeatures";
import BalanceSelect from "./header/BalanceSelect";
import IconMenu from "./header/IconMenu";
import UserMenu from "./header/UserMenu";

/**
 * The wallet button.
 *
 * `HeaderWalletActions_walletBtn` sits **on the button itself** — no wrapper,
 * and no `roundedWalletButton`, which the live header does not use here (it
 * belongs to the Shuffle US variant, whose `.walletBtn .roundedWalletButton`
 * rule turns the control into a circle on narrow columns). Read off the live
 * DOM: 92 × 48px, 6px radius, icon plus a `walletBtnText` label that CSS hides
 * below `md`.
 */
function WalletButton({ onClick }) {
  return (
    <button
      type="button"
      id="wallet-btn"
      aria-label="Wallet"
      onClick={onClick}
      className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary ButtonVariants_hasIcon HeaderWalletActions_walletBtn"
    >
      <span className="ButtonVariants_buttonContent">
        <span className="ButtonIcon_root">
          <img alt="wallet" height="16" width="16" src="/icons/wallet.svg" />
        </span>
        <span className="HeaderWalletActions_walletBtnText">Wallet</span>
      </span>
    </button>
  );
}

/**
 * The signed-in bar.
 *
 * TWO flex children, not one — this is what puts the balance in the middle.
 * `Header_navContainer` is `justify-content: space-between`, so with the logo,
 * the wallet group and the icon group as three siblings, the wallet group
 * settles centred in the gap between the other two. Nesting the icons inside
 * `navMenu` (as a first pass here did) collapses both into one child and the
 * whole lot slides right, which is not what the live header does.
 */
function SignedInActions() {
  const {
    user,
    balances,
    currency,
    setCurrency,
    displayCurrency,
    rates,
    loadingBalances,
    fiatView,
    hideZeroBalances,
    hideBalance,
  } = useSession();

  return (
    <>
      <div className="HeaderWalletActions_navMenu">
        <div className="HeaderWalletActions_btnContainer">
          {/* The Wallet button is a *child* of BalanceSelect, not a sibling —
              the live DOM keeps it inside `BalanceSelect_root`, which is what
              sets the 8px gap and what the popup centres against. See the note
              in BalanceSelect.jsx. */}
          <BalanceSelect
            balances={balances}
            currency={currency}
            onCurrencyChange={setCurrency}
            displayCurrency={displayCurrency}
            rates={rates}
            fiatView={fiatView}
            hideZeroBalances={hideZeroBalances}
            hideBalance={hideBalance}
            loading={loadingBalances}
          >
            <WalletButton onClick={() => window.dispatchEvent(new CustomEvent("shuffle:wallet"))} />
          </BalanceSelect>
        </div>
      </div>

      {/* `Flex_root Flex_sm5` beside the module class, as the live DOM has it. */}
      <div className="Flex_root Flex_sm5 HeaderWalletActions_userActions">
        <IconMenu />
        <UserMenu user={user} />
      </div>
    </>
  );
}

function SignedOutActions({ onAuth }) {
  const { canSignUp: allowed } = useSiteFeatures();
  const canSignUp = allowed();

  return (
    <div className="HeaderWalletActions_navMenu">
      <button
        className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_tertiary HeaderLoginRegister_authButton HeaderLoginRegister_transparentButton"
        type="button"
        onClick={() => onAuth("login")}
      >
        <span className="ButtonVariants_buttonContent">Login</span>
      </button>
      {/* A B2B site has no public signup — players are created by the
          operator — so the button comes off rather than opening a form the
          backend will refuse. Login stays: those accounts still sign in. */}
      {canSignUp && (
        <button
          className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary HeaderLoginRegister_authButton"
          type="button"
          onClick={() => onAuth("register")}
        >
          <span className="ButtonVariants_buttonContent">Register</span>
        </button>
      )}
    </div>
  );
}

export default function TopBar({ onAuth = () => {} }) {
  const { signedIn, restoring } = useSession();

  const logo = (cls, src = "/icons/logo.svg") => (
    <a
      title="Shuffle Casino"
      aria-label="Home"
      className={cls}
      href="/"
      onClick={(e) => {
        e.preventDefault();
        navigate("/");
      }}
    >
      <img height="28" alt="logo" src={src} />
    </a>
  );

  return (
    <>
      <header className="Header_navWrapper" id="nav-header">
        <div className="Header_iOSChromeScrollHider" />
        <section className="LayoutContainer_root Header_navContainer LayoutContainer_row">
          {/* Narrow columns: the reference swaps the wordmark for the square
              "S" mark once there is a session, because the balance pill and
              the wallet button need the width. Signed out there is nothing
              beside it but Login/Register, so the full logo stays — that is
              what `notLoginFullLogo` (width: auto, no left padding) is for.
              Read off the live header at 320–943px. */}
          {signedIn
            ? logo("HeaderLogo_mobileLogoWrapper", "/icons/logo-small.svg")
            : logo("HeaderLogo_mobileLogoWrapper HeaderLogo_notLoginFullLogo")}
          {logo("HeaderLogo_desktopLogoWrapper")}

          {/* While a stored token is being checked neither state is the truth
              yet. Rendering the guest buttons here would flash Login/Register
              at somebody who is signed in, so the slot stays empty for the one
              round trip `/auth/me` takes. */}
          {restoring ? (
            <div className="HeaderWalletActions_navMenu" />
          ) : signedIn ? (
            <SignedInActions />
          ) : (
            <SignedOutActions onAuth={onAuth} />
          )}
        </section>
      </header>

      {/* `HeaderBalanceSelector` — the sticky balance strip under the bar — is
          NOT part of the site header. Measured against the live signed-in site
          at 320, 360, 390, 430, 500, 600, 700, 767, 768, 800, 900, 943, 992,
          1100, 1140, 1200, 1303 and 1400px: the element is absent from the DOM
          at every one of them, and the balance pill itself stays on the bar
          all the way down to 320px (119px wide, which fits). Rendering the
          strip here put a second balance row under the header on phones that
          the reference does not have, so it is left unmounted. The component
          and its stylesheet stay for the in-game header, which is where the
          reference does use it. */}
    </>
  );
}
