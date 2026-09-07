/**
 * Main-column header — reference `Header` module (guest state).
 * The logo shows through the desktop wrapper once the content column is wide
 * enough (driven by the `.magic-container` state classes on the layout).
 */
import { navigate } from "../../lib/router";

export default function TopBar({ signedIn = false, onAuth = () => {} }) {
  const logo = (cls) => (
    <a title="Shuffle Casino" aria-label="Home" className={cls} href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
      <img height="28" alt="logo" src="/icons/logo.svg" />
    </a>
  );

  return (
    <header className="Header_navWrapper" id="nav-header">
      <div className="Header_iOSChromeScrollHider" />
      <section className="LayoutContainer_root Header_navContainer LayoutContainer_row">
        {logo("HeaderLogo_mobileLogoWrapper HeaderLogo_notLoginFullLogo")}
        {logo("HeaderLogo_desktopLogoWrapper")}

        <div className="HeaderWalletActions_navMenu">
          {signedIn ? (
            <button className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary HeaderLoginRegister_authButton" type="button">
              <span className="ButtonVariants_buttonContent">Deposit</span>
            </button>
          ) : (
            <>
              <button className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_tertiary HeaderLoginRegister_authButton HeaderLoginRegister_transparentButton" type="button" onClick={() => onAuth("login")}>
                <span className="ButtonVariants_buttonContent">Login</span>
              </button>
              <button className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary HeaderLoginRegister_authButton" type="button" onClick={() => onAuth("register")}>
                <span className="ButtonVariants_buttonContent">Register</span>
              </button>
            </>
          )}
        </div>
      </section>
    </header>
  );
}
