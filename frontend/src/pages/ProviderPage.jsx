import { useState } from "react";
import { GameCard } from "../components/casino/GameCarousel";
import ActivityBoard from "../components/casino/ActivityBoard";
import { GamesToolbar, PageHeader, ShowMoreButton } from "./LatestReleasesPage";
import { useProviderGames, useProviders } from "../lib/catalogue";
import { capturedProvider } from "../lib/providerGames";

const PAGE = 40;

const SORTS = {
  POPULAR: (games) => [...games].reverse(),
  RANDOM: (games) => [...games].sort((a, b) => a.href.length - b.href.length),
};

/** `pragmatic-play` → `Pragmatic Play`, for a provider the catalogue knows and the capture does not. */
const titleFromSlug = (slug) =>
  String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/**
 * One provider's games — reference `/casino/providers/<slug>`.
 *
 * Same furniture as a category page (header, toolbar, card grid, "Show More",
 * bets board), because that is what the reference serves here: a provider is a
 * filter over the catalogue, not a layout of its own.
 *
 * "Show More" raises the request limit rather than paging a fixed list — the
 * catalogue holds far more per studio than one page shows (Hacksaw alone is
 * 146), and `meta.pagination.total` is what says whether another page exists.
 */
export default function ProviderPage({ slug }) {
  const [limit, setLimit] = useState(PAGE);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("FEATURED");

  // The rail's own list — live where the catalogue has rows. It carries the
  // provider's display name, which is also what the games route takes.
  const { providers } = useProviders();
  const provider = providers.find((p) => p.slug === slug) || capturedProvider(slug);
  const title = provider?.label || provider?.name || titleFromSlug(slug);

  const { games = [], total = 0 } = useProviderGames(slug, provider?.name, { limit });

  const filtered = games.filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase()));
  const sorted = SORTS[sort] ? SORTS[sort](filtered) : filtered;
  const hasMore = !query && games.length < total;

  return (
    <div>
      {/*
        The site's square mark, not the provider's tile: that tile is a wordmark
        and spells the studio's name, which the heading beside it already does.
        `logo-mark.svg` is `logo-small.svg` reversed to white inside the brand
        violet — the app-icon form of the logo, which is what reads at 24px
        beside a heading where the bare glyph does not.
      */}
      <PageHeader title={title} icon="/icons/logo-mark.svg" desktopOnly />

      <section className="LayoutContainer_root LayoutContainer_column">
        {/*
          A provider page is already filtered by provider, so the select beside
          the search is the catalogue's other axis — the game type — not the one
          the URL has already fixed.
        */}
        <GamesToolbar query={query} onQuery={setQuery} sort={sort} onSort={setSort} title={title} icon="/icons/logo-mark.svg" filterLabel="All Categories" />
        <div className="CardGrid_cardGridWrapper">
          <div className="CardGrid_cardGridElement">
            {sorted.map((g, i) => (
              <GameCard key={g.href + i} game={g} index={i % 7} />
            ))}
          </div>
          {sorted.length === 0 && (
            <p className="CardGrid_cardGridDisplayingText CardGrid_padding" style={{ textAlign: "center" }}>
              No games found
            </p>
          )}
          {hasMore && <ShowMoreButton onClick={() => setLimit((l) => l + PAGE)} />}
        </div>
      </section>

      <ActivityBoard hideTabs={["race"]} />
    </div>
  );
}
