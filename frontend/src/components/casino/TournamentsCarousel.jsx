import { CarouselHeader, SwipeTrack } from "../ui/Carousel";
import { useCarousel } from "../../lib/carousel";
import { site } from "../../lib/endpoints";
import { promotionToTile } from "../../lib/promotions";
import { useApi } from "../../lib/useResource";
import { useGate } from "../../lib/gates";
import { PromoBanner } from "./PromoWidgets";

/**
 * Active tournaments + race tiles — reference `ActiveTournamentsAndRaceBanner`.
 *
 * The admin's live promotions (`GET /admin/promotions`). The row is not drawn
 * when there are none — the reference's tiles were another site's contests.
 */
export default function TournamentsCarousel() {
  const { trackRef, carousel } = useCarousel();
  const on = useGate();
  const { data } = useApi("home:tournaments", () => site.promotions({ page: 1, limit: 8 }), { enabled: on.ready && on("promotions") });
  const tiles = (Array.isArray(data?.data) ? data.data : []).map(promotionToTile).filter((t) => t.status === "live");
  if (!tiles.length) return null;

  return (
    <section>
      <CarouselHeader viewAll={null} carousel={carousel}>
        <span className="LabelLink_root LabelLink_lg">
          <span className="LabelLink_prefix">
            <img alt="" className="ActiveTournamentsAndRaceBanner_tournamentTrophy" height="24" src="/icons/trophy.svg" width="24" />
          </span>
          <span className="LabelLink_label">Tournaments</span>
        </span>
      </CarouselHeader>
      <SwipeTrack trackRef={trackRef} carousel={carousel} large className="ActiveTournamentsAndRaceBanner_carouselContent">
        {tiles.map((t) => (
          <div key={t.href} className="TournamentBannerCard_card ActiveTournamentsAndRaceBanner_tile">
            <PromoBanner image={t.img} href={t.href} title={t.title} countdown={t.ends} />
          </div>
        ))}
      </SwipeTrack>
    </section>
  );
}
