---
name: shuffle-env
description: Shuffle's local stack in one place — ports, start/restart, logs, logins (super admin, owner panel) without printing passwords, every base URL of backend/admin/owner/frontend from one profile (local now, production later), and a one-command API test of the player chain (register, login, profile, bonus, VIP, KYC, wallet, manual deposit + admin approve, withdrawal gate/refund, bet history + stats) that also says whether the player site calls each route. Use for "shuffle chalu kar", "shuffle login", "shuffle ka password", "base URL", "production URL laga", "registration/login/bonus/wallet/KYC/profile/bet stats ki API test kar", "frontend me hai ya nahi". Sidebar on/off QA is shuffle-qa.
---

# shuffle-env

Shuffle = `inhouse/shuffle` (repo parkashmi09/shuffle · `main`). `backend/`, `admin/`, `owner-panel/` are
synced with main-server and the other sites (`site-sync`, `hash-sync`): don't edit them here. `frontend/` is
shuffle's own React + Vite app.

## Ports and processes

| App | URL | Start (from `shuffle/`) | Log |
|---|---|---|---|
| backend gateway | http://127.0.0.1:4600 (user 4601, admin 4602, casino 4603, sports 4604, workers 4605/4606) | `cd backend && npm run dev` | `backend/.run/dev.log` |
| site admin (bitcasino theme) | http://localhost:3140 | `cd admin && npm run dev` | `.run/admin.log` if started with nohup |
| owner panel | http://localhost:3145 (binds 127.0.0.1 only) | `cd owner-panel && npm run dev` | |
| player site | http://localhost:5174 (strictPort) | `cd frontend && npm run dev` | |

DB `shuffle` (Postgres), `OWNER_SITE_KEY=shuffle`, own owner shared secret + Ed25519 pair. Migrations: `cd backend && npm run db:migrate`.
A restart that leaves old listeners: kill what holds 4600-4606 (`lsof -nP -iTCP:4600-4606 -sTCP:LISTEN`), then start again.
Health: `curl -s http://127.0.0.1:4600/health`. Use localhost URLs when showing pages to the user.

## Logins

