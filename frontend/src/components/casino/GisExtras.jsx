import { CarouselHeader, SwipeTrack } from "../ui/Carousel";
import { useCarousel } from "../../lib/carousel";
import { gis as gisApi } from "../../lib/endpoints";
import { useApi } from "../../lib/useResource";
import { formatAmount, toGameCard } from "../../lib/adapters";
import { useSession } from "../../lib/sessionContext";
import { GameCard } from "./GameCarousel";

/**
 * Both reads (`/casino/gis/jackpots` signed in, `/casino/catalogue/jackpots` signed out) answer
 * `[{ name, amount (decimal string), currency, gameId?, raw }]`.
 */
function jackpotRows(payload) {
  return (Array.isArray(payload) ? payload : [])
    .map((j, i) => ({ key: `${j.gameId ?? ""}:${j.name}:${i}`, name: j.name || "Jackpot", amount: j.amount, currency: j.currency ?? "" }))
    .filter((j) => j.amount != null && Number.isFinite(Number(j.amount)));
}

/** A horizontal strip of live jackpots on the lobby; nothing when the provider has none. */
export function JackpotTicker() {
  const { signedIn } = useSession();
  const { data } = useApi(`jackpots:${signedIn}`, () => (signedIn ? gisApi.jackpots() : gisApi.publicJackpots()));
  const rows = jackpotRows(data);
  if (!rows.length) return null;
  return (
    <section aria-label="Jackpots" className="JackpotTicker_root">
      {rows.map((j) => (
        <div key={j.key} className="JackpotTicker_item">
          <img alt="" height="16" width="16" src="/icons/trophy-gold.svg" />
          <span>{j.name}</span>
          <strong>{formatAmount(j.amount)} {j.currency}</strong>
        </div>
      ))}
    </section>
  );
}

/** The caller's active free spins, as a lobby row of the games they play on (`GET /casino/gis/freespins/mine`). */
export function MyFreeSpins() {
  const { trackRef, carousel } = useCarousel();
  const { data } = useApi("gis:freespins", () => gisApi.freespins());
  const spins = (data?.freespins ?? []).filter((f) => f.game?.uuid);
  if (!spins.length) return null;
  return (
    <section>
      <CarouselHeader title="My Free Spins" icon="/icons/rewards.svg" viewAll={false} carousel={carousel} />
      <SwipeTrack trackRef={trackRef} carousel={carousel}>
        {spins.map((f, i) => (
          <GameCard key={f.id} game={toGameCard(f.game)} index={i} indicator={`${f.quantityLeft ?? f.quantity} spins`} />
        ))}
      </SwipeTrack>
    </section>
  );
}
