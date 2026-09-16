/**
 * Site identity and where the platform gateway lives.
 *
 * One admin build serves every clone. What differs per site is injected by
 * environment, never hardcoded: the owner panel writes these into each
 * site's `admin/.env.local` when it provisions the site.
 *
 *   API_URL                 server-only — the gateway the proxy forwards to
 *   NEXT_PUBLIC_SITE_KEY    stable id: 'shuffle' | 'hash-games' | 'stake-site' | 'admins'
 *   NEXT_PUBLIC_SITE_NAME   what the sidebar shows
 */
export const siteConfig = {
  key: process.env.NEXT_PUBLIC_SITE_KEY ?? 'admins',
  name: process.env.NEXT_PUBLIC_SITE_NAME ?? 'CFZ Site Admin',
  tagline: process.env.NEXT_PUBLIC_SITE_TAGLINE ?? 'Operator panel',
  environment: process.env.NEXT_PUBLIC_ENV_LABEL ?? 'localhost'
} as const

/** Server-only. Never import from a client component. */
export const serverConfig = {
  apiUrl: (process.env.API_URL ?? 'http://127.0.0.1:4000').replace(/\/+$/, ''),
  cookieName: process.env.SESSION_COOKIE_NAME ?? 'cfz_sa_token',
  cookieMaxAgeSeconds: Number(process.env.SESSION_MAX_AGE_SECONDS ?? 8 * 60 * 60)
}
