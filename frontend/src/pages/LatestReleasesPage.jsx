import { useState } from "react";
import { GameCard } from "../components/casino/GameCarousel";
import ProviderCarousel from "../components/casino/ProviderCarousel";
import ActivityBoard from "../components/casino/ActivityBoard";
import { navigate } from "../lib/router";
import { providers, sections } from "../data/catalog";
import { categories } from "../data/categories";
import { cx } from "../lib/carousel";

/**
 * Category browse page — reference `/casino/categories/latest-releases`:
 * page header with back button, paginated card grid, providers rail,
 * bets board slot and the category's SEO copy.
 */

const PAGE = 28;
const CATEGORY_PAGE = 40;
const seos = import.meta.glob("../data/seo-*.html", { query: "?raw", import: "default", eager: true });
const pool = ["latest-releases", "slots", "game-shows", "shuffle-picks", "live-casino"].flatMap((id) => sections.find((s) => s.id === id)?.games || []);

export function PageHeader({ title }) {
  return (
    <div className="BrowsingGames_header">
      <div className="PageHeader_root">
        <section className="LayoutContainer_root LayoutContainer_column">
          <div className="Flex_root Flex_md2">
            <a className="TextLink_root PageHeader_backButton" href="/" aria-label="Back" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
              <img alt="back" src="/icons/chevron.svg" />
            </a>
            <h1 className="Heading_root Heading_h2 PageHeader_capitalize">{title}</h1>
          </div>
        </section>
      </div>
    </div>
  );
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

/** Search + provider filter + sort — reference `GamesToolbar`. */
export function GamesToolbar({ query, onQuery, sort, onSort }) {
  const label = SORTS.find(([v]) => v === sort)?.[1];
  return (
    <div className="GamesToolbar_root">
      <div className="Flex_root Flex_wide Flex_sm4">
        <div className="SearchInput_root GamesToolbar_searchInputWrapper">
          <span className="SearchInput_label">
            <img alt="search" src="/icons/search.svg" />
          </span>
          <input className="SearchInput_input" placeholder="Search" value={query} onChange={(e) => onQuery(e.target.value)} aria-label="Search games" />
        </div>
        <div className="GamesToolbar_selectWrapper">
          <div className="SelectMultiple_root">
            <button type="button" className="SelectButton_root SelectMultiple_select" aria-expanded="false">
              <div className="SelectMultiple_filterLabelWrapper">
                <span className="SelectMultiple_labelText">All Providers</span>
              </div>
              <img alt="arrow" className="SelectMultiple_chevronIcon" src="/icons/chevron.svg" />
            </button>
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
            <button type="button" aria-label="sort" aria-haspopup="listbox" aria-expanded="false" className="Select_button GamesToolbar_select" onClick={() => onSort(SORTS[(SORTS.findIndex(([v]) => v === sort) + 1) % SORTS.length][0])}>
              <span className="Select_item">
                <div className="Flex_root Flex_sm2 Select_labelPrefixWrapper">
                  Sort by:<span className="Select_labelValue">{label}</span>
                </div>
              </span>
              <img alt="Toggle dropdown menu" className="Select_chevronIcon" src="/icons/chevron.svg" />
            </button>
          </div>
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
  const cat = categories[slug];
  const isLatest = slug === "latest-releases";
  const title = isLatest ? "Latest Releases" : cat.title;
  const source = isLatest ? pool : cat.games;
  const [count, setCount] = useState(isLatest ? PAGE : CATEGORY_PAGE);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(isLatest ? "RECENT_ADD" : "FEATURED");
  const filtered = source.filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase()));
  const sorted = sort === "POPULAR" ? [...filtered].reverse() : sort === "RANDOM" ? [...filtered].sort((a, b) => a.href.length - b.href.length) : filtered;
  // Categories the reference keeps paging cycle the captured list when "Show More" is pressed.
  const endless = !isLatest && cat.more && !query;
  const games = sorted.length ? Array.from({ length: Math.min(count, endless ? Infinity : sorted.length) }, (_, i) => sorted[i % sorted.length]) : [];
  const hasMore = endless || count < sorted.length;
  // The reference pre-renders the next page's cards hidden (`TallGameCard_hide`) behind the Show More button.
  const step = isLatest ? PAGE : CATEGORY_PAGE;
  const prefetched = hasMore && !isLatest ? Array.from({ length: Math.min(step, endless ? step : sorted.length - count) }, (_, i) => sorted[(count + i) % sorted.length]) : [];
  const seo = seos[`../data/seo-${isLatest ? "latest" : slug}.html`];

  return (
    <div>
      <PageHeader title={title} />

      <section className="LayoutContainer_root LayoutContainer_column">
        <GamesToolbar query={query} onQuery={setQuery} sort={sort} onSort={setSort} />
        <div className="CardGrid_cardGridWrapper">
          <div className="CardGrid_cardGridElement">
            {games.map((g, i) => (
              <GameCard key={g.href + i} game={g} index={i % 7} />
            ))}
            {prefetched.map((g, i) => (
              <GameCard key={`pre-${g.href}-${i}`} game={g} hidden />
            ))}
          </div>
          {hasMore && <ShowMoreButton onClick={() => setCount((c) => c + step)} />}
        </div>
      </section>

      <section className="LayoutContainer_root LayoutContainer_mobile-top-md2 LayoutContainer_mobile-bottom-md2 LayoutContainer_tablet-top-lg4 LayoutContainer_tablet-bottom-md2 LayoutContainer_column">
        <ProviderCarousel providers={providers} />
      </section>

      <ActivityBoard hideTabs={["race"]} />

      {seo && <SeoArticle html={seo} />}
    </div>
  );
}

export default function LatestReleasesPage() {
  return <CategoryPage slug="latest-releases" />;
}
