import { useApi } from "./useResource";
import { site } from "./endpoints";
import { onBump, useSiteVersion } from "./siteLive";

/**
 * The owner's branding (`GET /admin/branding/public`) and the site admin's
 * editable copy (`GET /admin/site-content/public`: footer, social, support,
 * legal, home, pages, vip). Each is read once per page load and shared.
 *
 * Unset reads as `null` / `{}`, and callers keep their own default — an
 * unbranded site still renders. Both are read again on a live save (lib/siteLive.js).
 */
let rawOnce = null;
let brandingOnce = null;
let extrasOnce = null;
let contentOnce = null;

const ASSET = /^\/api\/v1\/admin\/branding\/asset\/[0-9a-f]{64}\.(png|webp|svg)$/;
const API_ORIGIN = /^https?:/.test(import.meta.env.VITE_API_BASE || "") ? import.meta.env.VITE_API_BASE.replace(/\/api\/v1\/?$/, "") : "";
const safeText = (v, max) => (typeof v === "string" && v.trim() && v.length <= max && !/[<>]/.test(v) ? v.trim() : null);

/** Owner input is untrusted: only short plain text and the platform's own asset paths are drawn. */
function cleanBranding(data) {
  if (!data?.branded) return null;
  const out = {
    siteName: safeText(data.siteName, 40),
    title: safeText(data.title, 70),
    titleTemplate: safeText(data.titleTemplate, 70),
    description: safeText(data.description, 300),
    themeColor: /^#[0-9a-fA-F]{6}$/.test(data.themeColor || "") ? data.themeColor : null,
    keywords: Array.isArray(data.keywords) ? data.keywords.map((k) => safeText(k, 40)).filter(Boolean) : [],
  };
  for (const key of ["logoUrl", "markUrl", "ogImageUrl"]) out[key] = ASSET.test(data[key] || "") ? `${API_ORIGIN}${data[key]}` : null;
  return out.siteName ? out : null;
}

/**
 * Not branding as such, and readable unbranded: the floating chat buttons (owner allows, site
 * admin switches on + link; the backend normalises the link) and the sportsbook tab name / game.
 */
function cleanExtras(data) {
  const sb = data?.sportsbook ?? {};
  const wa = data?.whatsapp ?? {};
  const tg = data?.telegram ?? {};
  const waLink = typeof wa.link === "string" ? wa.link.trim() : "";
  const waHref = /^\+?\d{6,15}$/.test(waLink)
    ? `https://wa.me/${waLink.replace("+", "")}`
    : /^https:\/\/(wa\.me|([a-z0-9-]+\.)*whatsapp\.com)\//i.test(waLink) ? waLink : null;
  const message = safeText(wa.message, 300);
  const tgLink = typeof tg.link === "string" ? tg.link.trim() : "";
  return {
    whatsapp: wa.enabled === true && waHref ? `${waHref}${message ? `${waHref.includes("?") ? "&" : "?"}text=${encodeURIComponent(message)}` : ""}` : null,
    telegram: tg.enabled === true && tgLink.length <= 300 && /^https:\/\/(t|telegram)\.me\/[^\s<>"]+$/i.test(tgLink) ? tgLink : null,
    sportsbook: {
      tabName: safeText(sb.tabName, 30),
      gameUid: /^[A-Za-z0-9_-]{1,64}$/.test(sb.gameUid || "") ? sb.gameUid : null,
    },
  };
}

const loadRaw = () => (rawOnce ??= site.branding().catch(() => null));
export const loadBranding = () => (brandingOnce ??= loadRaw().then(cleanBranding));
export const loadBrandExtras = () => (extrasOnce ??= loadRaw().then(cleanExtras));
export const loadSiteContent = () => (contentOnce ??= site.content().then((d) => d || {}).catch(() => ({})));

onBump("branding", () => {
  rawOnce = brandingOnce = extrasOnce = null;
  queueMicrotask(applyBranding);
});
onBump("content", () => {
  contentOnce = null;
});

export const useBranding = () => useApi(`site:branding:${useSiteVersion("branding")}`, loadBranding).data;
/** `{ whatsapp, telegram, sportsbook: { tabName, gameUid } }` — see `cleanExtras`. */
export const useBrandExtras = () => useApi(`site:brand-extras:${useSiteVersion("branding")}`, loadBrandExtras).data;
/** Captured copy names the reference brand; the owner's site name replaces it (unbranded keeps the copy). */
export const withSiteName = (html, brand) => (brand?.siteName ? html.replace(/\bShuffle\b/g, () => brand.siteName) : html);

export const useSiteContent = () => useApi(`site:content:${useSiteVersion("content")}`, loadSiteContent).data || {};

/** Live Support's target: the admin's live-chat link, else the owner's WhatsApp / Telegram button; null = nothing to open. */
export function useSupportHref() {
  const { support } = useSiteContent();
  const extras = useBrandExtras();
  return support?.liveChatUrl || extras?.whatsapp || extras?.telegram || null;
}

export const openExternal = (href) => window.open(href, "_blank", "noopener,noreferrer");

/** A site-content page (`pages.items`) by slug, or null. */
export const findPage = (content, slug) => (content?.pages?.items || []).find((p) => p.slug === slug && p.body) || null;

function meta(attr, key, content) {
  if (!content) return;
  let tag = document.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

/** Title, description, keywords, theme colour, Open Graph and favicon from the owner's branding. */
export async function applyBranding() {
  const b = await loadBranding();
  if (!b || typeof document === "undefined") return;
  document.title = b.title || b.siteName;
  meta("name", "description", b.description);
  meta("name", "keywords", b.keywords.join(", "));
  meta("name", "theme-color", b.themeColor);
  meta("property", "og:site_name", b.siteName);
  meta("property", "og:title", b.title || b.siteName);
  meta("property", "og:description", b.description);
  meta("property", "og:image", b.ogImageUrl);
  if (b.markUrl) document.querySelector('link[rel~="icon"]')?.setAttribute("href", b.markUrl);
}
