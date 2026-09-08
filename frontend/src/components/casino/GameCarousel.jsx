import { CarouselHeader, SwipeTrack } from "../ui/Carousel";
import { cx, useCarousel } from "../../lib/carousel";
import { useReveal } from "../../lib/useReveal";

export function GameCard({ game, index = 0, indicator, hidden = false, className }) {
  const [ref, shown] = useReveal();
  return (
    <a
      ref={ref}
      className={cx("TallGameCard_root", hidden ? "TallGameCard_hide" : "TallGameCard_reveal", !hidden && shown && "TallGameCard_show", className)}
      style={{ "--card-i": index }}
      data-testid={game.name}
      href={game.href}
      onClick={(e) => e.preventDefault()}
    >
      <div className="TallGameCard_buttonGroup">
        <button className="TallGameCard_button" type="button" aria-label={`Open ${game.name} in a popup`} onClick={(e) => e.preventDefault()}>
          <img alt="pop up" height="16" src="/icons/game-popup.svg" width="16" />
        </button>
        <span
          className="SkeletonPlaceholder_root SkeletonPlaceholder_imageVariant SkeletonPlaceholder_hasColor TallGameCard_skeletonClassName"
          style={{ "--skeleton-color": game.color }}
        >
          <img alt={game.name} className="nimg-fill" decoding="async" loading="lazy" src={game.img} />
          <div className="GameCardBorder_root" style={{ border: `2px solid ${game.color}` }} />
        </span>
      </div>
      {indicator && <p className="CasinoTournamentContent_indicator">{indicator}</p>}
    </a>
  );
}

function ViewAllCard({ href }) {
  return (
    <a href={href} onClick={(e) => e.preventDefault()}>
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

/** One lobby row: heading + horizontally scrolling tall game cards. */
export default function GameCarousel({ section }) {
  const { trackRef, carousel } = useCarousel();

  return (
    <section>
      <CarouselHeader title={section.title} icon={section.icon} href={section.href} carousel={carousel} />
      <SwipeTrack trackRef={trackRef} carousel={carousel}>
        {section.games.map((g, i) => (
          <GameCard key={g.href} game={g} index={i} />
        ))}
        <ViewAllCard href={section.href} />
      </SwipeTrack>
    </section>
  );
}
