#!/usr/bin/env node
/**
 * Shuffle admin on/off → public route check. No deps (Node 18+ fetch).
 *
 *   node .claude/skills/shuffle-qa/scripts/toggles.mjs [--only <key>] [--dry] [--clear-content]
 *
 * Logins are read in-process from backend/.env (SEED_ADMIN_EMAIL/PASSWORD) and owner-panel/.env.local
 * (OWNER_USERNAME/PASSWORD); SHUFFLE_ADMIN_EMAIL/_PASSWORD and SHUFFLE_OWNER_USER/_PASSWORD override them.
 * Nothing secret is printed.
 *
 * For every row: read the current value, flip it, assert the PUBLIC route the
 * player site (5174) reads changed, flip back, assert restored. Every write sends
 * only the changed key (owner: `{version, features|flags: {key}}`, never the doc).
 * Restore always runs in `finally`. `--clear-content` PUTs `{}` to every
 * Site config → Content section afterwards (the frontend then shows its defaults).
 *
 * The second column is the shuffle frontend file that reads the value, or null when
 * frontend/src reads nothing for it (the row then proves only the backend half).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.SHUFFLE_API ?? 'http://127.0.0.1:4600/api/v1';
// The owner panel binds 127.0.0.1 only (next dev -H 127.0.0.1); Node may resolve localhost to ::1.
const OWNER = process.env.SHUFFLE_OWNER_URL ?? 'http://127.0.0.1:3145';
const args = process.argv.slice(2);
const ONLY = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const DRY = args.includes('--dry');
const CLEAR_CONTENT = args.includes('--clear-content');

// Site admin → Feature flags (PUT /admin/site-config/global). [flag, frontend reader | null, surface]
const FLAGS = [
  ['casino', null, 'no gate in frontend/src — casino always drawn'],
  // Not on /global: Sports Exchange → Sports switch writes PUT /site-config/sports {enabled}.
  ['sports', null, 'no gate in frontend/src — sports always drawn', '/admin/site-config/sports'],
  ['originals', null, 'no gate — Originals category always drawn'],
  ['vipclub', null, 'no gate — /vip-program always drawn'],
  ['bonus', null, 'no gate'],
  ['wheelspin', null, 'no gate'],
  ['giftcards', null, 'no gate'],
  ['affiliate', 'usePublicSiteConfig.affiliateEnabled', 'nav/user-menu/footer Affiliate, /affiliate → marketing page when off'],
  ['home_heroSection', null, 'no gate'],
  ['home_livesports', null, 'no gate'],
  ['home_promocards', null, 'no gate'],
  ['home_leaderboard', null, 'no gate'],
];

// Owner panel → Features & plan (siteUi `toggle` rows). [feature, frontend reader | null, surface]
// Shuffle's useSiteFeatures reads only the policies (business_model, deposit_mode, withdrawal_mode), not these.
const FEATURES = [
  ['vip', null, '/vip-program'],
  ['promotions', null, '/promotions'],
  ['bonus', null, 'bonus claim'],
  ['affiliate', null, '/affiliate (admin flag affiliate is what the site reads)'],
  ['races', null, 'promo race pages'],
  ['challenges', null, '/challenges'],
  ['raffles', null, '—'],
  ['vault', null, 'wallet vault'],
  ['swap', null, '—'],
  ['notifications', null, 'header notifications'],
  ['kyc', null, 'Settings → Verify'],
  ['gift_cards', null, '—'],
  ['blog', null, '/blog'],
  ['spin_wheel', null, '—'],
  ['tips', null, '—'],
  ['chat', null, '—'],
];

// Site config → Content (PUT /admin/site-content/:key). A valid test value per section.
// shortcut: shuffle's frontend does not read /admin/site-content/public yet, so these rows prove the backend only.
const CONTENT = {
  home: { heroTitle: 'QA hero title', heroSubtitle: 'QA subtitle', registerCta: 'QA join' },
  footer: { columns: [{ title: 'QA column', links: [{ label: 'QA terms', href: '/policies/terms' }] }] },
  social: { links: [{ network: 'x', href: 'https://x.com/qa' }] },
  support: { email: 'qa@example.com', liveChatUrl: 'https://example.com/chat', helpCenterUrl: '/policies/terms' },
  legal: { companyNote: 'QA company', copyright: 'QA copyright', licenseText: 'QA licence', licenseUrl: 'https://example.com/l', ageNotice: 'QA 18+' },
  pages: { items: [{ slug: 'terms', title: 'QA terms', body: '## QA\n\nBody.' }] },
  vip: { title: 'QA VIP', subtitle: 'QA sub', benefits: [{ title: 'QA b', text: 'QA t' }], faq: [{ q: 'QA q?', a: 'QA a' }] },
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const envFile = (rel) => {
  const f = path.join(root, rel);
  if (!existsSync(f)) return {};
  return Object.fromEntries(readFileSync(f, 'utf8').split('\n').filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"(.*)"$/, '$1')]));
};
const be = envFile('backend/.env');
const ow = envFile('owner-panel/.env.local');
const CREDS = {
  SHUFFLE_ADMIN_EMAIL: be.SEED_ADMIN_EMAIL,
  SHUFFLE_ADMIN_PASSWORD: be.SEED_ADMIN_PASSWORD,
  SHUFFLE_OWNER_USER: ow.OWNER_USERNAME,
  SHUFFLE_OWNER_PASSWORD: ow.OWNER_PASSWORD,
};
const opt = (k) => process.env[k] || CREDS[k];
const env = (k) => {
  const v = opt(k);
  if (!v) throw new Error(`${k} is not set (and not in the env files)`);
  return v;
};

// The gateway allows RATE_LIMIT_MAX (300) requests a minute per IP: keep under it, and wait out a 429.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;

async function call(base, path, opts = {}, retried = false) {
  const { method = 'GET', body, headers = {} } = opts;
  await sleep(Math.max(0, lastCall + 250 - Date.now()));
  lastCall = Date.now();
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (res.status === 429 && !retried) {
    const wait = Number(json?.error?.details?.retryAfter ?? 60);
    console.error(`429 on ${path}, waiting ${wait}s`);
    await sleep(wait * 1000 + 1000);
    return call(base, path, opts, true);
  }
  return { status: res.status, ok: res.ok, data: json?.data, error: json?.error, headers: res.headers };
}

let adminHeaders = null;
let ownerCookie = null;

async function adminLogin() {
  const r = await call(API, '/admin/auth/login', { method: 'POST', body: { email: env('SHUFFLE_ADMIN_EMAIL'), password: env('SHUFFLE_ADMIN_PASSWORD') } });
  if (!r.ok || !r.data?.token) throw new Error(`admin login ${r.status} ${r.error?.code ?? ''}`);
  adminHeaders = { authorization: `Bearer ${r.data.token}` };
}

async function ownerLogin() {
  if (!opt('SHUFFLE_OWNER_USER') || !opt('SHUFFLE_OWNER_PASSWORD')) return false;
  const r = await call(OWNER, '/api/auth/login', { method: 'POST', body: { username: opt('SHUFFLE_OWNER_USER'), password: opt('SHUFFLE_OWNER_PASSWORD') } });
  const cookie = r.headers.get('set-cookie');
  if (!r.ok || !cookie) throw new Error(`owner login ${r.status} (is the owner panel on :3145?)`);
  ownerCookie = cookie.split(';')[0];
  return true;
}

const admin = (path, opts = {}) => call(API, path, { ...opts, headers: adminHeaders });
const owner = (path, opts = {}) => call(OWNER, path, { ...opts, headers: { cookie: ownerCookie } });

/** A read that failed throws: an empty answer must never pass as "changed" or "restored". */
const must = (r, what) => {
  if (!r.ok || r.data == null) throw new Error(`${what} ${r.status} ${r.error?.code ?? ''}`);
  return r.data;
};
const publicFlags = async () => must(await call(API, '/admin/site-config/public'), 'site-config/public');
const publicFeatures = async () => new Set(must(await call(API, '/admin/features/public'), 'features/public').map((f) => f.feature));
const publicContent = async () => must(await call(API, '/admin/site-content/public'), 'site-content/public');
const ownerDoc = async () => must(await owner('/api/owner/entitlements'), 'owner entitlements');

