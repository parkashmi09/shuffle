import { cx } from "../../lib/carousel";
import { navigate } from "../../lib/router";

/**
 * Follow a heading's link through the router.
 *
 * `href` is the real route either way — it is what the anchor carries for a
 * middle click or a copied link — but a plain navigation would reload the app.
 * A header with no destination (`#`) keeps the anchor inert.
 */
const follow = (href) => (e) => {
  e.preventDefault();
  if (href && href !== "#") navigate(href);
};

/** Section heading row: icon + title link on the left, view-all + arrows on the right. */
export function CarouselHeader({
  title,
  icon,
  iconClass = "HomeTabLobby_headingIcon",
  iconSize = 24,
  href = "#",
  viewAll = "View all",
  viewAllHref,
  alwaysVisible = false,
  carousel,
  children,
  className,
}) {
  return (
    <div className={cx("Flex_root Flex_spaced", className)}>
      <h3 className="Heading_root Heading_h3 CarouselHeader_heading">
        {children || (
          <a className="TextLink_root" href={href} onClick={follow(href)}>
            <img alt={title} className={iconClass} height={iconSize || undefined} src={icon} width={iconSize || undefined} />
            <span>{title}</span>
          </a>
        )}
      </h3>
      <div className="Flex_root Flex_sm4 Flex_center">
        {viewAll && (
          <a
            className={cx("TextLink_root CarouselHeader_viewAllButton", alwaysVisible && "CarouselHeader_viewAllButtonAlwaysVisible")}
            href={viewAllHref || href}
            onClick={follow(viewAllHref || href)}
          >
            {viewAll}
          </a>
        )}
        {carousel && (
          <>
            <button aria-label="scroll left" className="CarouselHeader_navButton" disabled={carousel.atStart} type="button" onClick={carousel.prev}>
              <img alt="arrow left" className="CarouselHeader_leftArrow" height="16" src="/icons/chevron.svg" width="16" />
            </button>
            <button aria-label="scroll right" className="CarouselHeader_navButton" disabled={carousel.atEnd} type="button" onClick={carousel.next}>
              <img alt="arrow right" className="CarouselHeader_rightArrow" height="16" src="/icons/chevron.svg" width="16" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** The swipe track plus the right-edge fade button. */
export function SwipeTrack({ trackRef, carousel, large = false, className, children, nav = false }) {
  return (
    <div className="Carousel_swipeContent">
      <div ref={trackRef} className={cx("CarouselSwipeContent_root", large && "CarouselSwipeContent_largeItem", className)}>
        {children}
      </div>
      {nav ? (
        <nav className="CarouselNavControl_root">
          <button type="button" aria-label="previous" className={cx("CarouselNavControl_arrow CarouselNavControl_left", carousel.atStart && "CarouselNavControl_hide")} onClick={carousel.prev}>
            <img alt="arrow" src="/icons/chevron.svg" />
          </button>
          <button type="button" aria-label="next" className={cx("CarouselNavControl_arrow CarouselNavControl_right", carousel.atEnd && "CarouselNavControl_hide")} onClick={carousel.next}>
            <img alt="arrow" src="/icons/chevron.svg" />
          </button>
        </nav>
      ) : large ? null : (
        <button
          aria-label="Scroll to the right"
          className={cx("Carousel_carouselFade", carousel.atEnd && "Carousel_hideCarouselFade")}
          type="button"
          onClick={carousel.next}
        />
      )}
    </div>
  );
}
