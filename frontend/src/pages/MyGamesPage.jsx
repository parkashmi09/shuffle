import { useState } from "react";
import { GameCard } from "../components/casino/GameCarousel";
import ActivityBoard from "../components/casino/ActivityBoard";
import { GamesToolbar, PageHeader } from "./LatestReleasesPage";
import { useRecentlyPlayed } from "../lib/catalogue";
import { useFavourites } from "../lib/favouritesContext";
import { useSession } from "../lib/sessionContext";
import { toGameCard } from "../lib/adapters";
import { capturedGameFor } from "../lib/gameRefs";

/**
 * The two per-player game lists — reference `/favourites` and
 * `/casino/recently-played`, both signed-in only.
 *
 * ── THEY ARE NOT THE SAME PAGE ───────────────────────────────────────────
 *
 * They were built here as one component with a shared header, grid and empty
 * state. Against the reference, almost none of that is shared:
 *
 *   FAVOURITES         header wrapped in `BrowsingGames_header` (desktop only),
 *                      the FULL `GamesToolbar` — search, "All Categories",
 *                      "All Providers", "Sort by" — and NO empty state at all.
 *                      An empty list is an empty grid and nothing else.
 *
 *   RECENTLY PLAYED    a plain `PageHeader_root`, visible at every width, whose
 *                      heading is "Recently played" and is NOT title-cased. A
 *                      bare search field, not the toolbar. And a real empty
 *                      state: `CardGridEmpty_root`, a dashed 28rem panel with
 *                      the red cross mark and one line of text.
 *
 * So they share the card and the bets board, and that is all. The old shared
 * `GameListPage` is gone rather than grown a flag for every one of those.
 *
 * ── THE OLD EMPTY STATE WAS THE RIGHT RAIL'S ─────────────────────────────
 *
 * Both lists rendered `RightSidebarEmptyState_*` with an icon, a title and a
 * description. That component belongs to the 22rem right panel; across a full
 * page it reads as a stray centred paragraph, and the reference never uses it
 * here. Favourites shows nothing and Recently Played shows the dashed panel.
 */

/**
 * A stored row → a tile.
 *
 * `game` is the catalogue's row where it holds one and `null` where it does
 * not — which is the common case here, not a failure: a favourite is stored
 * under whatever string named the game, and a captured tile is named by its own
 * slug (see `games.service.js` and `lib/gameRefs.js`). So the capture is asked
 * second, and a reference neither side knows still draws a tile carrying the
 * reference itself, because a game that left the catalogue is still a row the
 * player put there.
 */
function cardFor(ref, row) {
  if (row?.game) return toGameCard(row.game);
  const captured = capturedGameFor(ref);
  if (captured) return captured;
  return { name: ref, href: `/games/${ref}`, img: "/icons/logo-star.svg", color: "#7B3FE4" };
}

const matches = (games, query) => {
  const q = query.trim().toLowerCase();
  return q ? games.filter((g) => String(g.name).toLowerCase().includes(q)) : games;
};

/**
 * The games this player has starred — reference `/favourites`.
 *
 * The sort control is presentational, as it is on every other browse page in
 * this port: the reference's options ("Featured", "Most Popular", "Recently
 * Added", …) need catalogue metadata the favourites rows do not carry.
 */
export function FavouritesPage() {
  const { rows, loading } = useFavourites();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("FEATURED");
  const games = matches(rows.map((r) => cardFor(r.game_ref, r)), query);

  return (
    <div>
      {/* `BrowsingGames_header` is `display: none` below 992px — the title
          moves into the compact toolbar there, so showing both would print it
          twice. Same wrapper the category pages use. */}
      <div className="BrowsingGames_header">
        <PageHeader title="Favourites" />
      </div>

      <section className="LayoutContainer_root LayoutContainer_column">
        <GamesToolbar
          query={query}
          onQuery={setQuery}
          sort={sort}
          onSort={setSort}
          title="Favourites"
          icon="/icons/star.svg"
          filterLabels={["All Categories", "All Providers"]}
        />
        <div className="CardGrid_cardGridWrapper">
          {/* The grid element is rendered whether or not it has children —
              that is what the reference does, and it is what keeps the
              toolbar's bottom margin from collapsing onto the bets board. */}
          <div className="CardGrid_cardGridElement">
            {!loading && games.map((g, i) => <GameCard key={`${g.href}-${i}`} game={g} index={i % 7} />)}
          </div>
        </div>
      </section>

      <ActivityBoard />
    </div>
  );
}

/** The games this player last opened — reference `/casino/recently-played`. */
export function RecentlyPlayedPage() {
  const { signedIn } = useSession();
  const { rows, loading } = useRecentlyPlayed({ enabled: signedIn });
  const [query, setQuery] = useState("");
  const games = matches(rows.map((r) => cardFor(r.game_uuid, r)), query);

  return (
    <div>
      {/* No `BrowsingGames_header` and no icon: the reference shows this bar at
          every width, and spells the heading "Recently played". */}
      <PageHeader title="Recently played" capitalize={false} />

      <section className="LayoutContainer_root recently-played_container LayoutContainer_column">
        {/* A bare field, not `GamesToolbar` — this page has no filters and no
            sort in the reference. */}
        <div className="TextInput_formControlWrapper">
          <div className="InputWrapper_root">
            <span className="TextInput_inputPrefix">
              <img alt="search" src="/icons/search.svg" />
            </span>
            <input
              className="Input_root Input_hasPrefix"
              placeholder="Search"
              aria-label="Search recently played games"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="CardGrid_cardGridWrapper">
          <div className="CardGrid_cardGridElement">
            {!loading && games.map((g, i) => <GameCard key={`${g.href}-${i}`} game={g} index={i % 7} />)}
          </div>
          {/* Nothing is said while the list is still in flight — an empty state
              that turns into a grid a moment later reads as a bug. */}
          {!loading && games.length === 0 && (
            <div className="CardGridEmpty_root">
              <img alt="" height="62" src="/icons/cross.svg" width="62" />
              <p>No Recently Played Games</p>
            </div>
          )}
        </div>
      </section>

      <ActivityBoard />
    </div>
  );
}
