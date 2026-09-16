import { CarouselHeader, SwipeTrack } from "../ui/Carousel";
import { cx, useCarousel } from "../../lib/carousel";
import { useReveal } from "../../lib/useReveal";
import { navigate } from "../../lib/router";

/**
 * Whether a tile's href has a screen behind it.
 *
 * `/casino/games/<uuid>` is the catalogue's own route and the only one
 * `GamePage` serves. See the note on the card's `onClick` for what the other
 * hrefs are and why they are left alone.
 */
const playable = (href) => String(href || "").startsWith("/casino/games/");

export function GameCard({ game, index = 0, indicator, hidden = false, className }) {
  const [ref, shown] = useReveal();

  return (
    <a
      ref={ref}
      className={cx("TallGameCard_root", hidden ? "TallGameCard_hide" : "TallGameCard_reveal", !hidden && shown && "TallGameCard_show", className)}
      style={{ "--card-i": index }}
      data-testid={game.name}
      href={game.href}
      /**
       * A real link, routed in-app — but only where there is something to
       * route to.
       *
       * Of the 153 tiles the lobby renders, 90 are catalogue rows and carry
       * `/casino/games/<uuid>`, which `GamePage` serves. The other 63 are the
       * capture's own hrefs: 17 in-house originals under `/games/originals/*`
       * and 46 reference-shaped `/games/*` entries. Neither has a page here —
       * the originals are server-authoritative socket games that are not
       * built, and the rest are another operator's catalogue with no uuid to
       * launch. Navigating those would change the URL and then fall through to
       * the lobby, which reads as a link that quietly did the wrong thing.
       *
       * So they stay inert, exactly as every tile was before this. The click
       * is still an `<a>` with a live `href`, so middle-click, ctrl-click and
       * "copy link" behave for all of them.
       */
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        if (playable(game.href)) navigate(game.href);
      }}
    >
      <div className="TallGameCard_buttonGroup">
        {/* No favourite star on the tile — removed on request. `MyGamesPage`
            still READS the list, so the page keeps working; nothing in the UI
            writes to it now. */}
        {/* Inside the card's own link, so the click must not reach it. The
            popup itself is not built — `stopPropagation` alone would leave a
            button that swallows the click and does nothing, so it opens the
            game page too, in a new window. */}
        <button
          className="TallGameCard_button"
          type="button"
          aria-label={`Open ${game.name} in a popup`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (playable(game.href)) window.open(game.href, "_blank", "noopener,width=1280,height=800");
          }}
        >
          <img alt="pop up" height="16" src="/icons/game-popup.svg" width="16" />
        </button>
        <span
          className="SkeletonPlaceholder_root SkeletonPlaceholder_imageVariant SkeletonPlaceholder_hasColor TallGameCard_skeletonClassName"
          style={{ "--skeleton-color": game.color }}
        >
          {/*
            Most of this catalogue's artwork is not ours. The import kept each
            row's own `game_icon`, which points at the CDN of whichever
            operator the dump came from — coincasino.com, images.rajabet.fun,
            cloudfront — and only the 183 games whose TITLE matches the capture
            get a local file instead (`capturedArtFor`).

            `onError` is what makes the rest safe. Measured against the live
            hosts: images.rajabet.fun serves its images fine, and
            www.coincasino.com answers 403 with an HTML block page for every
            request — so a tile pointing there can never draw, and without this
            it showed a broken-image glyph. It now lands on the reference's own
            placeholder, guarded by a flag so a failing placeholder cannot loop.

            `referrerPolicy` is precautionary rather than a fix for any host
            seen here: coincasino refuses with or without a `Referer`, so it
            was NOT the cause. It stays because a request for somebody else's
            image has no business carrying this site's URL, and it is what
            keeps a merely hotlink-protected host working.
          */}
          <img
            alt={game.name}
            className="nimg-fill"
            decoding="async"
            loading="lazy"
            referrerPolicy="no-referrer"
            src={game.img}
            onError={(e) => {
              if (e.currentTarget.dataset.fallback) return;
              e.currentTarget.dataset.fallback = "1";
              e.currentTarget.src = "/icons/logo-star.svg";
            }}
          />
          <div className="GameCardBorder_root" style={{ border: `2px solid ${game.color}` }} />
        </span>
      </div>
      {indicator && <p className="CasinoTournamentContent_indicator">{indicator}</p>}
    </a>
  );
}

function ViewAllCard({ href }) {
  return (
    <a href={href} onClick={(e) => { e.preventDefault(); navigate(href); }}>
      <div className="ViewAllCard_root">
        <div className="ViewAllCard_viewAllCardElement">
          <div className="ViewAllCard_viewAllTop" />
          <div className="ViewAllCard_viewAllBottom" />
          <div className="ViewAllCard_viewAllContents">
            <div className="Flex_root Flex_spaced">
              <img alt="star" loading="lazy" src="/icons/logo-star.svg" />
              <p className="ViewAllCard_viewAllText">View all</p>
            </div>
            <div className="ViewAllCard_viewAllCenter">
              <img alt="logo" loading="lazy" src="/icons/shuffle-logo-tall.svg" />
            </div>
            <div className="Flex_root ViewAllCard_star">
              <img alt="star" loading="lazy" src="/icons/logo-star.svg" />
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}

/**
 * One lobby row: heading + horizontally scrolling tall game cards.
 *
 * `viewAll` is the card that sits after the last tile. It is off for the
 * Shuffle Games row on request — that row's heading already carries the same
 * link, so the card was a second copy of it.
 */
export default function GameCarousel({ section, viewAll = true }) {
  const { trackRef, carousel } = useCarousel();

  return (
    <section>
      <CarouselHeader title={section.title} icon={section.icon} href={section.href} carousel={carousel} />
      <SwipeTrack trackRef={trackRef} carousel={carousel}>
        {section.games.map((g, i) => (
          <GameCard key={g.href} game={g} index={i} />
        ))}
        {viewAll && <ViewAllCard href={section.href} />}
      </SwipeTrack>
    </section>
  );
}
