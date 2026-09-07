import { useState } from "react";
import { cx } from "../lib/carousel";
import { Pagination, PromotionTile } from "./PromotionsPage";
import data from "../data/blog.json";

/**
 * Blog listing — reference `/blog`: same tile layout as the promotions list
 * with a seven-tab category strip, a publish date on each tile and a 13-page pager.
 */

const TABS = [
  { id: "all", label: "All", alt: "all", icon: "/icons/sports-leagues.svg" },
  { id: "casino", label: "Casino", alt: "casino", icon: "/icons/dice.svg" },
  { id: "sports", label: "Sports", alt: "sports", icon: "/icons/sports.svg" },
  { id: "crypto", label: "Crypto", alt: "token", icon: "/icons/token-white.svg" },
  { id: "howTo", label: "How to", alt: "guide", icon: "/icons/guide.svg" },
  { id: "shuffleNews", label: "Shuffle news", alt: "play", icon: "/icons/play.svg" },
  { id: "other", label: "Other ", alt: "others", icon: "/icons/other.svg" },
];
const PER_PAGE = 9;
const TOTAL_PAGES = 13;

const tagsOf = (tile) => data.details[tile.href]?.tags || [];
const matches = (tile, tab) => {
  if (tab === "all") return true;
  if (tab === "howTo") return /^how to/i.test(tile.title);
  return tagsOf(tile).includes(tab);
};

export default function BlogPage() {
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const pool = data.tiles.filter((t) => matches(t, tab));
  // Only the "All" tab leads with the featured tile; the category tabs go straight to the grid.
  const featured = tab === "all" ? pool[0] : null;
  const rest = tab === "all" ? pool.slice(1) : pool;
  const pages = Math.max(1, Math.ceil(rest.length / PER_PAGE));
  const total = tab === "all" ? TOTAL_PAGES : pages;
  const start = (((page - 1) % pages) * PER_PAGE) % Math.max(1, rest.length);
  const list = rest.length ? Array.from({ length: Math.min(PER_PAGE, rest.length) }, (_, i) => rest[(start + i) % rest.length]) : [];
  const scrollTop = () => document.querySelector("#pageContent")?.scrollTo(0, 0);

  return (
    <div>
      <section className="LayoutContainer_root LayoutContainer_mobile-top-lg1 LayoutContainer_mobile-bottom-lg1 LayoutContainer_tablet-top-lg2 LayoutContainer_tablet-bottom-lg2 LayoutContainer_column">
        <h1 className="Heading_root Heading_h1 BlogList_heading">Blog</h1>
        <div className="Tab_root BlogList_tab">
          <div className="Tab_tabsContainer" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                aria-selected={tab === t.id}
                className={cx("Tab_tab", tab === t.id && "Tab_active")}
                data-testid={t.id}
                disabled={tab === t.id}
                id={t.id}
                role="tab"
                type="button"
                value={t.id}
                onClick={() => { setTab(t.id); setPage(1); scrollTop(); }}
              >
                <span className="Tab_icon">
                  <img alt={t.alt} src={t.icon} />
                </span>
                <p className="Tab_text">{t.label}</p>
              </button>
            ))}
          </div>
        </div>
        <div>
          {pool.length === 0 ? (
            <p className="BlogLists_notFound">No articles found</p>
          ) : (
            <>
              {page === 1 && featured && (
                <>
                  <PromotionTile tile={featured} featured meta={<p className="BlogAndPromotionTile_date">{featured.date}</p>} />
                  <hr className="BlogList_linebreak" />
                </>
              )}
              <div className="BlogLists_root">
                {list.map((t, i) => (
                  <PromotionTile key={`${t.href}-${i}`} tile={t} meta={<p className="BlogAndPromotionTile_date">{t.date}</p>} />
                ))}
              </div>
              <Pagination page={page} total={total} className="BlogList_pagination" onChange={(p) => { setPage(p); scrollTop(); }} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
