# shuffle

CFZ site `shuffle` (repo parkashmi09/shuffle · `main`). Local stack: gateway http://127.0.0.1:4600 (DB `shuffle`),
site admin http://localhost:3140, owner panel http://localhost:3145, player site http://localhost:5174.

Project skills:
- `shuffle-env` (`.claude/skills/shuffle-env`) — ports, start/restart, logins without printing passwords, base URLs
  (`scripts/env.mjs check local`), the player API chain (`scripts/player-api.mjs`).
- `shuffle-qa` (`.claude/skills/shuffle-qa`) — sync check (`scripts/sync-check.sh`), admin/owner on/off → public route
  (`scripts/toggles.mjs`), browser crawl, sidebar → frontend matrix, money loop.

What is whose:
- `frontend/` — shuffle's own player app (React + Vite). Fix site issues there (`npm run lint && npm run build`).
- `admin/` — shuffle's own, isolated site admin (Next.js). Edit it here directly; it is no longer synced from
  the other sites.
- `backend/` and `owner-panel/` — shared with main-server and the other sites: don't edit them here; change them
  through the `site-sync` / `hash-sync` flows.

Reference only: `D:\CFZ\Sites\hash-game-exchange` — read it, never edit, commit, push or merge there (pull is fine).

Other agents commit to this repo at the same time: commit with explicit paths only, never `git add -A`.
Never print or commit credentials from `backend/.env`, `frontend/.env` or `owner-panel/.env.local`.
