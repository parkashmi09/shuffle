#!/usr/bin/env node
// One fresh player through the whole account + money chain on the local shuffle gateway, and for every
// route a check that the player site (frontend/src) really calls it.
//
//   node .claude/skills/shuffle-env/scripts/player-api.mjs [--no-money]
//
// register → login → me/profile/preferences/sessions → bonus/VIP/rakeback → KYC/2FA → wallet → manual INR deposit
// (admin approves with the staff password, balance +1000) → withdrawal (−200 or the owner's KYC/wager gate)
// → cancel (refund) → bet history + stats → history/ledger. Credentials of the player go to .run/qa-player.local.json.
// The super admin login comes from backend/.env in-process; nothing secret is printed.
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const env = (rel) => Object.fromEntries(readFileSync(path.join(root, rel), 'utf8').split('\n')
  .filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"(.*)"$/, '$1')]))
const be = env('backend/.env'), fe = env('frontend/.env')
// The site itself goes through the vite proxy (/api → VITE_GATEWAY_URL); this script calls the gateway directly.
const API = fe.VITE_GATEWAY_URL || 'http://127.0.0.1:4600'
const NO_MONEY = process.argv.includes('--no-money')

// Every frontend source file once, comments stripped (docblocks quote routes in backticks), to answer
// "does the site call this route?". Paths live in lib/endpoints.js as "/user/…" or `/user/…/${id}`.
const src = []
const walk = (d) => { for (const f of readdirSync(d)) { const p = path.join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(jsx?|tsx?)$/.test(f) && src.push(readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')) } }
walk(path.join(root, 'frontend/src'))
// key = the path as the site writes it, without /api/v1; `*` stands for a ${param}. Must sit inside a string literal.
const wired = (key) => {
  if (!key) return null
  const re = new RegExp(`["'\`]${key.split('*').map((s) => s.replace(/[.?+^$()[\]{}|\\]/g, '\\$&')).join('\\$\\{[^}]+\\}')}["'\`?]`)
  return src.some((t) => re.test(t))
}

const rows = []
const row = (name, ok, info = '', key) => {
  const w = wired(key)
  rows.push({ name, ok, w })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(34)} ${w === null ? '      ' : w ? 'site✓ ' : 'site✗ '} ${info}`)
}

async function call(method, p, { token, body, form } = {}) {
  const headers = {}
  if (token) headers.authorization = `Bearer ${token}`
  if (body) headers['content-type'] = 'application/json'
  const r = await fetch(API + p, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) })
  const j = await r.json().catch(() => ({}))
  return { status: r.status, ok: r.ok, data: j?.data ?? j, code: j?.error?.code }
}
// The site key defaults to the route itself (minus /api/v1 and the query); pass one for parameterised routes.
const step = async (name, method, p, opts, check = () => true, key = p.replace(/^\/api\/v1/, '').replace(/\?.*$/, '')) => {
  const r = await call(method, p, opts)
  const ok = r.ok && check(r.data)
  row(name, ok, ok ? `${r.status}` : `${r.status} ${r.code || ''}`, key)
  return r
}
const inr = (balances) => {
  const list = Array.isArray(balances) ? balances : balances?.balances ?? balances?.items ?? balances?.wallets ?? Object.entries(balances ?? {}).map(([currency, v]) => (typeof v === 'object' ? { currency, ...v } : { currency, balance: v }))
  const b = list.find((x) => String(x.currency ?? x.coin).toUpperCase() === 'INR')
  return b ? Number(b.balance ?? b.available ?? b.amount) : NaN
}

const u = `qa${Date.now().toString(36)}`
const password = `Qa!${Math.random().toString(36).slice(2, 10)}A1`

const reg = await step('register', 'POST', '/api/v1/user/auth/register', { body: { username: u, password, email: `${u}@example.test` } })
const login = await step('login', 'POST', '/api/v1/user/auth/login', { body: { identifier: u, password } }, (d) => !!d.accessToken)
const token = login.data?.accessToken
if (!token) { console.log('\nno session — stopping'); process.exit(1) }
const t = { token }

await step('auth/me', 'GET', '/api/v1/user/auth/me', t)
await step('profile get', 'GET', '/api/v1/user/profile', t, (d) => d.username === u || d.name === u)
await step('profile update (country)', 'PUT', '/api/v1/user/profile', { ...t, body: { country: 'IN' } })
await step('preferences', 'GET', '/api/v1/user/preferences', t)
await step('sessions', 'GET', '/api/v1/user/auth/sessions', t)
await step('referral', 'GET', '/api/v1/user/profile/referral', t)
await step('affiliate', 'GET', '/api/v1/user/affiliate', t)
await step('bonus overview', 'GET', '/api/v1/user/bonus', t)
await step('bonus history', 'GET', '/api/v1/user/bonus/history', t)
// 404 BONUS_NO_BONUS_RECORD is the right answer for a player who never had a bonus.
{ const r = await call('GET', '/api/v1/user/bonus/record', t); row('bonus record', r.ok || r.code === 'BONUS_NO_BONUS_RECORD', `${r.status} ${r.code || ''}`, '/user/bonus/record') }
await step('vip', 'GET', '/api/v1/user/vip', t)
await step('rakeback', 'GET', '/api/v1/user/rakeback', t)
await step('notifications', 'GET', '/api/v1/user/notifications', t)
await step('vault', 'GET', '/api/v1/user/vault', t)
await step('kyc status', 'GET', '/api/v1/user/kyc/status', t)
await step('2fa status', 'GET', '/api/v1/user/2fa/status', t)
const b0 = await step('wallet balances', 'GET', '/api/v1/user/wallet/balances', t)
let bal = inr(b0.data)
console.log(`      registration balance INR ${bal} (registration bonus = whatever admin Bonus config pays)`)

if (!NO_MONEY) {
  const admin = await call('POST', '/api/v1/admin/auth/login', { body: { email: be.SEED_ADMIN_EMAIL, password: be.SEED_ADMIN_PASSWORD } })
  row('admin login (for approve)', !!admin.data?.token, `${admin.status}`)
  const methods = await step('deposit methods INR', 'GET', '/api/v1/user/bank-details/INR', t, undefined, '/user/bank-details/*')
  const list = Array.isArray(methods.data) ? methods.data : methods.data?.items ?? []
  const m = list.find((x) => x.upiId || x.upi_id) ?? list[0]
  if (!m) row('deposit method exists', false, 'add one in admin Transactions → Bank details')
  else {
    const fd = new FormData()
    // 1×1 PNG: the screenshot is required, its content is not checked.
    fd.append('screenshot', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')], { type: 'image/png' }), 'qa.png')
    for (const [k, v] of Object.entries({ amount: '1000', currency: 'INR', transactionId: `UTR${Date.now()}`, upiId: m.upiId ?? m.upi_id })) if (v) fd.append(k, v)
    const dep = await step('deposit lodge ₹1000', 'POST', '/api/v1/user/deposits/fiat', { ...t, form: fd })
    const id = dep.data?.id ?? dep.data?.depositId ?? dep.data?.deposit?.id
    await step('deposit list (mine)', 'GET', '/api/v1/user/deposits/fiat', t, (d) => JSON.stringify(d).includes(String(id)))
    if (id && admin.data?.token) {
      const ap = await call('PUT', `/api/v1/admin/user/deposits/fiat/${id}/approve`, { token: admin.data.token, body: { transactionPassword: be.SEED_ADMIN_PASSWORD } })
      row('admin approve deposit', ap.ok, `${ap.status} ${ap.code || ''}`)
      const after = inr((await call('GET', '/api/v1/user/wallet/balances', t)).data)
      row('balance +1000 after approve', Math.abs(after - bal - 1000) < 0.01, `${bal} → ${after}`)
      bal = after
    }
  }

  // Withdrawal: lodging it must take the money at once (or answer the owner's gate), cancelling must give it back.
  const acct = await step('payout account (upi)', 'POST', '/api/v1/user/bank-accounts', { ...t, body: { method: 'upi', accountHolderName: 'QA Player', upiId: `${u}@upi` } })
  const accountId = acct.data?.id ?? acct.data?.bankAccount?.id ?? acct.data?.account?.id
  if (!accountId) console.log('      payout account reply keys:', Object.keys(acct.data ?? {}).join(','))
  await step('withdraw requirements', 'GET', '/api/v1/user/withdrawals/requirements?currency=INR', t)
  const wd = await call('POST', '/api/v1/user/withdrawals/fiat', { ...t, body: { amount: '200', currency: 'INR', bankAccountId: accountId } })
  const gated = ['FIAT_WITHDRAW_KYC_REQUIRED', 'WITHDRAW_WAGER_REQUIRED', 'BONUS_FORFEIT_REQUIRED'].includes(wd.code)
  if (gated) row('withdraw ₹200 (owner gate answers)', true, `${wd.status} ${wd.code}`, '/user/withdrawals/fiat')
  else {
    row('withdraw ₹200 lodged', wd.ok, `${wd.status} ${wd.code || ''} ${wd.ok ? '' : JSON.stringify(wd.data?.error?.details ?? '').slice(0, 160)}`, '/user/withdrawals/fiat')
    const after = inr((await call('GET', '/api/v1/user/wallet/balances', t)).data)
    row('balance −200 on withdraw', Math.abs(after - (bal - 200)) < 0.01, `${bal} → ${after}`)
    const wid = wd.data?.id ?? wd.data?.withdrawalId ?? wd.data?.withdrawal?.id
    if (wid) {
      await step('withdraw cancel', 'POST', `/api/v1/user/withdrawals/fiat/${wid}/cancel`, t, undefined, '/user/withdrawals/fiat/*/cancel')
      const back = inr((await call('GET', '/api/v1/user/wallet/balances', t)).data)
      row('balance refunded on cancel', Math.abs(back - bal) < 0.01, `${after} → ${back}`)
    }
  }
}

await step('casino bet history', 'GET', '/api/v1/casino/bet-history', t)
await step('casino bet stats', 'GET', '/api/v1/casino/bet-history/stats', t)
await step('exchange bets (cricket)', 'GET', '/api/v1/sports/user/cricket/sports-bets/user', t, undefined, '/sports/user/cricket/sports-bets/user')
await step('history all', 'GET', '/api/v1/user/history', t)
await step('history deposits', 'GET', '/api/v1/user/history/deposits', t)
await step('history withdrawals', 'GET', '/api/v1/user/history/withdrawals', t)
await step('wallet ledger', 'GET', '/api/v1/user/wallet/ledger', t)
await step('fiat deposit stats', 'GET', '/api/v1/user/history/fiat/stats', t)

const fail = rows.filter((r) => !r.ok), unwired = rows.filter((r) => r.w === false)
console.log(`\n${rows.length - fail.length}/${rows.length} pass · ${unwired.length} route(s) the site never calls${unwired.length ? ': ' + unwired.map((r) => r.name).join(', ') : ''}`)
mkdirSync(path.join(root, '.run'), { recursive: true })
// .run/ is gitignored: the browser pass signs in as this funded player.
writeFileSync(path.join(root, '.run/qa-player.local.json'), JSON.stringify({ username: u, password }) + '\n', { mode: 0o600 })
console.log(`player ${u} (reg ${reg.status}) left in DB shuffle; login in .run/qa-player.local.json`)
process.exit(fail.length ? 1 : 0)