/** Poll `read` until `want(value)` (public reads may sit behind a short cache). */
async function until(read, want, ms = 20000) {
  const end = Date.now() + ms;
  let v;
  do {
    v = await read();
    if (want(v)) return true;
    await sleep(1000);
  } while (Date.now() < end);
  return false;
}

const results = [];
const record = (kind, key, result, note = '') => results.push({ kind, key, result, note });

async function flagRow([flag, gate, surface, route]) {
  const write = (v) =>
    admin(route ?? '/admin/site-config/global', { method: 'PUT', body: route ? { enabled: v } : { [flag]: v } });
  const before = (await publicFlags())[flag];
  if (typeof before !== 'boolean') return record('flag', flag, 'FAIL', `public value is ${JSON.stringify(before)}`);
  if (DRY) return record('flag', flag, 'DRY', `now ${before} → reader ${gate ?? "none"}: ${surface}`);
  let note = '';
  try {
    const put = await write(!before);
    if (!put.ok) {
      // Turning ON refused by the owner's plan is the upstream gate working.
      const gated = !before && put.error?.code === 'NOT_ENTITLED';
      return record('flag', flag, gated ? 'PASS' : 'FAIL', gated ? 'owner plan off: admin ON refused (NOT_ENTITLED)' : `PUT ${put.status} ${put.error?.code}`);
    }
    if (!(await until(publicFlags, (f) => f[flag] === !before))) note = 'public did not change';
  } finally {
    await write(before);
  }
  const restored = await until(publicFlags, (f) => f[flag] === before);
  record('flag', flag, !note && restored ? 'PASS' : 'FAIL', note || (restored ? `${before}→${!before}→${before}; reader ${gate ?? "none in frontend/src"}` : 'NOT RESTORED'));
}

