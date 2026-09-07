import { useEffect, useRef, useState } from "react";
import { CarouselHeader, SwipeTrack } from "../components/ui/Carousel";
import { GameCard } from "../components/casino/GameCarousel";
import { UserCell } from "../components/casino/PromoWidgets";
import { PromotionTile } from "./PromotionsPage";
import { cx, useCarousel } from "../lib/carousel";
import { navigate } from "../lib/router";
import ActivityBoard from "../components/casino/ActivityBoard";
import promoData from "../data/promotions.json";
import blogData from "../data/blog.json";

/**
 * Promotion detail — reference `/promotions/<slug>`: breadcrumb bar with a
 * back button, the hero image, the article (heading, optional qualifying
 * games carousel, rich text, terms accordion) and the tag chips.
 */

const promoBodies = import.meta.glob("../data/promotions/*.html", { query: "?raw", import: "default", eager: true });
const blogBodies = import.meta.glob("../data/blog/*.html", { query: "?raw", import: "default", eager: true });
const sources = {
  promotions: { data: promoData, bodies: promoBodies, dir: "promotions", root: "/promotions", label: "Promotions" },
  blog: { data: blogData, bodies: blogBodies, dir: "blog", root: "/blog", label: "Blog" },
};
const bodyFor = (src, href) => src.bodies[`../data/${src.dir}/${href.replace(/^\//, "").replace(/\//g, "__")}.html`] || "";

