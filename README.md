# shuffle

Player frontend (`frontend/`, Vite :5174) on the shared CFZ platform. `backend/`, `admin/` and `owner-panel/`
are kept the same as main-server and the other sites by the `site-sync` skill (`inhouse/.claude/skills/site-sync`).

| App | Port | Notes |
|---|---|---|
| backend gateway | 4600 (services 4601-4606) | DB `shuffle`, `OWNER_SITE_KEY=shuffle` |
| admin | 3140 | admin theme from bitcasino |
| owner panel | 3145 | |
| frontend | 5174 | Vite proxies `/api` to `VITE_GATEWAY_URL=http://127.0.0.1:4600` |

Setup: copy each `.env.example` (backend `.env`, admin/owner `.env.local`, frontend `.env`),
`node owner-panel/scripts/owner-keys.mjs`, then `cd backend && node scripts/setup.js --yes`.
