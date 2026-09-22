/**
 * Who this site says it is — the same file in every CFZ site.
 *
 * GENERATED FROM admins/frontend-kit/siteBranding.js by agents/push-frontend-kit.mjs.
 *
 * The owner panel holds a title, a description and a logo NAME per site, and
 * the push writes them to `.env.local` as VITE_SITE_TITLE, VITE_SITE_DESCRIPTION
 * and VITE_SITE_LOGO. The logo is a name, never an upload: the images are
 * static files under `public/brand/`, shipped by the same push, and this module
 * picks one by name.
 *
 *   applySiteBranding()                 // document.title + <meta name="description">
 *   siteLogo({ own: 'stake-site' })     // '/brand/roobet.svg', or null → draw your own
 *   <img src={siteLogo({ own: 'stake-site' }) ?? ownLogo} alt={siteTitle() ?? 'Stake'} />
 *
 * `own` is this front end's own site key. Asked for its own logo, it gets
 * null — its imported images have light, dark and small variants that one file
 * under public/brand/ does not.
 *
 * Nothing set reads as null everywhere, so a site the owner never branded
 * keeps the title in its index.html and the logo its own code imports.
 */

/**
 * The static images under public/brand/. The NAME IS THE SITE KEY, exactly as
 * the owner panel registers it — `hash-games` finds hash-games.png and nothing
 * else does. No aliases, no partial matches: one name, one file.
 */
const LOGOS = {
  shuffle: 'shuffle.svg',
  'hash-games': 'hash-games.png',
  'stake-site': 'stake-site.svg',
  addaplay: 'addaplay.webp',
  roobet: 'roobet.svg',
};

const env = (key) => {
  const value = import.meta.env?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const exact = (name) => (LOGOS[String(name ?? '').trim().toLowerCase()] ? String(name).trim().toLowerCase() : null);

/**
 * The image for a name, or null. `own` is this front end's own site key: asked
 * for its own logo it gets null, so its imported images stay in use.
 */
export function logoFor(name, { own } = {}) {
  const key = exact(name);
  if (!key || key === exact(own)) return null;
  const base = String(import.meta.env?.BASE_URL ?? '/').replace(/\/*$/, '/');
  return `${base}brand/${LOGOS[key]}`;
}

export const siteTitle = () => env('VITE_SITE_TITLE');
export const siteDescription = () => env('VITE_SITE_DESCRIPTION');

/** The logo the owner chose, by exact name. Nothing chosen is null: the site's own. */
export const siteLogo = (options) => logoFor(env('VITE_SITE_LOGO'), options);

/** Call once, before the first render. Leaves index.html's own values where nothing is set. */
export function applySiteBranding() {
  if (typeof document === 'undefined') return;
  const title = siteTitle();
  const description = siteDescription();

  if (title) document.title = title;
  if (description) {
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', description);
  }
}
