import { useEffect, useMemo, useState } from "react";
import { PromotionTile } from "./PromotionsPage";
import { cx } from "../lib/carousel";
import { navigate } from "../lib/router";
import ActivityBoard from "../components/casino/ActivityBoard";
import ArticleBody, { QualifyingGames } from "../components/content/ArticleBody";
import PromotionSportEvents from "../components/content/PromotionSportEvents";
import PromotionTermsAccordion from "../components/content/PromotionTermsAccordion";
import { site } from "../lib/endpoints";
import { normalizeBlogHtml } from "../lib/blogContent";
import {
  fetchLivePromotionBoard,
  parsePromotionPath,
  promotionImageUrl,
  promotionToTile,
} from "../lib/promotions";

export default function PromotionArticlePage({ path }) {
  const parsed = useMemo(() => parsePromotionPath(path), [path]);
  const [post, setPost] = useState(null);
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const root = parsed?.segment === "sports" ? "/sports/promotions" : "/promotions";

  useEffect(() => {
    if (!parsed) {
      setLoading(false);
      setError("Promotion not found.");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await site.promotionBySlug(parsed.segment, parsed.slug);
        if (cancelled) return;
        setPost(data);
        const resolved = data.leaderboard ? await fetchLivePromotionBoard(data.leaderboard) : null;
        if (!cancelled) setBoard(resolved);
      } catch (e) {
        if (!cancelled) {
          setPost(null);
          setBoard(null);
          setError(e?.message || "Could not load this promotion.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parsed?.segment, parsed?.slug]);

  const tile = useMemo(() => (post ? promotionToTile(post) : null), [post]);
  const bodyHtml = useMemo(() => {
    if (!post?.description) return "";
    return normalizeBlogHtml(post.description, { subheading: post.summary });
  }, [post]);

  const tags = post?.tags || [];
  const hasTournament = Boolean(post?.tournamentPanel || board);

  if (loading) {
    return (
      <section className="LayoutContainer_root LayoutContainer_column">
        <p className="RichText_paragraph">Loading…</p>
      </section>
    );
  }

  if (error || !post || !tile) {
    return (
      <section className="LayoutContainer_root LayoutContainer_column">
        <p className="RichText_paragraph">{error || "Promotion not found."}</p>
        <button type="button" className="ButtonVariants_root ButtonVariants_primary" onClick={() => navigate(root)}>
          Back to promotions
        </button>
      </section>
    );
  }

  const img = promotionImageUrl(post.imageUrl);
  const title = post.title;
  const events = post.sportEvents || [];
  const games = post.qualifyingGames || [];

  return (
    <div>
      <main>
        <nav className="BlogAndPromotionArticle_nav">
          <section className="LayoutContainer_root LayoutContainer_mobile-top-lg LayoutContainer_mobile-bottom-lg LayoutContainer_tablet-top-lg1 LayoutContainer_tablet-bottom-lg1 LayoutContainer_column LayoutContainer_singleColumn">
            <div className="SportsBreadcrumbLayout_breadcrumbRoot">
              <button aria-label="back" className="SportsBreadcrumbLayout_backBtn" type="button" onClick={() => (window.history.length > 1 ? window.history.back() : navigate(root))}>
                <img alt="arrow left" src="/icons/arrow-left.svg" />
              </button>
              <ul className="BreadcrumbList_list">
                <li className="BreadcrumbItem_root BlogAndPromotionArticle_hiddenOnMobile">
                  <div className="BreadcrumbItem_name">
                    <span className="BreadcrumbItem_text">
                      <a className="BreadcrumbLink_root" href={root} onClick={(e) => { e.preventDefault(); navigate(root); }}>
                        <span>Promotions</span>
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
        <section
          className={cx(
            "LayoutContainer_root BlogAndPromotionArticle_container",
            hasTournament && "BlogAndPromotionArticle_hasTournament",
            "LayoutContainer_mobile-bottom-md2 LayoutContainer_tablet-bottom-lg1 LayoutContainer_column LayoutContainer_singleColumn"
          )}
        >
          {img && (
            <div className="BlogAndPromotionArticle_imageContainer">
              <img alt={post.imageAlt || title} className="BlogAndPromotionArticle_image" height={400} src={img} width={640} />
            </div>
          )}
          <article className="BlogAndPromotionArticle_body">
            <div className="BlogAndPromotionArticle_headingGroup">
              <h1 className="Heading_root Heading_h1 BlogAndPromotionArticle_heading">{title}</h1>
              {tile.ends && (
                <div className="PromotionsInfoDate_root">
                  <span className={cx("Tag_tagBlock Tag_md", tile.status === "ended" ? "Tag_ended" : "Tag_live")}>{tile.status === "ended" ? "Ended" : "LIVE"}</span>
                  {tile.status === "ended" ? "Ended" : "Ends"} {tile.ends}
                </div>
              )}
            </div>
            {games.length > 0 && <QualifyingGames games={games} viewAll={post.viewAllHref} />}
            {events.length > 0 && <PromotionSportEvents events={events} />}
            {bodyHtml ? (
              <>
                <ArticleBody html={bodyHtml} board={board} panel={post.tournamentPanel} />
                <PromotionTermsAccordion html={post.termsHtml} />
              </>
            ) : (
              <div className="RichText_richTextBlock">
                <p className="RichText_paragraph">This promotion is no longer available.</p>
              </div>
            )}
            {tags.length > 0 && (
              <div className="BlogAndPromotionArticle_tags">
                {tags.map((tag) => (
                  <a key={tag} href={`/blog?tag=${encodeURIComponent(tag)}`} onClick={(e) => { e.preventDefault(); navigate(`/blog?tag=${encodeURIComponent(tag)}`); }}>
                    <div className="BlogAndPromotionArticle_tag">{tag}</div>
                  </a>
                ))}
              </div>
            )}
          </article>
        </section>
      </main>
      <ActivityBoard hideTabs={["my-bets", "high-roller-bets", "race", "airDropRace"]} />
    </div>
  );
}