async function ownerPut(part, key, value) {
  const doc = await ownerDoc();
  return owner('/api/owner/entitlements', { method: 'PUT', body: { version: doc.version, [part]: { [key]: value } } });
}

async function featureRow([feature, gate, surface]) {
  const doc = await ownerDoc();
  const before = doc.features?.[feature];
  if (typeof before !== 'boolean') return record('owner', feature, 'FAIL', 'not in owner features');
  if (DRY) return record('owner', feature, 'DRY', `now ${before} → reader ${gate ?? "none"}: ${surface}`);
  let note = '';
  try {
    const put = await ownerPut('features', feature, !before);
    if (!put.ok) return record('owner', feature, 'FAIL', `owner PUT ${put.status} ${put.error?.code ?? ''}`);
    if (!(await until(publicFeatures, (s) => s.has(feature) === !before))) note = 'features/public did not change';
  } finally {
    await ownerPut('features', feature, before);
  }
  const restored = await until(publicFeatures, (s) => s.has(feature) === before);
  record('owner', feature, !note && restored ? 'PASS' : 'FAIL', note || (restored ? `${before}→${!before}→${before}; reader ${gate ?? "none in frontend/src"}` : 'NOT RESTORED'));
}

/** Owner flag off ⇒ admin cannot turn it on ⇒ public off. Uses `vipclub`. */
async function upstreamRow() {
  const flag = 'vipclub';
  const doc = await ownerDoc();
  const ownerBefore = doc.flags?.[flag];
  const adminBefore = (await publicFlags())[flag];
  if (DRY) return record('upstream', flag, 'DRY', `owner ${ownerBefore}, admin ${adminBefore}`);
  if (ownerBefore !== true) return record('upstream', flag, 'SKIP', 'owner flag already off');
  const notes = [];
  try {
    const off = await ownerPut('flags', flag, false);
    if (!off.ok) return record('upstream', flag, 'FAIL', `owner PUT ${off.status}`);
    if (!(await until(publicFlags, (f) => f[flag] === false, 8000))) notes.push('public stays on while owner is off');
    const on = await admin('/admin/site-config/global', { method: 'PUT', body: { [flag]: true } });
    if (on.ok) notes.push('admin could turn it on');
  } finally {
    await ownerPut('flags', flag, true);
    await admin('/admin/site-config/global', { method: 'PUT', body: { [flag]: adminBefore } });
  }
  const restored = await until(publicFlags, (f) => f[flag] === adminBefore);
  record('upstream', flag, !notes.length && restored ? 'PASS' : 'FAIL', notes.join('; ') || (restored ? 'owner off → admin ON refused → public off; restored' : 'NOT RESTORED'));
}

async function contentRow(key) {
  const saved = must(await admin('/admin/site-content'), 'site-content').content ?? {};
  const before = saved[key];
  if (DRY) return record('content', key, 'DRY', before ? 'saved' : 'not saved');
  let note = '';
  try {
    const put = await admin(`/admin/site-content/${key}`, { method: 'PUT', body: CONTENT[key] });
    if (!put.ok) return record('content', key, 'FAIL', `PUT ${put.status} ${put.error?.code}`);
    const want = JSON.stringify(put.data?.value);
    if (!(await until(publicContent, (c) => JSON.stringify(c[key]) === want))) note = 'public did not change';
  } finally {
    // No delete route: an unsaved section is restored as `{}` (empty = frontend default).
    await admin(`/admin/site-content/${key}`, { method: 'PUT', body: before ?? {} });
  }
  const restoredTo = JSON.stringify(must(await admin('/admin/site-content'), 'site-content').content?.[key]);
  const ok = await until(publicContent, (c) => JSON.stringify(c[key]) === restoredTo);
  record('content', key, !note && ok ? 'PASS' : 'FAIL', note || (ok ? 'set → public → restored' : 'NOT RESTORED'));
}

async function main() {
  await adminLogin();
  const hasOwner = await ownerLogin();
  const want = (k) => !ONLY || ONLY === k;

  for (const row of FLAGS) if (want(row[0])) await flagRow(row).catch((e) => record('flag', row[0], 'FAIL', e.message));
  for (const key of Object.keys(CONTENT)) if (want(key)) await contentRow(key).catch((e) => record('content', key, 'FAIL', e.message));
  if (hasOwner) {
    for (const row of FEATURES) if (want(row[0])) await featureRow(row).catch((e) => record('owner', row[0], 'FAIL', e.message));
    if (want('upstream')) await upstreamRow().catch((e) => record('upstream', 'vipclub', 'FAIL', e.message));
  } else record('owner', '*', 'SKIP', 'SHUFFLE_OWNER_USER/PASSWORD not set');

  if (CLEAR_CONTENT && !DRY) {
    for (const key of Object.keys(CONTENT)) {
      const r = await admin(`/admin/site-content/${key}`, { method: 'PUT', body: {} });
      record('clear', key, r.ok ? 'PASS' : 'FAIL', r.ok ? 'cleared to {}' : `PUT ${r.status}`);
    }
  }

  console.table(results);
  const failed = results.filter((r) => r.result === 'FAIL').length;
  console.log(`${results.length} rows, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
