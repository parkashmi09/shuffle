#!/usr/bin/env node
// Every base URL of the four shuffle apps from one profile (profiles.json), so nothing points at a stale host.
//
//   node .claude/skills/shuffle-env/scripts/env.mjs check [local|production]   show each URL, flag what differs
//   node .claude/skills/shuffle-env/scripts/env.mjs apply local|production     write them into the env files
//
// Only URL keys are touched (and only URL values are printed); secrets and everything else in the env files stay
// as they are. All four env files are gitignored.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../../..')
const profiles = JSON.parse(readFileSync(path.join(here, '..', 'profiles.json'), 'utf8'))
const [cmd = 'check', name = 'local'] = process.argv.slice(2)
const p = profiles[name] ?? (console.error(`unknown profile ${name}: ${Object.keys(profiles).join(', ')}`), process.exit(1))

const origins = [p.site, p.admin, new URL(p.owner).origin].map((u) => new URL(u).origin)
// Local dev also reaches the apps by 127.0.0.1; production only by its own hosts.
const allowed = name === 'local' ? [...new Set(origins.flatMap((o) => [o, o.replace('localhost', '127.0.0.1')]))] : origins

// null = the key must be unset. Shuffle's frontend never names the API host in the bundle: in dev vite.config.js
// proxies /api + /health to VITE_GATEWAY_URL, deployed frontend/vercel.json rewrites them (a committed file — edit
// its destination by hand). VITE_API_BASE would bypass both, so it stays unset.
const want = {
  'backend/.env': {
    PUBLIC_BASE_URL: p.api,
    PUBLIC_ASSET_URL: `${p.api}/assets`,
    PUBLIC_SITE_URL: p.site,
    CORS_ORIGIN: allowed.join(','),
    SOCKET_ALLOWED_ORIGINS: allowed.join(','),
  },
  'admin/.env.local': { API_URL: p.api, NEXT_PUBLIC_API_BASE: p.api },
  'owner-panel/.env.local': { SITE_GATEWAY_URL: p.api, NEXT_PUBLIC_API_BASE: p.api, SITE_ADMIN_URL: p.admin, SITE_FRONTEND_URL: p.site },
  'frontend/.env': { VITE_GATEWAY_URL: p.api, VITE_API_BASE: null },
}

if (name === 'production' && JSON.stringify(p).includes('CHANGE-ME')) {
  console.error('profiles.json → production still has CHANGE-ME hosts; fill in the real URLs first.')
  if (cmd === 'apply') process.exit(1)
}

const LISTS = new Set(['CORS_ORIGIN', 'SOCKET_ALLOWED_ORIGINS'])
let off = 0
for (const [rel, keys] of Object.entries(want)) {
  const file = path.join(root, rel)
  if (!existsSync(file)) { console.log(`MISSING ${rel} (copy its .env.example first)`); off++; continue }
  let text = readFileSync(file, 'utf8')
  for (let [k, v] of Object.entries(keys)) {
    const cur = text.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]
    // Local origin lists keep what other devs added (their own ports); production gets exactly its hosts.
    if (name === 'local' && LISTS.has(k) && cur) v = [...new Set([...cur.split(',').filter(Boolean), ...v.split(',')])].join(',')
    const ok = v === null ? cur === undefined : cur === v
    if (!ok) off++
    console.log(`${ok ? 'ok  ' : 'DIFF'} ${rel} ${k}=${cur ?? '(unset)'}${ok ? '' : `  → ${v ?? '(unset)'}`}`)
    if (ok || cmd !== 'apply') continue
    if (v === null) text = text.replace(new RegExp(`^${k}=.*\\n?`, 'm'), '')
    else text = cur === undefined ? text.replace(/\n?$/, `\n${k}=${v}\n`) : text.replace(new RegExp(`^${k}=.*$`, 'm'), () => `${k}=${v}`)
  }
  if (cmd === 'apply') writeFileSync(file, text)
}
console.log(cmd === 'apply' ? `\napplied "${name}" — restart backend, admin, owner panel and frontend` : `\n${off} value(s) differ from "${name}"`)
