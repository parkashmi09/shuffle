/**
 * Promotions from admin-service (`GET /admin/promotions`, public read).
 */

import { betHistory } from "./endpoints";
import { formatBlogDate, stripHtml } from "./blogs";

export function promotionImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  if (imageUrl.startsWith("/")) return imageUrl;
  const base = import.meta.env.VITE_API_BASE || "/api/v1";
  return `${base}/${imageUrl.replace(/^\//, "")}`;
}

export function formatPromoEnds(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function promotionHref(segment, slug) {
  return segment === "sports" ? `/sports/promotions/${slug}` : `/promotions/${slug}`;
}

/** Map an API row to the tile shape used on PromotionsPage. */
export function promotionToTile(post) {
  const slug = post.slug;
  const segment = post.segment || "casino";
  return {
    href: promotionHref(segment, slug),
    slug,
    segment,
    title: post.title,
    text: post.summary || stripHtml(post.description).slice(0, 220),
    img: promotionImageUrl(post.imageUrl) || "/images/banners/vip-hero-banner.png",
    alt: post.imageAlt || post.title,
    h: 400,
    w: 640,
    status: post.promoStatus === "ended" ? "ended" : "live",
    ends: formatPromoEnds(post.endsAt),
    featured: post.featured === true,
  };
}

export function promotionListQuery(tab, page, limit = 9) {
  const query = { page, limit };
  if (tab === "casino" || tab === "sports") query.segment = tab;
  return query;
}

/** Map wager leaderboard API rows into promotion board rows. */
export async function fetchLivePromotionBoard(board) {
  const live = board?.live;
  if (!live || live.source !== "wager_leaderboard") return board;

  try {
    const data = await betHistory.leaderboard({ period: live.period || "weekly", limit: live.limit || 20 });
    const rows = (data?.rows || []).map((r) => ({
      rank: r.rank,
      user: { name: r.player, vip: null },
      score: r.wagered,
      prize: "—",
    }));
    return {
      ...board,
      kind: board.kind || "wager",
      rows,
      pages: 1,
    };
  } catch {
    return board;
  }
}

export function parsePromotionPath(path) {
  const sports = path.match(/^\/sports\/promotions\/([^/]+)$/);
  if (sports) return { segment: "sports", slug: sports[1] };
  const casino = path.match(/^\/promotions\/([^/]+)$/);
  if (casino) return { segment: "casino", slug: casino[1] };
  return null;
}

export function matchesPromotionTab(tile, tab) {
  if (tab === "all") return true;
  if (tab === "sports") return tile.segment === "sports" || tile.href.startsWith("/sports/");
  if (tab === "casino") return tile.segment === "casino" || !tile.href.startsWith("/sports/");
  return true;
}

export const PROMOTION_JSON_EXAMPLES = {
  qualifyingGames: `[{"href":"/games/originals/mines","name":"Mines","img":"/games/example.webp","color":"rgb(255, 23, 89)","indicator":"250x"}]`,
  sportEvents: `[{"label":"2026 US Open Men Singles","href":"/sports/tournament/us-open-2026?section=2026%20US%20Open%20Men%20Singles","icon":"/icons/sports/tennis.svg","sportAlt":"Tennis"}]`,
  tournamentPanel: `{"ends":"Sep 14, 2026, 9:30 AM","endsAt":"2026-09-14T09:30:00Z","prizePool":"$10,000.00","prizeSplit":"50"}`,
  leaderboard: `{"kind":"multiplier","columns":["Rank","User","Highest Multiplier","Prize"],"widths":["15%","30%","35%","20%"],"pages":1,"rows":[{"rank":1,"user":{"name":"player1","vip":"gold"},"score":"100x","prize":"$100"}]}`,
  leaderboardLive: `{"kind":"wager","columns":["Rank","User","Wagered","Prize"],"widths":["15%","30%","35%","20%"],"pages":1,"rows":[],"live":{"source":"wager_leaderboard","period":"weekly","limit":50}}`,
  tags: `["casino","sports"]`,
};
