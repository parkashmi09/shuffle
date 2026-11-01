---
name: shuffle-qa
description: Shuffle-only QA pass — every site admin sidebar page and its inner tabs against the player site (localhost:5174), the owner's Features & plan as the upstream gate, every admin on/off and Site config → Content section checked on the public route, what shuffle's frontend actually reads of it, plus a read-only "is shuffle in sync" check. Use for "sidebar test", "admin ke sidebar ki saari tests", "admin on/off check", "on/off karke frontend pe reflect", "frontend pe dikhna chahiye", "shuffle QA", "shuffle sync check", "har tab test kar". shuffle only — for other sites use site-qa-flow / live-qa.
---

# shuffle-qa

Shuffle = `/Users/apple/Developer/cfz/inhouse/shuffle` (repo parkashmi09/shuffle). Local stack:
gateway `http://127.0.0.1:4600` (DB `shuffle`, restart `cd shuffle/backend && npm run dev`, log `backend/.run/dev.log`),
admin `http://localhost:3140`, owner `http://localhost:3145`, player `http://localhost:5174`. Ports, logins, base URLs: `shuffle-env`.
Credentials are read in-process from `backend/.env` / `owner-panel/.env.local` — never print them, never commit them.

What the player site reads of the admin/owner settings (much less than the sibling sites — most switches have no surface yet):
- `/admin/site-config/public` via `frontend/src/lib/usePublicSiteConfig.js`: `affiliate` (false → Affiliate rows hidden, `/affiliate`
  shows the marketing page), `registerbonus` + currency (register modal), `affiliatebonus`, `comissionpercent`.
- `/admin/features/public` via `lib/useSiteFeatures.js` → `lib/siteFeatures.js` (generated kit file): only the policies
  `business_model` (b2b → no Register), `deposit_mode`, `withdrawal_mode` (manual / automatic tabs). Feature on/off is not read.
- Not read at all: `/admin/branding/public` (brand is static `public/brand/`, `lib/siteBranding.js`), `/admin/site-content/public`.
[matrix.md](matrix.md) maps every sidebar item to that chain and marks what has no surface.

## 1. Sync check (read-only)

```bash
bash shuffle/.claude/skills/shuffle-qa/scripts/sync-check.sh
```
PASS/FAIL for: site-sync status (shuffle line 0/0/0), hash-sync baseline = hash HEAD, `main-server` == `shuffle/backend`
(diff -rq, runtime dirs excluded), git clean + 0 unpushed, `:4600/health` all ok, `db:status` 0 pending.
It only reports. A FAIL names the flow that fixes it: `site-sync` (down/up/ui), `hash-sync`, commit/push, restart, migrate.
`git` FAILs while any agent has uncommitted work in the repo — read the count, don't commit others' files.

## 2. API toggles

```bash
node shuffle/.claude/skills/shuffle-qa/scripts/toggles.mjs [--dry] [--only <key>] [--clear-content]
```
Logins come from the env files (override with `SHUFFLE_ADMIN_EMAIL/_PASSWORD`, `SHUFFLE_OWNER_USER/_PASSWORD`).
Per row: read → flip → assert the public route changed → flip back (in `finally`) → assert restored; the note names the frontend
reader or "none in frontend/src" (then the row proves only the backend half).
Admin flags (`PUT /admin/site-config/global {flag}`; sports via `PUT /admin/site-config/sports {enabled}`),
Content sections (`PUT /admin/site-content/:key`), owner features (`PUT /api/owner/entitlements {version, features:{key}}` —
only the one key, never the GET'd document), and the upstream rule: owner flag off ⇒ admin ON refused (NOT_ENTITLED) ⇒ public off.
The gateway allows 300 req/min per IP: the script throttles to 4/s and waits out a 429; don't run it during a browser crawl.
`--clear-content` PUTs `{}` to all 7 Content sections (no delete route; empty = frontend default copy).

## 3. Browser pass

chrome-devtools MCP on the shared QA Chrome (`node /Users/apple/Developer/cfz/admins/agents/qa-browser.mjs status`):
`new_page` with your own `isolatedContext`, select your page before each action, localhost URLs, close your pages,
never touch the shuffle.com tab or other agents' pages, never confirm a dialog.

1. Sign in on 3140 in your page (`shuffle-env` login.mjs), then crawl every sidebar path and its inner tabs with [scripts/crawl.js](scripts/crawl.js)
   (set `window.__qaPaths` = the hrefs in `admin/src/configs/navConfig.tsx`, run it by `sourcePath`, poll `__qaDone`, read `__qaOut`).
   A row fails on: an API response ≥ 400, a console error / uncaught error, error text, a redirect off the page, or an empty body.
   It clicks `[role=tab]` only, with alert/confirm stubbed.
2. Same crawl on 5174 with the routes in `frontend/src/lib/router.js` + the page table in `App.jsx` (signed in as the
   `.run/qa-player.local.json` player from `player-api.mjs`).
3. For each (a) row in the matrix: flip it in the admin UI, reload 5174, look at the surface at 1440 and 390 wide
   ([browser-checklist.md](browser-checklist.md)), restore. Money settings (bonus amounts, limits, rates, payment methods)
   are read-only checks — open, don't save.

## 4. Fix and report

Fix in `shuffle/frontend` only (`npm run lint`, `npm run build`). Backend / admin / owner-panel code is synced to every site:
don't edit it here — list the failure with the request, status and response. Commit with explicit paths only.

Money loop (deposit → bets → rollover → withdraw): [money-loop.md](money-loop.md).

Related: `shuffle-env`, `site-connect-audit` (wiring vs hash-game-exchange), `live-qa` (money scenarios), `site-sync`, `hash-sync`, `owner-panel`.
See also the sibling site's version: `stake/.claude/skills/stake-qa`.
