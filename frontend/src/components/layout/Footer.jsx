import { useEffect, useRef, useState } from "react";
import { cx } from "../../lib/carousel";
import { navigate } from "../../lib/router";
import { useSession } from "../../lib/sessionContext";
import { usePublicSiteConfig } from "../../lib/usePublicSiteConfig";

const columns = [
  {
    order: 2,
    title: "Support",
    links: [
      { label: "Live Support", button: true },
      { label: "Help Center", href: "https://help.shuffle.com", external: true },
      { label: "Game Responsibly", href: "https://www.begambleaware.org/", external: true },
    ],
  },
  {
    order: 3,
    title: "Platform",
    links: [
      { label: "Provably Fair", href: "/provably-fair/overview" },
      { label: "Affiliate Program", href: "/affiliate", signedInHref: "/affiliate/overview" },
      { label: "Redeem Code", button: true },
      { label: "VIP Program", href: "/vip-program" },
    ],
  },
  {
    order: 4,
    title: "Policy",
    links: [
      { label: "Terms of Service", href: "/info/terms" },
      { label: "Privacy Policy", href: "/info/privacy" },
      { label: "Responsible Gambling", href: "/info/responsible-gambling" },
      { label: "AML Policy", href: "/info/aml" },
      { label: "License", href: "/info/license" },
      { label: "Sports", href: "/info/sports" },
      { label: "Lottery", href: "/info/lottery" },
      { label: "Convert", href: "/info/convert" },
      { label: "Airdrop", href: "/info/airdrop" },
    ],
  },
  {
    order: 5,
    title: "Community",
    links: [
      { label: "X", href: "https://x.com/shufflecom", external: true },
      { label: "Instagram", href: "https://www.instagram.com/shufflecom", external: true },
      { label: "Facebook", href: "https://facebook.com/shufflefb", external: true },
      { label: "Telegram", href: "https://t.me/shufflecom", external: true },
      { label: "Merch", href: "https://shuffle.store/", external: true },
      { label: "Shuffle Forum", href: "https://shufflecommunity.com", external: true },
    ],
  },
];

const languages = ["English", "Français", "中文", "Español", "Português", "한국어", "日本語", "Deutsch", "Magyar", "Türkçe", "Pусский", "Tiếng Việt", "Srbija", "Polski", "Indonesian", "Norsk", "Italiano"];
const odds = ["Decimal", "Fractional", "American", "Indonesian", "Hong Kong", "Malaysian"];

/**
 * One of the footer's two pickers — reference `Select` inside
 * `LanguageAndOddSelectors`.
 *
 * The popup is the same `ActivityBoard_selectPopup` list the rest of the site's
 * selects use (see `ActivityBoard`), flipped to open upwards: these sit at the
 * very bottom of the page, so a downward list would open off-screen.
 */
