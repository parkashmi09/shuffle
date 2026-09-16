import { useState } from "react";
import { GameCard } from "../components/casino/GameCarousel";
import ProviderCarousel from "../components/casino/ProviderCarousel";
import ActivityBoard from "../components/casino/ActivityBoard";
import { navigate } from "../lib/router";
import { providers, sections } from "../data/catalog";
import { categoryFor, categoryIcon, categoryQuery } from "../lib/categories";
import { useCategory, useProviders } from "../lib/catalogue";
import { cx } from "../lib/carousel";
import useMediaQuery from "../lib/useMediaQuery";
import { FilterSelect, SortSelect } from "../components/ui/SelectMenu";

/**
 * Category browse page — reference `/casino/categories/latest-releases`:
 * page header with back button, paginated card grid, providers rail,
 * bets board slot and the category's SEO copy.
 */

const PAGE = 28;
const CATEGORY_PAGE = 40;
const seos = import.meta.glob("../data/seo-*.html", { query: "?raw", import: "default", eager: true });
const pool = ["latest-releases", "slots", "game-shows", "shuffle-picks", "live-casino"].flatMap((id) => sections.find((s) => s.id === id)?.games || []);


/**
 * The bar with the back button and the page title.
 *
 * `desktopOnly` wraps it in `BrowsingGames_header`, whose captured rule is
 * `display: none` below `md`. That wrapper belongs to the *category* pages
 * only: there the title moves into the compact toolbar below `md`, so leaving
 * the bar visible would print it twice. The providers page has no such
 * toolbar, and the reference renders its `PageHeader_root` unwrapped and
 * visible at 390px (375×95, `black900`, 0.8px bottom rule) — wrapping it here
 * is what made the providers page open straight onto the grid with no title.
 */
export function PageHeader({ title, icon, desktopOnly = false, capitalize = true }) {
  const bar = (
    <div className="PageHeader_root">
      <section className="LayoutContainer_root LayoutContainer_column">
        <div className="Flex_root Flex_md2">
          <a className="TextLink_root PageHeader_backButton" href="/" aria-label="Back" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
            <img alt="back" src="/icons/chevron.svg" />
          </a>
          {icon && <img alt="" className="PageHeader_icon" height="24" src={icon} width="24" />}
          {/* Recently Played is the one page whose heading the reference does
              NOT capitalize — it is spelled "Recently played" there, and the
              class that would title-case it is absent from its `h1`. */}
          <h1 className={cx("Heading_root Heading_h2", capitalize && "PageHeader_capitalize")}>{title}</h1>
        </div>
      </section>
    </div>
  );

  return desktopOnly ? <div className="BrowsingGames_header">{bar}</div> : bar;
}

