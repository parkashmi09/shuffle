import { SwipeTrack } from "../ui/Carousel";
import { useCarousel } from "../../lib/carousel";

/** Hero promo carousel — reference `HomeBannerSection`. */
export default function HeroBanners({ banners }) {
  const { trackRef, carousel } = useCarousel();

  return (
    <section className="LayoutContainer_root HomeBannerSection_newHomeBannerCarousel LayoutContainer_mobile-bottom-md2 LayoutContainer_tablet-top-sm4 LayoutContainer_tablet-bottom-md LayoutContainer_column">
      <section>
        <SwipeTrack trackRef={trackRef} carousel={carousel} large nav>
          {banners.map((b) => (
            <a key={b.href} className="HeroBannerCard_root" href={b.href} onClick={(e) => e.preventDefault()}>
              <img alt={b.alt} className="nimg-fill" decoding="async" src={b.img} />
            </a>
          ))}
        </SwipeTrack>
      </section>
    </section>
  );
}
