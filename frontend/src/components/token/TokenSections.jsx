import { cx } from "../../lib/carousel";
import { SHFL, LINKS, EXTERNAL_LINKS, HERO } from "./tokenData";

/**
 * The token dashboard's static sections — reference `/token`.
 *
 * ── THIS PAGE IS NOT THE ONE IN `assets/` ────────────────────────────────
 *
 * shuffle.com has redeployed since the capture was taken. The captured
 * `pages/token-*.js` chunk has no airdrop hero, no `TokenClaimableTiles`, no
 * `TokenHeroTile` and no `TokenLineDash`; the live page has all four. Both the
 * markup here and `shuffle-token.css` were read off the deployed page, so they
 * agree with each other.
 *
 * Nothing on this page is wired, and that is a backend gap rather than a
 * decision: there is no token module in any of the four services and no SHFL
 * price anywhere. The figures come from `tokenData.js`, which says so at
 * length and carries the date they were true.
 */

/** `TokenPercentageText` — green above zero, red below, with the sign. */
export function PercentageText({ value, className }) {
  const positive = Number(value) >= 0;
  return (
    <span className={cx(positive ? "TokenPercentageText_positive" : "TokenPercentageText_negative", className)}>
      {positive ? "" : "-"}
      {Math.abs(Number(value)).toFixed(2)}%
    </span>
  );
}

/**
 * The dashed rule between sections.
 *
 * The container draws nothing — the dashes are a repeating background on its
 * `<hr>` children, and it is a flex row with a `column-gap` between them:
 *
 *     .TokenLineDash_dashContainer     { display: flex; column-gap: … }
 *     .TokenLineDash_dashContainer > hr{ flex: 1; background-image: url(…) }
 *
 * An earlier pass rendered the container empty, so both rules had nothing to
 * apply to and the divider was a 16px gap of nothing. A second pass added the
 * two `<hr>` and still missed the point of the `column-gap`: the reference
 * puts the SHFL mark between them —
 *
 *     <hr><img src="/icons/token/shflLogo.svg" alt="Shuffle Logo"><hr>
 *
 * so the rule reads as two dashed runs either side of the logo, not as one
 * long dash.
 */
export function LineDash() {
  return (
    <div className="TokenLineDash_dashContainer">
      <hr />
      <img src="/icons/token/shflLogo.svg" alt="Shuffle Logo" />
      <hr />
    </div>
  );
}

/**
 * Price, name, and the two header buttons.
 *
 * The reference's second button opens a `PopupViewContainer` menu with "Buy
 * SHFL" and "Convert to SHFL". Buying SHFL needs an on-ramp this deployment
 * does not have, and converting needs the swap route wired to a pair that does
 * not exist — so the trigger renders and the menu it would open does not, the
 * same way the wallet's unconfigured branches do.
 */
export function TokenHeader() {
  return (
    <header className="TokenHeader_root">
      <h1 className="Heading_root Heading_h1 TokenHeader_heading">
        <img src="/icons/token.svg" alt="token" />
        <span className="TokenHeader_priceGroup">
          <span>
            {SHFL.name} <span className="TokenHeader_tokenShortName">({SHFL.symbol})</span>
          </span>{" "}
          {/* The space is the reference's — neither span carries a margin or a
              gap, so without it the price and the rate run together as
              "$0.30711.55%". */}
          <span>
            <span className="TokenHeader_price">{SHFL.price}</span>{" "}
            <PercentageText value={SHFL.change24h} className="TokenHeader_rate" />
          </span>
        </span>
      </h1>

      <div className="TokenHeader_buttonGroupDesktop">
        <a className="TokenHeader_button" href={LINKS.docs} target="_blank" rel="noreferrer">
          <span className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_outline">
            <span className="ButtonVariants_buttonContent">Learn More</span>
          </span>
        </a>
        <button
          type="button"
          disabled
          className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary TokenHeader_button"
        >
          <span className="ButtonVariants_buttonContent">Buy / Convert</span>
        </button>
      </div>
    </header>
  );
}