- Super admin = `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `backend/.env`; owner = `OWNER_USERNAME` / `OWNER_PASSWORD` in `owner-panel/.env.local`.
  Read them in-process only; never print them or put them in commits, chat or artifacts.
- Local `TXN_PASSWORD_MODE=login`: the admin's transaction password (deposit approve, withdraw decide, settlement) is the staff login password.
- Browser: start the shared CDP Chrome (`node /Users/apple/Developer/cfz/admins/agents/qa-browser.mjs start`, 127.0.0.1:9333), then
  `node .claude/skills/shuffle-env/scripts/login.mjs [admin|owner|all]` — signs in through each app's real login (admin via its `/api/gw` proxy)
  and prints only who logged in and the page id. `login failed (undefined)` = that app is not running.
- Owner API: send only the keys you change (`PUT /api/owner/entitlements {version, features:{key}}`); never PUT back a GET.
- Never click anything on the user's real shuffle.com tab in that Chrome.
- Before going live: new super admin password, new owner password, new owner keys (`node owner-panel/scripts/owner-keys.mjs --force` + new `OWNER_SHARED_SECRET` in both files).

## Base URLs — one profile, all four apps

`profiles.json` holds the hosts; `scripts/env.mjs` writes only the URL keys into the gitignored env files (and prints only those).

```sh
node .claude/skills/shuffle-env/scripts/env.mjs check local        # every URL key, DIFF where it is off
node .claude/skills/shuffle-env/scripts/env.mjs apply local        # write them; then restart all four apps
```

| File | Keys |
|---|---|
| `backend/.env` | `PUBLIC_BASE_URL`, `PUBLIC_ASSET_URL`, `PUBLIC_SITE_URL`, `CORS_ORIGIN`, `SOCKET_ALLOWED_ORIGINS` |
| `admin/.env.local` | `API_URL`, `NEXT_PUBLIC_API_BASE` |
| `owner-panel/.env.local` | `SITE_GATEWAY_URL`, `NEXT_PUBLIC_API_BASE`, `SITE_ADMIN_URL`, `SITE_FRONTEND_URL` |
| `frontend/.env` | `VITE_GATEWAY_URL` (= api); `VITE_API_BASE` must stay **unset** |

Shuffle's frontend never names the API host in its bundle: it calls same-origin `/api/v1/…` (`lib/api.js` `BASE`).
In dev `frontend/vite.config.js` proxies `/api` and `/health` to `VITE_GATEWAY_URL` (and strips `Origin`, so CORS never
applies); deployed, `frontend/vercel.json` rewrites them to the server — that destination is a committed file, edit it by hand
for production. `VITE_API_BASE` (see `frontend/.env.example`) would bypass both and need a CORS entry, so the script flags it.

Production: fill `profiles.json → production` (the script refuses while `CHANGE-ME` is left), `apply production` on the server's
env files, rebuild admin/owner/frontend (`NEXT_PUBLIC_*` and `VITE_*` are build-time), update `frontend/vercel.json`, point PSP
callbacks at the new `PUBLIC_BASE_URL`. Server deploys need the user's SSH.

## Player API chain

```sh
node .claude/skills/shuffle-env/scripts/player-api.mjs [--no-money]
```

A fresh player through: register → login → me / profile get + update / preferences / sessions / referral / affiliate → bonus
overview, history, record → VIP / rakeback / notifications / vault → KYC + 2FA status → wallet → INR deposit methods → lodge ₹1000
(screenshot) → admin approve (balance must go +1000) → payout account → withdrawal requirements → withdraw ₹200 (either −200 then
cancel refunds it, or the owner's gate answers: `FIAT_WITHDRAW_KYC_REQUIRED` / `WITHDRAW_WAGER_REQUIRED` / `BONUS_FORFEIT_REQUIRED`)
→ casino bet history + stats → sports bets → history (all / deposits / withdrawals) / ledger / fiat stats. It calls the gateway
directly (`VITE_GATEWAY_URL`). Each row prints PASS/FAIL, the status, and `site✓`/`site✗` = whether `frontend/src` has that route
inside a string literal (comments stripped; `lib/endpoints.js` is where they live, `*` in a key = a `${param}`).
The player's login is saved to `.run/qa-player.local.json` (gitignored) for a browser pass.

Known answers (not bugs):
- `bonus/record` 404 `BONUS_NO_BONUS_RECORD` for a player who never had a bonus.
- Registration balance 0 unless admin Bonus → registration bonus is on.
- `deposit method exists` FAIL = DB `shuffle` has no INR row in admin Transactions → Bank details yet (data, not code); add one.
- `profile/referral`, `bonus/history`, `bonus/record`, `history/fiat/stats` and the cricket exchange route are not called by the site.
- The in-house socket games are off platform-wide (`backend/services/casino/src/sockets.js` `SOCKET_MODULES = []`);
  casino games are JSGames iframes.
- The register reply has no session (hash contract); the site signs in right after.

## Where things live in `frontend/src`

| Area | Files |
|---|---|
| HTTP + session | `lib/api.js` (envelope, `ApiError`, tokens in localStorage), `lib/endpoints.js` (every route, grouped objects), `lib/session.jsx`, `lib/useResource.js` |
| Auth | `components/auth/AuthModal.jsx` (Register tab hidden when `canSignUp()` is false) |
| Site gates | `lib/useSiteFeatures.js` → `lib/siteFeatures.js` (GENERATED from the CFZ kit — don't edit; owner policies only), `lib/usePublicSiteConfig.js` (`/admin/site-config/public`: affiliate flag, register/affiliate bonus, commission), `lib/siteBranding.js` (static `public/brand/`) |
| Money | `components/wallet/*` (WalletModal, DepositTab, WithdrawTab, VaultModal), `lib/walletOptions.js`, `lib/currencies.js`, `pages/TransactionsPage.jsx` |
| Bonus / VIP / rewards | `components/rewards`, `components/vip`, `pages/VipPage.jsx`, `pages/PromotionsPage.jsx`, `lib/promotions.js` |
| Casino | `lib/catalogue.js`, `lib/providerGames.js`, `pages/CasinoHome.jsx`, `pages/GamePage.jsx`, `pages/ProvidersPage.jsx` |
| Sports | `pages/SportsPage.jsx`, `SportPage.jsx`, `CompetitionPage.jsx`, `FixturePage.jsx`, `lib/sportsData.js`, `lib/betSlip.jsx` |
| Routes | `lib/router.js` (`routes` map, `navigate`), page table in `App.jsx`; pages in `pages/` |

Checks: `cd frontend && npm run lint && npm run build`. Commit with explicit paths; push only when the user asks.

Related: `shuffle-qa` (every admin sidebar tab on/off → frontend, sync check, money loop), `site-sync`, `hash-sync`, `owner-panel`,
`sports-exchange`, `sportsbook`. Same layout as the sibling site's skill (see also: `stake/.claude/skills/stake-env`).