export function SeoArticle({ html }) {
  const [open, setOpen] = useState(false);
  const start = html.indexOf('<div class="RichText_richTextBlock');
  const end = html.indexOf('<div class="ShowMoreOverlayButton_wrapper">');
  const inner = html.slice(start, end > 0 ? end : undefined);
  return (
    <section className="LayoutContainer_root LayoutContainer_mobile-bottom-md2 LayoutContainer_tablet-bottom-lg4 LayoutContainer_column">
      <div className={cx("SEOArticle_articleContent", open && "SEOArticle_showMore")}>
        <div dangerouslySetInnerHTML={{ __html: inner }} />
        {open ? (
          <div>
            <button className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary ShowMoreOverlayButton_root ShowMoreOverlayButton_btnNoOverlay" type="button" onClick={() => setOpen(false)}>
              <span className="ButtonVariants_buttonContent">Show Less</span>
            </button>
          </div>
        ) : (
          <div className="ShowMoreOverlayButton_wrapper">
            <div className="ShowMoreOverlayButton_overlay" />
            <button className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary ShowMoreOverlayButton_root ShowMoreOverlayButton_btnOverlay" type="button" onClick={() => setOpen(true)}>
              <span className="ButtonVariants_buttonContent">Show More</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

const SORTS = [
  ["FEATURED", "Featured"],
  ["POPULAR", "Most Popular"],
  ["RECENT_ADD", "Recently Added"],
  ["RANDOM", "Random"],
];

/**
 * The toolbar the reference renders below `md` — the page title, and the
 * search, provider and sort controls collapsed to 42px icon buttons.
 *
 * Read off the live category page at 390px. Two things it is not: it is not
 * the desktop toolbar restyled (there is no shared markup — no search field,
 * no select labels), and it is not CSS-driven (fresh loads at 767, 768, 900,
 * 991 and 992px show the reference swapping the DOM at `md`, with the desktop
 * controls simply absent below it). The title moves in here because
 * `BrowsingGames_header`, which carries it on desktop, is `display: none` at
 * this width.
 */
function GamesToolbarMobile({ title, icon, filterLabel, sort, onSort, onSearch }) {
  return (
    <div className="GamesToolbar_root">
      <h1 className="Heading_root Heading_h3 Heading_truncate">
        {icon && <img alt="" className="PageHeader_icon" height="20" src={icon} width="20" />}
        <span className="Heading_truncateText">{title}</span>
      </h1>
      <div className="Flex_root Flex_sm4">
        <button type="button" className="IconButton_root" aria-label="Search games" onClick={onSearch}>
          <img alt="search" width="16" height="16" src="/icons/search.svg" />
        </button>
        <div className="GamesToolbar_selectWrapper">
          <div className="SelectMultiple_root">
            <div className="SelectMultiple_mobileButtonWrapper">
              <button type="button" className="SelectMultiple_mobileButton" aria-label={`Filter by ${filterLabel.replace(/^All /, "").toLowerCase()}`}>
                <img alt="filter" width="16" height="16" src="/icons/filters.svg" />
              </button>
            </div>
          </div>
        </div>
        <div className="GamesToolbar_selectWrapper">
          <div className="FormControlWrapper_root Select_formWrapper">
            <label className="sr-only">
              Sort
              <select name="sort" value={sort} onChange={(e) => onSort(e.target.value)}>
                {SORTS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="Select_mobileButton"
              aria-label="sort"
              onClick={() => onSort(SORTS[(SORTS.findIndex(([v]) => v === sort) + 1) % SORTS.length][0])}
            >
              <span className="Select_blockImg">
                <img alt="sort" width="16" height="16" src="/icons/sort-arrow.svg" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Search + filters + sort — reference `GamesToolbar`.
 *
 * `filterLabels` because the number of filters is per-page: a category browse
 * has one ("All Providers"), and Favourites has two ("All Categories" and
 * "All Providers"). `filterLabel` stays for the single-filter callers, which
 * is every other page.
 */
export function GamesToolbar({ query, onQuery, sort, onSort, title, icon, filterLabel = "All Providers", filterLabels, filters: filterDefs }) {
  /**
   * `filters` is the working form: `[{ label, value, options, onChange }]`.
   * `filterLabels` / `filterLabel` are the label-only form the pages that have
   * no filtering to do still pass, and they render as an inert button — which
   * is what every one of these was before `FilterSelect` existed.
   */
  const filters = filterDefs?.length
    ? filterDefs
    : (filterLabels?.length ? filterLabels : [filterLabel]).map((label) => ({ label }));
  // `md` — the width at which the reference swaps the whole toolbar. See
  // `GamesToolbarMobile`.
  const compact = useMediaQuery("(max-width: 991.98px)");

  if (compact) {
    return (
      <GamesToolbarMobile
        title={title}
        icon={icon}
        filterLabel={filterLabel}
        sort={sort}
        onSort={onSort}
        // No search overlay exists yet; clearing a stale query at least keeps
        // the grid honest when the field it was typed into is gone.
        onSearch={() => onQuery("")}
      />
    );
  }

  return (
    <div className="GamesToolbar_root">
      <div className="Flex_root Flex_wide Flex_sm4">
        <div className="SearchInput_root GamesToolbar_searchInputWrapper">
          <span className="SearchInput_label">
            <img alt="search" src="/icons/search.svg" />
          </span>
          <input className="SearchInput_input" placeholder="Search" value={query} onChange={(e) => onQuery(e.target.value)} aria-label="Search games" />
        </div>
        {filters.map((f) => (
          <div className="GamesToolbar_selectWrapper" key={f.label}>
            {f.options?.length ? (
              <FilterSelect label={f.label} value={f.value || ""} options={f.options} onChange={f.onChange} />
            ) : (
              // No options to offer, so nothing to open. The button is the
              // reference's, inert — as it was on every page before this.
              <div className="SelectMultiple_root">
                <button type="button" className="SelectButton_root SelectMultiple_select" aria-expanded="false">
                  <div className="SelectMultiple_filterLabelWrapper">
                    <span className="SelectMultiple_labelText">{f.label}</span>
                  </div>
                  <img alt="arrow" className="SelectMultiple_chevronIcon" src="/icons/chevron.svg" />
                </button>
              </div>
            )}
          </div>
        ))}
        <div className="GamesToolbar_selectWrapper">
          <SortSelect value={sort} options={SORTS} onChange={onSort} />
        </div>
      </div>
    </div>
  );
}

export function ShowMoreButton({ onClick }) {
  return (
    <button className="ShowMoreBackground_root CardGrid_background" type="button" onClick={onClick}>
      <div className="ShowMore_button">
        <div className="CircularLoadingIndicator_rotatingAnimationWrapper">
          <svg width="16" height="16" version="1.1" viewBox="0 0 200 200">
            <title>loading</title>
            <circle r="80" cx="100" cy="100" fill="transparent" strokeDasharray="502.64" strokeDashoffset="0" />
            <circle className="CircularLoadingIndicator_bar" r="80" cx="100" cy="100" fill="transparent" strokeDasharray="502.64" strokeDashoffset="0" />
          </svg>
        </div>
        <p>Show More</p>
        <img alt="arrow down" src="/icons/chevron.svg" />
      </div>
    </button>
  );
}

/**
 * Category browse page shared by Latest Releases and the casino categories
 * (Originals, Slots, Live Casino, …). Category lists were captured from the
 * reference's first render in its default "Featured" order.
 */
export function CategoryPage({ slug }) {
  const cat = categoryFor(slug);
  const isLatest = slug === "latest-releases";
  const title = isLatest ? "Latest Releases" : cat.title;
  const step = isLatest ? PAGE : CATEGORY_PAGE;

  const [count, setCount] = useState(step);
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("");
  const [sort, setSort] = useState(isLatest ? "RECENT_ADD" : "FEATURED");

  /**
   * The catalogue, where this slug can be expressed as a query.
   *
   * ── WHY THE PAGE USED TO SHOW SOMEBODY ELSE'S GAMES ──────────────────
   *
   * It never asked. `source` was the captured list and nothing else, so every
   * "View all" opened on shuffle.com's games rather than the 1,980 in this
   * catalogue — and for a category with `more: true` it CYCLED that list
   * (`sorted[i % sorted.length]`), so pressing Show More repeated the same
   * tiles instead of fetching another page.
   *
   * `useCategory` asks for real rows and keeps the capture only when the
   * answer is empty — which is still the right answer for Originals, Shuffle
   * Picks, Game Shows and Latest Releases. See `categoryQuery`.
   */
  const { games: liveGames = [], total: liveTotal = 0, isLive } = useCategory(slug, {
    captured: [],
    ...categoryQuery(slug),
    search: query.trim() || undefined,
    provider: provider || undefined,
    limit: count,
  });

  // The provider filter offers the studios this catalogue actually carries.
  const { providers: rosterProviders } = useProviders();
  const providerOptions = rosterProviders
    .filter((p) => p.hasGames)
    .map((p) => ({ value: p.name, label: p.label || p.name }));

  const source = isLive ? liveGames : isLatest ? pool : cat.games;

  /**
   * Searching and sorting a LIVE list happen at opposite ends.
   *
   * `search` and `provider` go to the backend, so they filter the whole
   * catalogue rather than the page on screen. Sorting stays here, because
   * `browse` has no sort key to pass — it is applied to the rows in hand, and
   * that limit is why the control is honest about being a preference.
   */
  const filtered = isLive
    ? source
    : source.filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase()));

  const sorted =
    sort === "POPULAR"
      ? [...filtered].reverse()
      : sort === "RANDOM"
        ? [...filtered].sort((a, b) => a.href.length - b.href.length)
        : filtered;

  /**
   * A live list pages against the real total. Only a captured category with
   * `more: true` still cycles — that is the reference's own behaviour on a list
   * it has no more rows for, and it applies to nothing that is live.
   */
  const endless = !isLive && !isLatest && cat.more && !query;
  const games = sorted.length
    ? Array.from({ length: Math.min(count, endless ? Infinity : sorted.length) }, (_, i) => sorted[i % sorted.length])
    : [];
  const hasMore = isLive ? games.length < liveTotal : endless || count < sorted.length;

  // The reference pre-renders the next page's cards hidden (`TallGameCard_hide`)
  // behind the Show More button. Only for a captured list — a live one has not
  // fetched those rows yet, so there is nothing to pre-render.
  const prefetched =
    !isLive && hasMore && !isLatest
      ? Array.from({ length: Math.min(step, endless ? step : sorted.length - count) }, (_, i) => sorted[(count + i) % sorted.length])
      : [];

  const seo = seos[`../data/seo-${isLatest ? "latest" : slug}.html`];

  return (
    <div>
      <PageHeader title={title} icon={categoryIcon(slug)} desktopOnly />

      <section className="LayoutContainer_root LayoutContainer_column">
        <GamesToolbar
          query={query}
          onQuery={(v) => {
            setQuery(v);
            // A new search starts at page one; keeping a grown limit would ask
            // the backend for 200 rows of a three-row result.
            setCount(step);
          }}
          sort={sort}
          onSort={setSort}
          title={title}
          icon={categoryIcon(slug)}
          filters={[
            {
              label: "All Providers",
              value: provider,
              options: providerOptions,
              onChange: (v) => {
                setProvider(v);
                setCount(step);
              },
            },
          ]}
        />
        <div className="CardGrid_cardGridWrapper">
          <div className="CardGrid_cardGridElement">
            {games.map((g, i) => (
              <GameCard key={(g.uuid || g.href) + i} game={g} index={i % 7} />
            ))}
            {prefetched.map((g, i) => (
              <GameCard key={`pre-${g.href}-${i}`} game={g} hidden />
            ))}
          </div>
          {hasMore && <ShowMoreButton onClick={() => setCount((c) => c + step)} />}
        </div>
      </section>

      <section className="LayoutContainer_root LayoutContainer_mobile-top-md2 LayoutContainer_mobile-bottom-md2 LayoutContainer_tablet-top-lg4 LayoutContainer_tablet-bottom-md2 LayoutContainer_column">
        <ProviderCarousel providers={rosterProviders.length ? rosterProviders : providers} />
      </section>

      <ActivityBoard hideTabs={["race"]} />

      {seo && <SeoArticle html={seo} />}
    </div>
  );
}

export default function LatestReleasesPage() {
  return <CategoryPage slug="latest-releases" />;
}
