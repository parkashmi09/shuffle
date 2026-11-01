#!/usr/bin/env node
// Sign the local site admin (super admin) and/or owner panel in, in the shared CDP Chrome (127.0.0.1:9333),
// through each app's real login. Passwords are read here from the gitignored env files and travel only
// inside the CDP call to the page; nothing secret is printed, written or put in a URL.
//
//   node .claude/skills/shuffle-env/scripts/login.mjs [admin|owner|all]      (default all)
// Start the browser first: node /Users/apple/Developer/cfz/admins/agents/qa-browser.mjs start
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const CDP = process.env.CDP_URL || 'http://127.0.0.1:9333'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const env = (rel) => Object.fromEntries(readFileSync(path.join(root, rel), 'utf8').split('\n')
  .filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
const be = env('backend/.env'), ad = env('admin/.env.local'), ow = env('owner-panel/.env.local')
const SECRETS = [be.SEED_ADMIN_PASSWORD, ow.OWNER_PASSWORD].filter(Boolean)
const say = (s) => console.log(SECRETS.reduce((o, v) => o.split(v).join('***'), String(s)))

async function openPage(url) {
  const r = await fetch(`${CDP}/json/new?about:blank`, { method: 'PUT' })
  if (!r.ok) throw new Error(`no browser at ${CDP} — start it with qa-browser.mjs start`)
  const t = await r.json()
  const ws = new WebSocket(t.webSocketDebuggerUrl)
  await new Promise((ok, bad) => { ws.onopen = ok; ws.onerror = () => bad(new Error('CDP connect failed')) })
  let id = 0
  const pending = new Map()
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) } }
  const send = (method, params = {}) => new Promise((res) => { pending.set(++id, res); ws.send(JSON.stringify({ id, method, params })) })
  const go = async (u) => { await send('Page.enable'); await send('Page.navigate', { url: u }); await new Promise((r2) => setTimeout(r2, 2500)) }
  // fn runs in the page with args; only its (non-secret) return value comes back.
  const run = async (fn, args) => {
    const d = await send('Runtime.evaluate', { expression: `(${fn})(...${JSON.stringify(args)})`, awaitPromise: true, returnByValue: true })
    return d.result?.result?.value ?? { ok: false, error: d.result?.exceptionDetails?.text || 'eval failed' }
  }
  await go(url)
  return { id: t.id, go, run, close: () => ws.close() }
}

async function admin() {
  const base = `http://localhost:${ad.PORT || 3140}`
  const p = await openPage(`${base}/login`)
  const res = await p.run(async (email, password) => {
    // Same-origin gateway proxy, as views/auth/Login.tsx does: no CORS.
    const r = await fetch('/api/gw/api/v1/admin/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
    const j = await r.json().catch(() => ({}))
    if (!j?.data?.token) return { ok: false, status: r.status, code: j?.error?.code }
    const s = await fetch('/api/auth/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: j.data.token }) })
    return { ok: s.ok, status: s.status, mustChange: !!(j.data.mustChangePassword || j.data.firstLogin) }
  }, [be.SEED_ADMIN_EMAIL, be.SEED_ADMIN_PASSWORD])
  if (!res.ok) { p.close(); return say(`admin: login failed (${res.status} ${res.code || res.error || ''})`) }
  await p.go(`${base}/dashboard`)
  say(`admin: logged in as ${be.SEED_ADMIN_EMAIL} → page ${p.id} ${base}/dashboard${res.mustChange ? ' (the app may ask for a new password)' : ''}`)
  p.close()
}

async function owner() {
  const base = `http://localhost:${ow.PORT || 3145}`
  const p = await openPage(`${base}/login`)
  const res = await p.run(async (username, password) => {
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) })
    return { ok: r.ok, status: r.status }
  }, [ow.OWNER_USERNAME, ow.OWNER_PASSWORD])
  if (!res.ok) { p.close(); return say(`owner: login failed (${res.status})`) }
  await p.go(`${base}/entitlements`)
  say(`owner: logged in as ${ow.OWNER_USERNAME} → page ${p.id} ${base}/entitlements`)
  p.close()
}

const which = process.argv[2] || 'all'
try {
  if (which === 'admin' || which === 'all') await admin()
  if (which === 'owner' || which === 'all') await owner()
} catch (e) { say(`login: ${e.message}`); process.exit(1) }
process.exit(0)
