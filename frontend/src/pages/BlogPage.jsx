import { useEffect, useMemo, useState } from "react";
import { cx } from "../lib/carousel";
import { Pagination, PromotionTile } from "./PromotionsPage";
import { site } from "../lib/endpoints";
import { blogListQuery, blogToTile, matchesBlogTab } from "../lib/blogs";

const TABS = [
  { id: "all", label: "All", alt: "all", icon: "/icons/sports-leagues.svg" },
  { id: "casino", label: "Casino", alt: "casino", icon: "/icons/dice.svg" },
  { id: "sports", label: "Sports", alt: "sports", icon: "/icons/sports.svg" },
  { id: "crypto", label: "Crypto", alt: "crypto", icon: "/icons/token-white.svg" },
  { id: "howTo", label: "How to", alt: "guide", icon: "/icons/guide.svg" },
  { id: "shuffleNews", label: "Shuffle news", alt: "play", icon: "/icons/play.svg" },
  { id: "other", label: "Other ", alt: "others", icon: "/icons/other.svg" },
];

const PER_PAGE = 9;

export default function BlogPage() {
  const [tab, setTab] = useState("all");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const needsClientFilter = tab === "howTo" || tab === "other" || tab === "all";
        const limit = needsClientFilter && tab !== "all" ? 100 : PER_PAGE;
        const { data, meta } = await site.blogs(blogListQuery(tab, page, limit));
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        const filtered = needsClientFilter ? list.filter((p) => matchesBlogTab(p, tab)) : list;
        setRows(filtered);
        const apiPages = meta?.pagination?.totalPages ?? 1;
        setTotalPages(needsClientFilter ? Math.max(1, Math.ceil(filtered.length / PER_PAGE)) : apiPages);
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          setError(e?.message || "Could not load blog posts.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, page]);

  const tiles = useMemo(() => rows.map(blogToTile), [rows]);
  const featured = tab === "all" && page === 1 ? tiles[0] : null;
  const rest = tab === "all" && page === 1 ? tiles.slice(1) : tiles;
  const list = rest.slice(0, PER_PAGE);

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
                onClick={() => {
                  setTab(t.id);
                  setPage(1);
                  scrollTop();
                }}
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
          {loading ? (
            <p className="BlogLists_notFound">Loading articles…</p>
          ) : error ? (
            <p className="BlogLists_notFound">{error}</p>
          ) : tiles.length === 0 ? (
            <p className="BlogLists_notFound">No articles yet. Publish posts from the admin panel to see them here.</p>
          ) : (
            <>
              {page === 1 && featured && (
                <>
                  <PromotionTile tile={featured} featured meta={<p className="BlogAndPromotionTile_date">{featured.date}</p>} />
                  <hr className="BlogList_linebreak" />
                </>
              )}
              <div className="BlogLists_root">
                {list.map((t) => (
                  <PromotionTile key={t.href} tile={t} meta={<p className="BlogAndPromotionTile_date">{t.date}</p>} />
                ))}
              </div>
              {totalPages > 1 && (
                <Pagination
                  page={page}
                  total={totalPages}
                  className="BlogList_pagination"
                  onChange={(p) => {
                    setPage(p);
                    scrollTop();
                  }}
                />
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
