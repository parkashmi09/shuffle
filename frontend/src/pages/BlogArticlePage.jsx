import { useEffect, useMemo, useState } from "react";
import { navigate } from "../lib/router";
import { site } from "../lib/endpoints";
import { blogImageUrl, blogToTile, formatBlogDate, pickRelatedPosts } from "../lib/blogs";
import { normalizeBlogHtml } from "../lib/blogContent";
import ArticleBody from "../components/content/ArticleBody";
import { PromotionTile } from "./PromotionsPage";
import { cx } from "../lib/carousel";

export default function BlogArticlePage({ slug }) {
  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await site.blogBySlug(slug);
        if (cancelled) return;
        setPost(data);

        try {
          const { data: list } = await site.blogs({ page: 1, limit: 50 });
          const rows = Array.isArray(list) ? list : [];
          if (!cancelled) {
            setRelated(pickRelatedPosts(rows, data.slug, data.category, 3).map(blogToTile));
          }
        } catch {
          if (!cancelled) setRelated([]);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || "Could not load this article.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const bodyHtml = useMemo(() => {
    if (!post) return "";
    return normalizeBlogHtml(post.description, {
      category: post.category,
      subheading: post.subheading,
    });
  }, [post]);

  if (loading) {
    return (
      <section className="LayoutContainer_root LayoutContainer_column">
        <p className="RichText_paragraph">Loading…</p>
      </section>
    );
  }

  if (error || !post) {
    return (
      <section className="LayoutContainer_root LayoutContainer_column">
        <p className="RichText_paragraph">{error || "Article not found."}</p>
        <button type="button" className="ButtonVariants_root ButtonVariants_primary" onClick={() => navigate("/blog")}>
          Back to blog
        </button>
      </section>
    );
  }

  const img = blogImageUrl(post.imageUrl);
  const date = formatBlogDate(post.date || post.publishedAt);

  return (
    <div>
      <main>
        <nav className="BlogAndPromotionArticle_nav">
          <section className="LayoutContainer_root LayoutContainer_mobile-top-lg LayoutContainer_mobile-bottom-lg LayoutContainer_tablet-top-lg1 LayoutContainer_tablet-bottom-lg1 LayoutContainer_column LayoutContainer_singleColumn">
            <div className="SportsBreadcrumbLayout_breadcrumbRoot">
              <button
                aria-label="back"
                className="SportsBreadcrumbLayout_backBtn"
                type="button"
                onClick={() => (window.history.length > 1 ? window.history.back() : navigate("/blog"))}
              >
                <img alt="arrow left" src="/icons/arrow-left.svg" />
              </button>
              <ul className="BreadcrumbList_list">
                <li className="BreadcrumbItem_root BlogAndPromotionArticle_hiddenOnMobile">
                  <div className="BreadcrumbItem_name">
                    <span className="BreadcrumbItem_text">
                      <a
                        className="BreadcrumbLink_root"
                        href="/blog"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate("/blog");
                        }}
                      >
                        <span>Blog</span>
                      </a>
                    </span>
                  </div>
                </li>
                <li className="BreadcrumbSeparator_separator BlogAndPromotionArticle_hiddenOnMobile" />
                <li className="BreadcrumbItem_root BreadcrumbItem_active">
                  <div className="BreadcrumbItem_name">
                    <span className="BreadcrumbItem_text">{post.title}</span>
                  </div>
                </li>
              </ul>
            </div>
          </section>
        </nav>
        <section
          className={cx(
            "LayoutContainer_root BlogAndPromotionArticle_container",
            related.length > 0 && "BlogAndPromotionArticle_hasRelated",
            "LayoutContainer_mobile-bottom-md2 LayoutContainer_tablet-bottom-lg1 LayoutContainer_column LayoutContainer_singleColumn"
          )}
        >
          {img && (
            <div className="BlogAndPromotionArticle_imageContainer">
              <img alt={post.title} className="BlogAndPromotionArticle_image" height={400} src={img} width={640} />
            </div>
          )}
          <article className="BlogAndPromotionArticle_body">
            <div className="BlogAndPromotionArticle_headingGroup">
              <h1 className="Heading_root Heading_h1 BlogAndPromotionArticle_heading">{post.title}</h1>
              {date && <p className="PromotionsInfoDate_root">{date}</p>}
            </div>
            {bodyHtml ? <ArticleBody html={bodyHtml} /> : (
              <div className="RichText_richTextBlock">
                <p className="RichText_paragraph">This article has no content yet.</p>
              </div>
            )}
          </article>
        </section>
        {related.length > 0 ? (
          <section
            className={cx(
              "LayoutContainer_root",
              "LayoutContainer_column",
              "LayoutContainer_mobile-top-lg",
              "LayoutContainer_tablet-top-lg1",
              "BlogAndPromotionArticle_relatedBlogs"
            )}
          >
            <hr className="BlogAndPromotionArticle_lineBreakRelated" />
            <h2 className="Heading_root Heading_h2 BlogAndPromotionArticle_relatedBlogsHeading">Related articles</h2>
            <div className="BlogLists_root">
              {related.map((t) => (
                <PromotionTile key={t.href} tile={t} meta={<p className="BlogAndPromotionTile_date">{t.date}</p>} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