const ordinal = (n) => `${n}${["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;

/** Tournament standings — reference `TournamentInfoLeaderboard`: table plus pager, client-rendered on the original. */
function Leaderboard({ board }) {
  const [page, setPage] = useState(1);
  const total = board.pages || 1;
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
  const ranked = board.columns[0] === "Rank";
  return (
    <div className="Flex_root Flex_column Flex_md2">
      <div className="Table_root">
        <table className="Table_table">
          <thead>
            <tr>
              {board.columns.map((c, i) => (
                <td key={c} width={board.widths[i]}>
                  {c}
                </td>
              ))}
            </tr>
          </thead>
          <tbody className={cx("TableBody_tbody TableBody_even", ranked && "TableBody_withClick")} data-testid="table-body">
            {board.rows.map((row, i) => (
              <tr key={i} {...(ranked ? { role: "button", "aria-label": "View detail", tabIndex: 0 } : {})}>
                {ranked && (
                  <td>
                    <p>{ordinal(row.rank)}</p>
                  </td>
                )}
                <td>
                  <UserCell user={row.user} />
                </td>
                <td>
                  <span className="TournamentInfoLeaderboard_tableCell">
                    {board.kind === "multiplier" ? (
                      <span className="MultiplierCell_root">
                        <img alt="increase" height="16" src="/icons/multi-increase.svg" width="16" />
                        <span>{row.score}</span>
                      </span>
                    ) : board.kind === "payout" ? (
                      <div className="FormattedUsdAmountWithTooltip_flex">
                        <img alt="USD" height="16" src="/icons/fiat/USD.svg" width="16" />
                        <span className="Tooltip_trigger">{row.score}</span>
                      </div>
                    ) : (
                      <span className="Tooltip_trigger">
                        <p className="FormattedTournamentScores_tableDate">{row.score}</p>
                      </span>
                    )}
                  </span>
                </td>
                <td>
                  <span className="TournamentInfoLeaderboard_tableCell TournamentInfoLeaderboard_tablePrize">
                    <span className="IconValue_root FormattedAmount_root">
                      <img alt="USD" height="16" src="/icons/fiat/USD.svg" width="16" />
                      {row.prize}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="Pagination_root">
        {page > 1 && (
          <li className="Pagination_item">
            <button type="button" aria-label="previous page" onClick={() => setPage(page - 1)}>
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
              <button className={it === page ? "Pagination_active" : ""} type="button" onClick={() => setPage(it)}>
                {it}
              </button>
            </li>
          )
        )}
        {page < total && (
          <li className="Pagination_item">
            <button type="button" aria-label="next page" onClick={() => setPage(page + 1)}>
              <img alt="arrow right" className="Pagination_right" src="/icons/chevron.svg" />
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

function QualifyingGames({ href, viewAll }) {
  const { trackRef, carousel } = useCarousel();
  // Qualifying games captured from the reference tournament pages.
  const games = promoData.games[href] || [];
  return (
    <section className="CasinoTournamentContent_carousel">
      <CarouselHeader className="CasinoTournamentContent_carouselHeader" href={viewAll} carousel={carousel}>
        <a className="TextLink_root" href={viewAll} onClick={(e) => e.preventDefault()}>
          Qualifying Games
        </a>
      </CarouselHeader>
      <SwipeTrack trackRef={trackRef} carousel={carousel} className="CasinoTournamentContent_carouselContent">
        {games.map((g, i) => (
          <GameCard key={g.href + i} game={g} index={i} indicator={g.indicator} />
        ))}
      </SwipeTrack>
    </section>
  );
}

/** Countdown + prize details that the reference renders above the standings. */
function TournamentPanel({ panel }) {
  const target = panel.endsAt ? Date.parse(panel.endsAt) : NaN;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (Number.isNaN(target)) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  const left = Math.max(0, Math.floor((target - now) / 1000));
  const parts = Number.isNaN(target)
    ? []
    : [
        [Math.floor(left / 86400), "Days"],
        [Math.floor((left % 86400) / 3600), "Hours"],
        [Math.floor((left % 3600) / 60), "Minutes"],
        [left % 60, "Seconds"],
      ];
  const rows = [
    ["Ends", panel.ends],
    ["Prize Pool", panel.prizePool],
    ["Prize Split", panel.prizeSplit],
  ].filter((r) => r[1]);
  return (
    <>
      {parts.length > 0 && (
        <div className="TournamentCounter_root">
          <div className="TournamentCounter_countDown">
            {parts.map(([value, label]) => (
              <div key={label} className="TournamentCounter_countDownItem">
                <span>{value}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {rows.length > 0 && (
        <div className="ModalListContainer_root">
          {rows.map(([label, value]) => (
            <div key={label} className="ModalListContainer_item">
              <span className="ModalListContainer_label">{label}</span>
              <span className="ModalListContainer_value">{value}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** Reference rich text rendered as-is; accordions and internal links are wired up after mount. */
function ArticleBody({ html, board, panel }) {
  const ref = useRef(null);
  const slotRef = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const onClick = (e) => {
      const btn = e.target.closest(".Accordion_accordionHeader");
      if (btn && root.contains(btn)) {
        const acc = btn.closest(".Accordion_root");
        const open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        btn.querySelector(".Accordion_accordionHeaderLeft")?.classList.toggle("Accordion_headingOpen", !open);
        btn.querySelector(".Accordion_chevronWrapper")?.classList.toggle("Accordion_open", !open);
        acc.querySelectorAll(".Accordion_contentHeight .Accordion_content").forEach((c) => c.classList.toggle("Accordion_openContent", !open));
        return;
      }
      const a = e.target.closest("a[href]");
      if (!a || !root.contains(a)) return;
      const href = a.getAttribute("href");
      if (href.startsWith("/")) {
        e.preventDefault();
        if (/^\/(sports\/)?promotions\/|^\/blog\//.test(href)) navigate(href);
      } else if (href.startsWith("https://shuffle.com/")) {
        e.preventDefault();
      }
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [html]);
  // The reference keeps an empty flex column after the rules that the leaderboard renders into.
  const [head, tail] = html.split('<div class="Flex_root Flex_column Flex_md2"></div>');
  return (
    <>
      <div ref={ref} style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: head }} />
      {tail !== undefined && panel && <TournamentPanel panel={panel} />}
      {board && tail !== undefined && <Leaderboard board={board} />}
      {tail !== undefined && <div ref={slotRef} style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: tail }} />}
    </>
  );
}

export default function PromotionArticlePage({ path, kind = "promotions" }) {
  const src = sources[kind];
  const data = src.data;
  const info = data.details[path];
  const html = bodyFor(src, path);
  const tile = data.tiles.find((t) => t.href === path);
  const title = info?.title || tile?.title || "Promotion";
  const img = info?.img || tile?.img;
  // Blog posts end with three related articles — other posts sharing a tag, newest first.
  const tags = info?.tags || [];
  const related =
    kind === "blog"
      ? [...data.tiles.filter((t) => t.href !== path && data.details[t.href]?.tags?.some((tg) => tags.includes(tg))), ...data.tiles.filter((t) => t.href !== path)]
          .filter((t, i, arr) => arr.indexOf(t) === i)
          .slice(0, 3)
      : [];

  return (
    <div>
      <main>
        <nav className="BlogAndPromotionArticle_nav">
          <section className="LayoutContainer_root LayoutContainer_mobile-top-lg LayoutContainer_mobile-bottom-lg LayoutContainer_tablet-top-lg1 LayoutContainer_tablet-bottom-lg1 LayoutContainer_column LayoutContainer_singleColumn">
            <div className="SportsBreadcrumbLayout_breadcrumbRoot">
              <button aria-label="back" className="SportsBreadcrumbLayout_backBtn" type="button" onClick={() => (window.history.length > 1 ? window.history.back() : navigate(src.root))}>
                <img alt="arrow left" src="/icons/arrow-left.svg" />
              </button>
              <ul className="BreadcrumbList_list">
                <li className="BreadcrumbItem_root BlogAndPromotionArticle_hiddenOnMobile">
                  <div className="BreadcrumbItem_name">
                    <span className="BreadcrumbItem_text">
                      <a className="BreadcrumbLink_root" href={src.root} onClick={(e) => { e.preventDefault(); navigate(src.root); }}>
                        <span>{src.label}</span>
                      </a>
                    </span>
                  </div>
                </li>
                <li className="BreadcrumbSeparator_separator BlogAndPromotionArticle_hiddenOnMobile" />
                <li className="BreadcrumbItem_root BreadcrumbItem_active">
                  <div className="BreadcrumbItem_name">
                    <span className="BreadcrumbItem_text">{title}</span>
                  </div>
                </li>
              </ul>
            </div>
          </section>
        </nav>
        <section className={cx("LayoutContainer_root BlogAndPromotionArticle_container", related.length > 0 && "BlogAndPromotionArticle_hasRelated", "LayoutContainer_mobile-bottom-md2 LayoutContainer_tablet-bottom-lg1 LayoutContainer_column LayoutContainer_singleColumn")}>
          {img && (
            <div className="BlogAndPromotionArticle_imageContainer">
              <img alt={info?.alt || title} className="BlogAndPromotionArticle_image" height={info?.h || tile?.h} src={img} width={info?.w || tile?.w} />
            </div>
          )}
          <article className="BlogAndPromotionArticle_body">
            <div className="BlogAndPromotionArticle_headingGroup">
              <h1 className="Heading_root Heading_h1 BlogAndPromotionArticle_heading">{title}</h1>
              {tile?.date && <p className="PromotionsInfoDate_root">{tile.date}</p>}
              {tile?.ends && (
                <div className="PromotionsInfoDate_root">
                  <span className={cx("Tag_tagBlock Tag_md", tile.status === "ended" ? "Tag_ended" : "Tag_live")}>{tile.status === "ended" ? "Ended" : "LIVE"}</span>
                  {tile.status === "ended" ? "Ended" : "Ends"} {tile.ends}
                </div>
              )}
            </div>
            {info?.games && <QualifyingGames href={path} viewAll={info.viewAll} />}
            {html ? (
              <ArticleBody key={path} board={data.boards?.[path]} html={html} panel={data.panels?.[path]} />
            ) : (
              <div className="RichText_richTextBlock">
                <p className="RichText_paragraph">This promotion is no longer available.</p>
              </div>
            )}
          </article>
        </section>
        {related.length > 0 && (
          <section className="LayoutContainer_root LayoutContainer_column">
            <hr className="BlogAndPromotionArticle_lineBreakRelated" />
            <h2 className="Heading_root Heading_h2 BlogAndPromotionArticle_relatedBlogsHeading">Related articles</h2>
            <div className="BlogLists_root">
              {related.map((t) => (
                <PromotionTile key={t.href} tile={t} meta={<p className="BlogAndPromotionTile_date">{t.date}</p>} />
              ))}
            </div>
          </section>
        )}
      </main>
      {kind === "promotions" && <ActivityBoard hideTabs={["my-bets", "high-roller-bets", "race", "airDropRace"]} />}
    </div>
  );
}