/**
 * The airdrop banner.
 *
 * Two things change with the session, and both are the reference's: the copy
 * (a visitor is sold the airdrop, a player is told the round is running), and
 * the wrapper — signed in the banner sits inside a `Flex_root Flex_column
 * Flex_lg`, signed out it is a direct child of the page.
 *
 * ── THREE CLASSES THAT LOOKED INTERCHANGEABLE AND ARE NOT ────────────────
 *
 * The heading is an `<h2>` carrying `HeroBanner_heading` inside a bare `div`,
 * not a styled div — that class brings `--font-heading` and the hard 2px black
 * text-shadow the display type needs to read over a photograph.
 *
 * The body is `HeroBanner_description > p.TokenBanner_text`. Putting the copy
 * straight into the description skips `TokenBanner_text`, which is where the
 * size, colour, margins and the centre-to-left alignment switch live.
 *
 * The button is `TokenHeroBannerContent_signUpButton` — a plain
 * `width: 8.25rem; margin: 0 auto`. An earlier pass used
 * `HeroBanner_linkButton`, which is the reference's *text* link variant and
 * carries `text-decoration: underline` and a `1px 1px 1px` text-shadow: that
 * is exactly the underline and the shadow that were showing on the button.
 *
 * `motion-slow-zoom` is the reference's `bb` variant — scale 1 → 1.1 over
 * thirty seconds, once. It is on the image rather than the banner so the text
 * over it stays still.
 *
 * Two `<img>`, as the reference has: `heroImage` is `display: none` until the
 * layout is wide enough and `heroMobileImage` is the one that shows below it.
 * The banner has NO height of its own — `.HeroBanner_hero` sets only width,
 * radius and border — so whichever image is showing is what gives the section
 * its height, and a missing file collapses it.
 */
export function TokenHero({ signedIn }) {
  const copy = signedIn ? HERO.signedIn : HERO.signedOut;

  const banner = (
    <div className="HeroBanner_hero">
      <img
        className="HeroBanner_heroImage motion-slow-zoom"
        src="/images/banners/token-hero.png"
        alt="airdrop race"
      />
      <img
        className="HeroBanner_heroMobileImage motion-slow-zoom"
        src="/images/banners/airdrop-mobile-hero.png"
        alt="airdrop race"
      />
      <div className="HeroBanner_heroContent">
        <div className="Flex_root Flex_column Flex_sm1">
          <div className="motion-rise" style={{ "--motion-delay": "0.1s" }}>
            <h2 className="HeroBanner_heading">{copy.heading}</h2>
          </div>
          <div className="motion-rise" style={{ "--motion-delay": "0.2s" }}>
            <div className="HeroBanner_description">
              <p className="TokenBanner_text">{copy.body}</p>
            </div>
          </div>
        </div>
        <div className="motion-rise" style={{ "--motion-delay": "0.3s" }}>
          <a className="TokenHeroBannerContent_signUpButton" href="/airdrop">
            <span className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary">
              <span className="ButtonVariants_buttonContent">{copy.cta}</span>
            </span>
          </a>
        </div>
      </div>
    </div>
  );

  return signedIn ? <div className="Flex_root Flex_column Flex_lg">{banner}</div> : banner;
}

/**
 * The three tiles under the hero — reference `TokenClaimableTiles`.
 *
 * Wager unlock rate, the KYC upsell, and what is available to claim. They
 * render only for a signed-in player, which is why `TokenPage` gates them:
 * the first two describe a rate against *your* wagering and the third is your
 * balance.
 *
 * ── WHAT AN EARLIER PASS GOT WRONG HERE ──────────────────────────────────
 *
 * It rendered two tiles, not three — the "Available to claim" one was missing
 * entirely. It wrapped the fiat amount in `TokenClaimableTiles_fiat`, which
 * carries `min-width: 8rem` and so opened 128px of empty space before the `=`;
 * the reference uses **plain spans** in this row and does not apply that class
 * here at all. And the buttons read "Verify" where the live ones say "Verify
 * Now" and "Claim now", each wrapped in the `Flex_sm2` the button content uses.
 *
 * ── THE CLAIM TILE HAS NOTHING BEHIND IT ─────────────────────────────────
 *
 * The reference animates the figure as a rolling odometer and claims against
 * its token module. There is no token module here, so the amount is a flat
 * `0.00` and the button is `disabled` — the same treatment the wallet's
 * unconfigured branches get. It is built out so that wiring it is a call
 * rather than a redesign.
 */
