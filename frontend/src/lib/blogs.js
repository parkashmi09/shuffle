/**
 * Blog posts from admin-service (`GET /admin/blogs`, public read).
 */

/** Turn `/api/v1/admin/blogs/:id/image` into a URL the browser can load (same-origin). */
export function blogImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  if (imageUrl.startsWith("/")) return imageUrl;
  const base = import.meta.env.VITE_API_BASE || "/api/v1";
  return `${base}/${imageUrl.replace(/^\//, "")}`;
}

export function formatBlogDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map an API row to the promotion tile shape used on the blog list. */
export function blogToTile(post) {
  const slug = post.slug;
  return {
    href: `/blog/${slug}`,
    slug,
    title: post.title,
    text: post.subheading || stripHtml(post.description).slice(0, 220),
    img: blogImageUrl(post.imageUrl) || "/images/banners/vip-hero-banner.png",
    alt: post.title,
    h: 400,
    w: 640,
    date: formatBlogDate(post.date || post.publishedAt),
    category: post.category,
  };
}

const TAB_CATEGORY = {
  casino: "Casino",
  sports: "Sports",
  crypto: "Crypto",
  shuffleNews: "Shuffle news",
};

export function blogListQuery(tab, page, limit = 9) {
  const query = { page, limit };
  const mapped = TAB_CATEGORY[tab];
  if (mapped) query.category = mapped;
  return query;
}

/** Client-side filter for tabs that are not a single API category. */
/** Up to `limit` other posts — same category first, then newest elsewhere. */
export function pickRelatedPosts(posts, currentSlug, category, limit = 3) {
  const others = (posts || []).filter((p) => p.slug && p.slug !== currentSlug);
  if (!others.length) return [];

  const cat = String(category || "").toLowerCase();
  const same = others.filter((p) => String(p.category || "").toLowerCase() === cat && cat);
  const different = others.filter((p) => !cat || String(p.category || "").toLowerCase() !== cat);

  const byNewest = (a, b) => {
    const ta = Date.parse(a.publishedAt || a.date || a.createdAt || 0);
    const tb = Date.parse(b.publishedAt || b.date || b.createdAt || 0);
    return tb - ta;
  };

  const ordered = [...same.sort(byNewest), ...different.sort(byNewest)];
  const seen = new Set();
  const out = [];
  for (const p of ordered) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

export function matchesBlogTab(post, tab) {
  if (tab === "all") return true;
  if (TAB_CATEGORY[tab]) {
    return String(post.category || "").toLowerCase() === TAB_CATEGORY[tab].toLowerCase();
  }
  const cat = String(post.category || "").toLowerCase();
  const title = String(post.title || "");
  if (tab === "howTo") return /^how to/i.test(title);
  if (tab === "shuffleNews") return cat.includes("shuffle") || cat.includes("news");
  if (tab === "other") {
    const known = ["casino", "sports", "crypto", "shuffle", "news"];
    if (/^how to/i.test(title)) return false;
    return !known.some((k) => cat.includes(k));
  }
  return cat.includes(tab);
}
