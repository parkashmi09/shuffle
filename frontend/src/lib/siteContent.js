import { useApi } from "./useResource";
import { site } from "./endpoints";

/**
 * The owner's branding (`GET /admin/branding/public`) and the site admin's
 * editable copy (`GET /admin/site-content/public`: footer, social, support,
 * legal, home, pages, vip). Each is read once per page load and shared.
 *
 * Unset reads as `null` / `{}`, and callers keep their own default — an
 * unbranded site still renders.
 */
let brandingOnce = null;
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

export const loadBranding = () => (brandingOnce ??= site.branding().then(cleanBranding).catch(() => null));
export const loadSiteContent = () => (contentOnce ??= site.content().then((d) => d || {}).catch(() => ({})));

export const useBranding = () => useApi("site:branding", loadBranding).data;
export const useSiteContent = () => useApi("site:content", loadSiteContent).data || {};

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