export function TokenTiles() {
  return (
    <div className="TokenClaimableTiles_tiles">
      <div className="Flex_root TokenHeroTile_root">
        <div className="Flex_root Flex_column">
          <span className="TokenHeroTile_subHeading">Wager unlock rate</span>
          <span className="TokenHeroTile_heading">
            <div className="Flex_root Flex_sm3 Flex_center TokenClaimableTiles_wagerText">
              <img src="/icons/fiat/USD.svg" alt="USD" />
              <span>$20.00</span>
              <span>=</span>
              <img className="CryptoIcon_root CryptoIcon_image" src="/icons/crypto/shfl.svg" alt="SHFL" />
              <span>1.00</span>
              <span>SHFL</span>
            </div>
          </span>
        </div>
      </div>

      <div className="Flex_root TokenHeroTile_root">
        <div className="Flex_root Flex_column">
          <span className="TokenHeroTile_subHeading">Level 2 verification</span>
          <span className="TokenHeroTile_heading">
            <div className="TokenClaimableTiles_wagerText">Double your unlock rate</div>
          </span>
        </div>
        <button
          type="button"
          disabled
          className="ButtonVariants_root ButtonVariants_buttonHeightXSmall ButtonVariants_greenOutline TokenHeroTile_button"
        >
          <span className="ButtonVariants_buttonContent">
            <div className="Flex_root Flex_sm2">
              <span>Verify Now</span>
            </div>
          </span>
        </button>
      </div>

      <div className="Flex_root TokenHeroTile_root">
        <div className="Flex_root Flex_column">
          <span className="TokenHeroTile_subHeading">Available to claim</span>
          <span className="TokenHeroTile_heading">
            <div className="Flex_root Flex_sm3 Flex_center TokenClaimableTiles_wagerText">
              <img className="CryptoIcon_root CryptoIcon_image" src="/icons/crypto/shfl.svg" alt="SHFL" />
              <span className="TokenClaimableTiles_tokenToClaim">0</span>
            </div>
          </span>
        </div>
        <button
          type="button"
          disabled
          className="ButtonVariants_root ButtonVariants_buttonHeightXSmall ButtonVariants_greenOutline TokenHeroTile_button"
        >
          <span className="ButtonVariants_buttonContent">
            <div className="Flex_root Flex_sm2">
              <span>Claim now</span>
            </div>
          </span>
        </button>
      </div>
    </div>
  );
}

/** Holders, TVL and market cap. */
export function TokenStats() {
  const stats = [
    { label: "Holders", value: SHFL.holders },
    { label: "TVL", value: SHFL.tvl },
    { label: "Market Cap", value: SHFL.marketCap },
  ];
  return (
    <section className="TokenSiteStats_siteInfoSection">
      {stats.map((s) => (
        <div key={s.label} className="TokenSiteStats_siteInfoContainer">
          <div className="TokenSiteStats_siteInfo">
            <p className="TokenSiteStats_siteInfoHeading">{s.label}</p>
            <p className="TokenSiteStats_siteInfoValue">{s.value}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

/** Etherscan, CoinGecko, Uniswap, CoinMarketCap. */
export function TokenExternalLinks() {
  return (
    <section className="TokenLinks_externalLinks">
      {EXTERNAL_LINKS.map((l) => (
        <a key={l.key} className="TokenLinks_externalLink" href={l.href} target="_blank" rel="noreferrer">
          <img src={l.icon} alt={l.label} />
        </a>
      ))}
    </section>
  );
}

/**
 * The three promotional blocks at the foot of the page.
 *
 * The airdrop one points at `/airdrop`, which this clone has as a page. The
 * other two leave the site for the token docs, which is what the reference
 * does.
 */
export function TokenShflLinks() {
  const blocks = [
    {
      img: "/icons/token/shflWagerToEarn.svg",
      heading: "Join the weekly airdrop race",
      body: "Increase the amount of SHFL tokens you receive in the airdrop and join the weekly race.",
      cta: "Learn More",
      href: "/airdrop",
      internal: true,
    },
    {
      img: "/icons/token/shflBonuses.svg",
      green: SHFL.extraBonusesUsd,
      heading: "USD in extra bonuses",
      body: "We’ve given away millions in USD in extra VIP bonuses to players who wager in SHFL",
      cta: "Learn more",
      href: LINKS.vipRewards,
    },
    {
      img: "/icons/token/shflLottery.svg",
      heading: "Win BIG with the SHFL Lottery",
      body: `Play the lottery using SHFL and win weekly prizes. Current prize pool: ${SHFL.lotteryPrizePoolPlain}`,
      cta: "Play now",
      href: LINKS.lottery,
    },
  ];

  return (
    <section className="TokenLinks_shflLinks">
      {blocks.map((b) => (
        <div key={b.heading} className="TokenLinks_shflLinkContainer">
          <img className="shflLinkImg" src={b.img} alt="" />
          <div className="TokenLinks_text">
            <h6 className="TokenLinks_heading">
              {b.green && <span className="TokenLinks_green">{b.green}</span>} {b.heading}
            </h6>
            <p className="TokenLinks_subheading">{b.body}</p>
          </div>
          <a
            className="TokenLinks_btn"
            href={b.href}
            {...(b.internal ? {} : { target: "_blank", rel: "noreferrer" })}
          >
            <span className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary">
              <span className="ButtonVariants_buttonContent">{b.cta}</span>
            </span>
          </a>
        </div>
      ))}
    </section>
  );
}
