import { CarouselHeader, SwipeTrack } from "../ui/Carousel";
import { useCarousel } from "../../lib/carousel";

/** Provider logo rail — reference `ProviderCarousel`. */
export default function ProviderCarousel({ providers }) {
  const { trackRef, carousel } = useCarousel();

  return (
    <section>
      <CarouselHeader
        title="Providers"
        icon="/icons/provider.svg"
        iconClass="ProviderCarousel_headingIcon"
        iconSize={0}
        href="/casino/providers"
        viewAll={null}
        carousel={carousel}
      />
      <SwipeTrack trackRef={trackRef} carousel={carousel}>
        {providers.map((p) => (
          <div key={p.slug} className="ProviderCard_ProviderCardWrapper">
            <a href={`/casino/providers/${p.slug}`} onClick={(e) => e.preventDefault()}>
              <div className="ProviderCard_providerCardBlock">
                <div className="ProviderCard_providerCardElement">
                  <img alt={p.name} className="nimg-fill nimg-contain" src={p.img} />
                </div>
              </div>
            </a>
          </div>
        ))}
      </SwipeTrack>
    </section>
  );
}
