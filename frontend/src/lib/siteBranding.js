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
 *   siteLogo({ own: 'stake' })          // '/brand/roobet.svg', or null → draw your own
 *   <img src={siteLogo({ own: 'stake' }) ?? ownLogo} alt={siteTitle() ?? 'Stake'} />
 *
 * `own` is the logo this front end already draws. Asked for its own, it gets
 * null — its imported images have light, dark and small variants that one file
 * under public/brand/ does not.
 *
 * Nothing set reads as null everywhere, so a site the owner never branded
 * keeps the title in its index.html and the logo its own code imports.
 */

/** The static images under public/brand/, and the names that mean each one. */
const LOGOS = [
  { file: 'shuffle.svg', names: ['shuffle'] },
  { file: 'bcgame.png', names: ['bcgame', 'bcgames', 'hashgames', 'hashgame'] },
  { file: 'stake.svg', names: ['stake'] },
  { file: 'addaplay.webp', names: ['addaplay', 'adda'] },
  { file: 'roobet.svg', names: ['roobet'] },
];

const env = (key) => {
  const value = import.meta.env?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const squash = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * The image for a name, or null. "Stake", "stake-site" and "Stake Casino" all
 * find stake.svg — the match is on the squashed name CONTAINING a known one,
 * so the owner types what the site is called and not a file name.
 */
function match(name) {
  const wanted = squash(name);
  if (!wanted) return null;
  return LOGOS.find((l) => l.names.includes(wanted)) ?? LOGOS.find((l) => l.names.some((n) => wanted.includes(n))) ?? null;
}

export function logoFor(name, { own } = {}) {
  const hit = match(name);
  if (!hit || hit === match(own)) return null;
  const base = String(import.meta.env?.BASE_URL ?? '/').replace(/\/*$/, '/');
  return `${base}brand/${hit.file}`;
}

export const siteTitle = () => env('VITE_SITE_TITLE');
export const siteDescription = () => env('VITE_SITE_DESCRIPTION');

/** The logo the owner chose; failing that, whichever one the site's title names. */
export const siteLogo = (options) => (match(env('VITE_SITE_LOGO')) ? logoFor(env('VITE_SITE_LOGO'), options) : logoFor(siteTitle(), options));

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