function SelectButton({ label, options, value, onChange, children }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);

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
    <div className="FormControlWrapper_root Select_formWrapper" ref={root}>
      <label className="sr-only">
        {label}
        <select tabIndex={-1} name={label} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cx("Select_button", open && "Select_openBtn")}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="Select_item">{children}</span>
        <img alt="Toggle dropdown menu" className={cx("Select_chevronIcon", open && "Select_up")} src="/icons/chevron.svg" />
      </button>
      {open && (
        <ul className="ActivityBoard_selectPopup Footer_selectPopup" role="listbox">
          {options.map((o) => (
            <li key={o}>
              <button
                type="button"
                role="option"
                aria-selected={o === value}
                className={cx("ActivityBoard_selectOption", o === value && "ActivityBoard_selectOptionSelected")}
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The language and odds pickers. The reference renders this pair twice — once
 * inside the footer's last column for tablet and up, and once as a row of its
 * own below the link grid on mobile — and hides whichever does not apply. Both
 * copies drive the same preference, so the state lives in `Footer`.
 */
function LanguageAndOddSelectors({ className, language, setLanguage, odd, setOdd }) {
  return (
    <div className={className}>
      <SelectButton label="language" options={languages} value={language} onChange={setLanguage}>
        <span className="Select_text">{language}</span>
      </SelectButton>
      <SelectButton label="odds" options={odds} value={odd} onChange={setOdd}>
        <div className="OddsFormatPreference_selectedItem">
          Odds: <span>{odd}</span>
        </div>
      </SelectButton>
    </div>
  );
}

/** Site footer — reference `Footer` module. */
export default function Footer() {
  const { signedIn } = useSession();
  const { affiliateEnabled } = usePublicSiteConfig();
  const linkColumns = columns.map((col) => ({
    ...col,
    links: col.links.filter((l) => affiliateEnabled || l.label !== "Affiliate Program"),
  }));
  const [language, setLanguage] = useState("English");
  const [odd, setOdd] = useState("Decimal");

  return (
    <footer className="Footer_footerWrapper">
      <section className="LayoutContainer_root LayoutContainer_mobile-top-md2 LayoutContainer_mobile-bottom-md2 LayoutContainer_tablet-top-lg4 LayoutContainer_tablet-bottom-lg4 LayoutContainer_column">
        <div className="Footer_row">
          <div className="Footer_column mobile-top Footer_columnOrder0">
            <div className="Footer_brandingWrapper">
              <a href="/" title="Shuffle Casino" onClick={(e) => e.preventDefault()}>
                <div className="Footer_icon">
                  <img alt="logo" height="24" src="/icons/logo.svg" />
                </div>
              </a>
            </div>
          </div>

          {linkColumns.map((col) => (
            <div key={col.title} className={`Footer_column Footer_columnOrder${col.order}`}>
              <div className="Footer_menuHeading">{col.title}</div>
              <ul className="Footer_menuList">
                {col.links.map((l) => {
                  const href = (signedIn && l.signedInHref) || l.href;
                  return (
                    <li key={l.label} className="Footer_menuItem">
                      {l.button ? (
                        <button type="button">{l.label}</button>
                      ) : (
                        <a
                          href={href}
                          rel={l.external ? "noopener noreferrer" : undefined}
                          target={l.external ? "_blank" : undefined}
                          onClick={
                            l.external
                              ? undefined
                              : (e) => {
                                  e.preventDefault();
                                  navigate(href);
                                }
                          }
                        >
                          {l.label}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="Footer_column Footer_columnOrder1">
            <LanguageAndOddSelectors
              className="LanguageAndOddSelectors_visibleOnlyMobileAbove"
              language={language}
              setLanguage={setLanguage}
              odd={odd}
              setOdd={setOdd}
            />
          </div>
        </div>

        <LanguageAndOddSelectors
          className="LanguageAndOddSelectors_visibleMobileOnly"
          language={language}
          setLanguage={setLanguage}
          odd={odd}
          setOdd={setOdd}
        />

        <p className="Footer_description">
          Shuffle is owned and operated by Natural Nine B.V., Curaçao company registration number 160998, with its registered address at
          Korporaalweg 10, Willemstad, Curaçao and is licensed by the Curaçao Gaming Control Board to offer games of chance under license
          number OGL/2024/1337/0628. Contact us at <a href="mailto:support@shuffle.com">support@shuffle.com</a>.
        </p>

        <div className="Footer_footerBottom">
          <span>1 ETH = $2,454.82</span>
          <div className="Footer_bottomRight">
            <span className="Footer_copyrightText">© {new Date().getFullYear()} Shuffle.com | All Rights Reserved</span>
            <div className="Footer_bottomRightIcons">
              <a href="https://cert.cga.cw/" rel="noopener noreferrer" target="_blank">
                <img alt="CGA Verified Certificate Seal" src="/images/cga-seal.png" width="51" height="32" />
              </a>
              <a className="Footer_iconLink" href="https://www.begambleaware.org" rel="noopener noreferrer" target="_blank">
                <img alt="18 plus" loading="lazy" src="/icons/eighteen-plus.svg" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </footer>
  );
}
