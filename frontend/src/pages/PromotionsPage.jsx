import { useEffect, useMemo, useState } from "react";
import { cx } from "../lib/carousel";
import { navigate } from "../lib/router";
import { site } from "../lib/endpoints";
import { matchesPromotionTab, promotionListQuery, promotionToTile } from "../lib/promotions";

const TABS = [
  { id: "all", label: "All", icon: "/icons/sports-leagues.svg" },
  { id: "casino", label: "Casino", icon: "/icons/dice.svg" },
  { id: "sports", label: "Sports", icon: "/icons/sports.svg" },
];
const PER_PAGE = 9;

export function PromotionTile({ tile, featured = false, meta }) {
  return (
    <a className="BlogAndPromotionTile_link" data-testid="promotions-tile" href={tile.href} onClick={(e) => { e.preventDefault(); navigate(tile.href); }}>
      <section className={cx("BlogAndPromotionTile_root", featured && "BlogAndPromotionTile_featured")}>
        <div>
          <div className="BlogAndPromotionTile_imagePlaceholder">
            <img alt={tile.alt} className="BlogAndPromotionTile_image" height={tile.h} src={tile.img} width={tile.w} />
          </div>
        </div>
        <div className="BlogAndPromotionTile_content">
          <h2 className="Heading_root Heading_h2">{tile.title}</h2>
          {meta}
          {tile.ends && (
            <div className="PromotionsInfoDate_root">
              <span className={cx("Tag_tagBlock Tag_md", tile.status === "ended" ? "Tag_ended" : "Tag_live")}>{tile.status === "ended" ? "Ended" : "LIVE"}</span>
              {tile.status === "ended" ? "Ended" : "Ends"} {tile.ends}
            </div>
          )}
          <p className="BlogAndPromotionTile_text">{tile.text}</p>
        </div>
      </section>
    </a>
  );
}

export function Pagination({ page, total, onChange, className = "PromotionList_pagination" }) {
  const lo = Math.max(1, page - 2);
  const hi = Math.min(total, page + 2);
  const items = [];
  if (lo > 1) {
    items.push(1);
    if (lo > 2) items.push("…");
  }
  for (let i = lo; i <= hi; i++) items.push(i);
  if (hi < total) {
    if (hi < total - 1) items.push("…");
    items.push(total);
  }
  return (
    <ul className={cx("Pagination_root", className)}>
      {page > 1 && (
        <li className="Pagination_item">
          <button type="button" aria-label="previous page" onClick={() => onChange(page - 1)}>
            <img alt="arrow right" className="Pagination_left" src="/icons/chevron.svg" />
          </button>
        </li>
      )}
      {items.map((it, i) =>
        it === "…" ? (
          <li key={`e${i}`} className="Pagination_item">
            ...
          </li>
        ) : (
          <li key={it} className="Pagination_item">
            <button className={it === page ? "Pagination_active" : ""} type="button" onClick={() => onChange(it)}>
              {it}
            </button>
          </li>
        )
      )}
      {page < total && (
        <li className="Pagination_item">
          <button type="button" aria-label="next page" onClick={() => onChange(page + 1)}>
            <img alt="arrow right" className="Pagination_right" src="/icons/chevron.svg" />
          </button>
        </li>
      )}
    </ul>
  );
}

export default function PromotionsPage() {
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
        const { data, meta } = await site.promotions(promotionListQuery(tab, page, PER_PAGE));
        if (cancelled) return;
        const list = (Array.isArray(data) ? data : []).filter((p) => matchesPromotionTab(promotionToTile(p), tab));
        setRows(list);
        setTotalPages(meta?.pagination?.totalPages ?? 1);
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          setError(e?.message || "Could not load promotions.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, page]);

  const tiles = useMemo(() => rows.map(promotionToTile), [rows]);
  const featured = page === 1 ? tiles.find((t) => t.featured) || tiles[0] : null;
  const rest = featured ? tiles.filter((t) => t.href !== featured.href) : tiles;
  const list = rest.slice(0, PER_PAGE);

  const changeTab = (id) => {
    setTab(id);
    setPage(1);
    document.querySelector("#pageContent")?.scrollTo(0, 0);
  };
  const changePage = (p) => {
    setPage(p);
    document.querySelector("#pageContent")?.scrollTo(0, 0);
  };

  return (
    <div>
      <section className="LayoutContainer_root LayoutContainer_mobile-top-lg1 LayoutContainer_tablet-top-lg2 LayoutContainer_column">
        <h1 className="Heading_root Heading_h1 PromotionList_heading">promotions</h1>
        <div className="Tab_root PromotionList_tab">
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
                onClick={() => changeTab(t.id)}
              >
                <span className="Tab_icon">
                  <img alt={t.id} src={t.icon} />
                </span>
                <p className="Tab_text">{t.label}</p>
              </button>
            ))}
          </div>
        </div>
        <div>
          {loading ? (
            <p className="BlogLists_notFound">Loading promotions…</p>
          ) : error ? (
            <p className="BlogLists_notFound">{error}</p>
          ) : tiles.length === 0 ? (
            <p className="BlogLists_notFound">No promotions yet. Publish promotions from the admin panel to see them here.</p>
          ) : (
            <>
              {featured && (
                <>
                  <PromotionTile tile={featured} featured />
                  <hr className="PromotionList_linebreak" />
                </>
              )}
              <div className="BlogLists_root">
                {list.map((t) => (
                  <PromotionTile key={t.href} tile={t} />
                ))}
              </div>
              <Pagination page={page} total={totalPages} onChange={changePage} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
