import { useState } from "react";
import { cx } from "../../lib/carousel";
import article from "../../data/seo-article.html?raw";

// The saved article carries its own wrapper + show-more button; keep only the rich-text block.
const inner = (() => {
  const start = article.indexOf('<div class="RichText_richTextBlock');
  const end = article.indexOf('<div class="ShowMoreOverlayButton_wrapper">');
  return article.slice(start, end > 0 ? end : undefined);
})();

/** Collapsible SEO copy under the lobby — reference `SEOArticle`. */
export default function SeoArticle() {
  const [open, setOpen] = useState(false);

  return (
    <section className="LayoutContainer_root LayoutContainer_mobile-bottom-md2 LayoutContainer_tablet-bottom-lg4 LayoutContainer_column SEOArticle_section">
      <div className={cx("SEOArticle_articleContent", open && "SEOArticle_showMore")}>
        <div dangerouslySetInnerHTML={{ __html: inner }} />
        {open ? (
          <div>
            <button
              className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary ShowMoreOverlayButton_root ShowMoreOverlayButton_btnNoOverlay"
              type="button"
              onClick={() => setOpen(false)}
            >
              <span className="ButtonVariants_buttonContent">Show Less</span>
            </button>
          </div>
        ) : (
          <div className="ShowMoreOverlayButton_wrapper">
            <div className="ShowMoreOverlayButton_overlay" />
            <button
              className="ButtonVariants_root ButtonVariants_buttonHeightMedium ButtonVariants_primary ShowMoreOverlayButton_root ShowMoreOverlayButton_btnOverlay"
              type="button"
              onClick={() => setOpen(true)}
            >
              <span className="ButtonVariants_buttonContent">Show More</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
