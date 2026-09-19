# Frontend ↔ Backend Integration

What the two halves of this repo can actually talk about, what they cannot, and
what was wired.

Written against `backend/docs/api-surface.json` (613 routes) and the live
platform on `http://127.0.0.1:4000`, probed endpoint by endpoint rather than
read off the docs.

Companion: [MISSING-AND-UNWIRED.md](MISSING-AND-UNWIRED.md) lists what still
cannot be answered or is not yet asked.

---

## 0. Current status (snapshot)

The client is no longer capture-only. Auth, wallet (fiat), VIP/rewards, vault,
settings, transactions, affiliate dashboard, favourites / recently-played, the
activity board, game detail + launch, and the casino catalogue (with capture
fallback) all call the API.

**Casino catalogue — how screens ask:**

| UI | Hook | Route when live |
| --- | --- | --- |
| Lobby carousels with a collection map (`slots`, `live-casino`, `game-shows`) | `useLobbySection` | `GET /casino/games/collections/{popular-slots\|live-casino\|hot}` |
| Lobby carousels without a map (`shuffle-games`, `shuffle-picks`, `latest-releases`) | `useLobbySection` | none — capture by design |
| Home tabs Slots / Live Casino / Table Games | `useCategory` + `categoryQuery` | `GET /casino/games?category=slots\|live\|table` |
| Home tab Originals | `useCategory` | none — capture by design |
| `/casino/categories/:slug` browse | same `useCategory` path | same queries as above (plus search for blackjack/roulette/baccarat) |
| Provider rail / providers page | `useProviders` | `GET /casino/games/providers` |
| Provider page | `useProviderGames` | `GET /casino/games/provider/:name` |
| Game screen | `useGame` + `jsGames.launch` | `GET /casino/games/detail/:uuid`, `POST /casino/js-games/v2/launch` |

Empty catalogue tables still fall back to `src/data/catalog.js` /
`categories.js` via `useResource` — seed with `npm run db:seed:demo` (seeder
`004-provider-game-catalogue.js` fills **`gisgamesnew`**, providers, and the
five collection tables). Naming `gis_games` alone is wrong for what the lobby
reads.

Sports-service still does not boot (§2.2). Run
`node scripts/dev.js user admin casino gateway`.

---

## 1. Where the two halves stood

**At the start of integration, `frontend/` had no backend calls of any kind.**
Not a stub, not a disabled call — zero. `grep -rn "fetch(\|axios\|import.meta.env" frontend/src`
returned nothing. There was no `.env`, no proxy in `vite.config.js`, no API
module. Every page rendered from a file:

| Source | Feeds |
| --- | --- |
| `src/data/catalog.js` (1198 lines) | Home banners, 7 lobby rows, 30 providers |
| `src/data/categories.js` (1941 lines) | Category browse pages |
| `src/data/sports-*.json` (9 files, ~570 KB) | The entire sportsbook |
| `src/data/*.html`, `data/blog/`, `data/promotions/` | VIP, affiliate, blog, promo articles |
| Hardcoded arrays in `ActivityBoard.jsx` | Live bets, high rollers, both leaderboards |

`AuthModal.jsx` validated both forms correctly and then said so in a comment:

```js
// No backend is wired yet, so mirror the reference's failed-attempt message.
setStatus("Invalid username or password");
```

**`backend/` is a complete four-service platform** — 66 modules, 613 mounted
routes, 167 tables — with 276 of those routes on the `public` and `user`
audiences, which is the surface a browser may call.

So the gap was not "some endpoints are missing". The two halves had never been
introduced.

---

## 2. Two things blocked startup before any wiring could happen

Both were found by trying to start the platform, not by reading it.

### 2.1 The workspace links were dead — **fixed**

`backend/node_modules/@ibitplay/` held nine **empty directories** where the
workspace symlinks belong. The npm workspace links are Windows junctions; the
directory was copied from `D:\CFZ\bc-games\backend copy` (the path is still
recorded in `docs/api-surface.json`) and a copy does not preserve them. Every
service died identically at `require('@ibitplay/common')`.

`rm -rf node_modules/@ibitplay && npm install` restored them in 3 seconds.

### 2.2 `services/sports/src/modules/bets/legacy/` does not exist — **not fixed**

`bets.service.js:8-20` requires three files from a `legacy/` directory that is
not in the working tree and **has never been committed** (`git log --all --
'*oddsGuard*'` is empty):

```js
const { verifyBetAgainstLiveOdds } = require('./legacy/oddsGuard');
const { getMarketNameFromGtype }   = require('./legacy/marketName');
const { normalizeOdds, marketsfornonfancy, /* +7 more */ } = require('./legacy/markets');
```

sports-service and sports-worker both exit 1 at boot, and `scripts/dev.js`
stops every other service when one dies — so **the whole platform appeared
broken because of these three files.**

This is not reconstructible from the repo. `oddsGuard` re-verifies a submitted
price against the cached book and is, per the comment above it, *"the only thing
standing between a body field and a payout"*; `markets` holds the market
classification tables. Stubbing them would mean writing money-handling logic
with no source to port from, so it was left alone and reported instead.

**Workaround used throughout:** `node scripts/dev.js user admin casino gateway`.
user, admin and casino come up healthy; `/health` reports sports `down`.

---

## 3. What the backend actually answers right now

Probed live. The database (`bc_games` on `127.0.0.1:5433`) is real but only
partly seeded.

| Endpoint | Result | Rows |
| --- | --- | --- |
| `POST /user/auth/register` | ✅ `201 {id, name, email}` | — |
| `POST /user/auth/login` | ✅ `{accessToken, refreshToken, expiresAt, user}` | — |
| `GET /user/auth/me` | ✅ full profile | — |
| `GET /user/wallet/balances` | ✅ 30 currencies as decimal strings | 6 wallets |
| `GET /user/vip` · `/user/vip/levels` | ✅ progress + 75 levels | 75 |
| `GET /casino/bet-history/live` | ✅ real rows | 4 bets |
| `GET /casino/bet-history/top-wins` | ✅ real rows | 2 |
| `GET /casino/bet-history/leaderboard` | ✅ masked handles | 1 player |
| `GET /admin/site-config/public` | ✅ ~60 feature flags | 1 |
| `GET /admin/blogs` | ✅ | 3 posts |
| `GET /user/spin-wheel/slices` | ✅ | 8 slices |
| `GET /user/exchange-rate/rates` | ✅ | ~25 currencies |
| `GET /casino/games` | ⚠️ `200` **empty** until seeded | serving table is **`gisgamesnew`** |
| `GET /casino/games/collections/:name` | ⚠️ empty until seeded | `hot`, `live-casino`, `popular-slots`, `crash`, `indian` |
| `GET /casino/games/providers` | ⚠️ empty until seeded | `gis_providers` / `gis_providers_new` |
| `GET /admin/banners/:type` | ⚠️ `404 BANNERS_NOT_FOUND` | `banners` = 0 |
| everything under `/sports/*` | ❌ service down | — |

The catalogue endpoints **work**; they have nothing to serve until
`004-provider-game-catalogue.js` (or a live aggregator sync) fills them. That
distinction drove the fallback design in §5.

---

## 4. The map: frontend surface → backend route

### 4.1 Wired — endpoint exists and returns real data

| Frontend | Route |
| --- | --- |
| `AuthModal` login | `POST /api/v1/user/auth/login` |
| `AuthModal` register | `POST /api/v1/user/auth/register` |
| session restore | `GET /api/v1/user/auth/me` |
| silent token renewal | `POST /api/v1/user/auth/refresh` |
| logout | `POST /api/v1/user/auth/logout` |
| `TopBar` balance + username | `GET /api/v1/user/wallet/balances` |
| `ActivityBoard` → Latest Bets | `GET /api/v1/casino/bet-history/live` |
| `ActivityBoard` → High Rollers | `GET /api/v1/casino/bet-history/top-wins` |
| `ActivityBoard` → Weekly Race | `GET /api/v1/casino/bet-history/leaderboard` |
| `ActivityBoard` → My Bets | `GET /api/v1/casino/bet-history` |
| feature flags | `GET /api/v1/admin/site-config/public` |
| `UserMenu` VIP card — tier badge, progress bar | `GET /api/v1/user/vip` |
| `VipPage` (signed in) — rank, progress, next level | `GET /api/v1/user/vip` |
| `VipPage` → VIP levels — the 75-band ladder | `GET /api/v1/user/vip/levels` |
| `VipPage` → Your Rewards — the three recurring bonuses | `GET /api/v1/user/bonus` |
| `VipPage` → Your Rewards — claim one | `POST /api/v1/user/bonus/claim/:type` |
| `VipPage` → Your Rewards — rakeback balance | `GET /api/v1/user/rakeback` |
| `VipPage` → Your Rewards — claim it | `POST /api/v1/user/rakeback/claim` |
| `UserMenu` → Redeem Code modal | `POST /api/v1/user/bonus/redeem` |
| Admin → Redeem Codes (create / list) | `POST` / `GET /api/v1/admin/user/bonus/codes` |
| Admin redeem — player search | `GET /api/v1/admin/staff/players?search=` |
| Game screen — detail | `GET /api/v1/casino/games/detail/:uuid` |
| Game screen — launch | `POST /api/v1/casino/js-games/v2/launch` |
| Favourites (star + `/favourites`) | `GET/PUT/DELETE /api/v1/casino/games/favourites…` |
| Recently played (`/casino/recently-played`) | `GET /api/v1/casino/games/recently-played` |
| Vault modal | `GET /api/v1/user/vault/*` (+ lock / unlock POSTs) |
| Transactions tabs | `GET /api/v1/user/history/*` (and related deposit/withdraw lists) |
| Settings — account / KYC / 2FA / preferences / sessions | profile, kyc, `/user/2fa/*`, preferences, `/user/auth/sessions` |
| Affiliate dashboard (signed in) | `GET /api/v1/user/affiliate/*` (+ reward claims) |
| Wallet — fiat deposit | `GET /user/bank-details/:coin`, `POST /user/deposits/fiat` |
| Wallet — fiat withdraw | `POST /user/withdrawals/fiat` |

> Auth, VIP claims, and wallet fiat paths have been run against a live backend.
> The two VIP claim POSTs were exercised on their **refusal** path only —
> `RAKEBACK_NOTHING_TO_CLAIM` (409) and `BONUS_VIP_LEVEL_TOO_LOW` (403) — because
> the test player has no wager and so qualifies for neither. **Neither claim has
> ever been observed paying out.** They move money; that is the next thing to
> check against an account that actually qualifies.
>
> Game launch needs a working js-games / operator upstream account; Fun Play is
> disabled on purpose (it would invent a session).

### 4.2 Wired behind a fallback — route works, table may be empty

Rendering an empty lobby against an empty table would wreck a pixel-accurate
clone, so these read the API and **fall back to the static file when the answer
is empty**. Seed the tables and the same code shows live data with no edit.
Policy lives in `frontend/src/lib/useResource.js` (`isLive` when adopted).

| Frontend | Hook / entry | Route | Fallback |
| --- | --- | --- | --- |
| Lobby carousels `slots`, `live-casino`, `game-shows` | `useLobbySection` → `ROW_COLLECTION` | `GET /api/v1/casino/games/collections/{popular-slots\|live-casino\|hot}` | `data/catalog.js` section games |
| Lobby carousels `shuffle-games`, `shuffle-picks`, `latest-releases` | `useLobbySection` (no collection) | — | capture only (by design — see below) |
| Home tabs **Slots / Live Casino / Table Games** | `HomeCategoryTab` → `useCategory` + `categoryQuery` | `GET /api/v1/casino/games?category=slots\|live\|table` | pooled capture from lobby rows |
| Home tab **Originals** | `useCategory` with empty query | — | capture only |
| `/casino/categories/:slug` | `CategoryPage` → same `useCategory` | `category` or `search` per `lib/categories.js` | `data/categories.js` |
| Provider rail, `ProvidersPage` | `useProviders` | `GET /api/v1/casino/games/providers` | brand roster + capture art |
| Provider page | `useProviderGames` | `GET /api/v1/casino/games/provider/:name` | `lib/providerGames.js` |
| `HeroBanners` | `useBanners("home")` | `GET /api/v1/admin/banners/home` | `data/catalog.js` banners |

**Why some lobby / category surfaces stay on capture even when the API is up:**

- **Shuffle Games / Originals** — in-house titles live outside the aggregator
  catalogue (`gisgamesnew`); there is nothing honest to ask for.
- **Shuffle Picks** — editorial curation; inventing a filter would invent the
  list, not read it.
- **Latest Releases** — wants newest-first; browse has no sort key.
- **Game Shows** (as a category slug) — a studio format, not a normalised
  `tags` value. The home *lobby row* named game-shows maps to the `hot`
  collection; the category browse slug does not.

`categoryQuery` live map: `slots` → `slots`, `live-casino` → `live`,
`table-games` → `table`, `crash` → `crash`, plus
`blackjack` / `roulette` / `baccarat` via `search`.

### 4.3 Reachable API, screen still missing or inert

Routes exist; the UI either has no page yet or the control does not call them.

| Surface | Routes idle / unused by FE |
| --- | --- |
| Global Search button | `GET /casino/games/search` — declared in `endpoints.js`, never imported |
| Notifications panel | `GET /user/notifications` (+ unread / mark-read) — panel always shows empty state |
| Swap, P2P, gift cards, spin wheel | modules on user-service; no screens |
| Club / team | player routes exist; no screens |
| Withdrawal whitelist, bank-details admin UX beyond deposit | partial |
| Payment orders / on-ramp | provider-gated; Buy Crypto tab disabled |
| Site blogs for BlogPage | `GET /admin/blogs` — FE still renders 28 captured HTML articles |
| Casino game stats endpoint | `GET /casino/games/stats` — unused (tile stats use bet-history) |
| Legacy GIS / catalogue launch | FE launches via js-games v2 instead (§4.1 / GamePage) |

**Came off this list (now wired):** wallet fiat deposit/withdraw, vault modal,
transactions page, settings (account / verify / security / preferences /
sessions), affiliate dashboard (`/affiliate/{overview,referred-users,campaigns,earnings}`),
VIP bonus + rakeback claims, favourites + recently-played, game launch.

### 4.4 Not wireable — no backend for it (or wrong product shape)

| Frontend | Why |
| --- | --- |
| **The entire sportsbook** (`SportsPage`, `SportPage`, `CompetitionPage`, `FixturePage`, 9 JSON files) | §2.2 — service will not boot. And even fixed: `SPORTS_FEED_URL` is the placeholder `https://feed.example.com/api`, and the upstream is a cricket-exchange feed (fancy markets, `gmid`/`gtype`) whose shape has nothing in common with the captured Shuffle sportsbook. This is a rewrite, not a wiring job. |
| `LotteryPage` | No lottery module |
| `AirdropPage` | No airdrop module |
| `ChallengesPage` | No challenges module |
| `PromotionsPage`, `PromotionArticlePage`, `TournamentsCarousel`, `WeeklyRaceModal` | No promotions/tournaments module; content is captured HTML |
| `BlogPage` | `/admin/blogs` exists and has 3 rows, but they are plain-text posts; the frontend renders 28 captured Shuffle HTML articles. Different content model. |
| Google / Line / Telegram buttons | No OAuth on the backend |
| Opening a game **via Slotegrator GIS** | `/casino/catalogue/launch`, `/casino/gis/launch` still need aggregator credentials — but the **player path in use** is `POST /casino/js-games/v2/launch` (GamePage). Launch still needs operator upstream credentials for that provider account. |
| `SeoArticle`, the **marketing** `/affiliate` page, and the **signed-out** half of `/vip-program` | Static marketing copy by design. Signed-in VIP and signed-in affiliate dashboard are live. |
| Wallet → Tip, crypto withdraw create, Buy Crypto | See [MISSING-AND-UNWIRED.md](MISSING-AND-UNWIRED.md) — Tip has no P2P transfer route; crypto withdraw has history GET only; Buy Crypto needs an on-ramp. |

---

## 5. How the client is built

Under `frontend/src/lib/`:

**`api.js`** — one `fetch` wrapper. Unwraps `{success, data, meta}`, throws
`ApiError` carrying the backend's stable `error.code` (never the message —
per `backend/docs/API-ROUTES.md` §5 the message is for humans and may be
reworded), returns `null` on `204` without parsing it, attaches the bearer
token, and on a `401` refreshes once and replays the request — with a single
shared in-flight refresh so ten parallel 401s cause one refresh, not ten.

**`endpoints.js`** — named clients (`auth`, `casino`, `jsGames`, `betHistory`,
`funding`, `vault`, `affiliate`, …) over that wrapper.

**`session.jsx`** — `SessionProvider` / `useSession`. Holds user, balances and
tokens; persists to `localStorage`; restores by calling `/auth/me` on mount.

**`useResource.js`** — `useResource(key, fetcher, fallback)` returns the
fallback immediately, swaps in the API answer when it arrives and is
non-empty, and keeps the fallback on error or empty (`isLive`). `useApi` is
the no-fallback twin for auth-scoped or single-entity reads.

**`catalogue.js`** — casino hooks: `useLobbySection`, `useCategory`,
`useProviders`, `useProviderGames`, `useBanners`, `useGame`, `useRecentlyPlayed`.
Collection map and “ask nothing → stay on capture” rules live here and in
`categories.js` (`categoryQuery`).

**`adapters.js`** — backend shape → the shape the components already render, so
no component's JSX or class names changed. `gisgamesnew` rows become lobby
cards via `toGameCard` (`href: /casino/games/:uuid`); bet rows become board
rows.

**`favourites.jsx`** — signed-in favourite set; tile star writes through
`casino.addFavourite` / `removeFavourite`.

Config: `vite.config.js` proxies `/api` → `127.0.0.1:4000`, so the browser is
same-origin in dev. `VITE_API_BASE` overrides for other setups, and
`.env.example` documents both.

### The proxy has to strip `Origin`, and here is why

Proxying is not quite enough on its own. A same-origin **GET** carries no
`Origin` header, so every read proxied cleanly — but a browser *does* send one
on a same-origin **POST**, naming the dev server (`http://192.168.1.8:5174`).
The gateway's CORS middleware then refused a request the browser had never
treated as cross-origin:

```
Origin http://192.168.1.8:5174 is not allowed by CORS
```

The symptom is nasty: every read works, the lobby and the live board populate,
and only *login* fails — which looks like an auth bug and is not one. Once
proxied the call is server-to-server and has no web origin, so the proxy removes
the header (`stripOrigin` in `vite.config.js`). That is what the request
actually is, and it also stops `CORS_ORIGIN` in `backend/.env` needing an entry
per dev port and LAN address.

A **deployed** frontend calling the API directly (`VITE_API_BASE`) is genuinely
cross-origin and must be listed in `CORS_ORIGIN`. None of this changes that.

### The signed-in header

Built from the reference's **own SCSS modules**, not from guesswork. The capture
under `assets/webpack---_N_E/src/` is a source-map extract of the site's
stylesheets, and it includes the whole header tree:

```
components/Header/Header.module.scss              already in shuffle-home.css
components/Header/HeaderWalletActions.module.scss  "
components/Header/HeaderBalanceSelector.module.scss
components/Header/Balance/{BalanceSelect,BalancePopup,BalanceItem,BalanceTypeSearch}.module.scss
components/Header/IconMenu/{IconMenu,IconMenuItem}.module.scss
components/Header/UserMenu/{UserMenu,ExpandMenuElement}.module.scss
```

The first two ship in the signed-out bundle, so the capture already had them.
The rest only load once a session exists, which is why they were missing — the
capture was taken signed out. `src/styles/shuffle-header.css` is those files
compiled by hand, same declarations in the same order, with the
`@include media-query.*` mixins expanded using the real definitions from the
captured `styles/media-query.scss` (`(true)` is the reference's stand-in for a
container query: the breakpoint shifts by the width of whichever rails are open,
which is what the `.magic-container` class on `<main>` encodes).

The stylesheet came from those modules; the **markup** was then read element by
element off the live signed-in header, because CSS alone does not say what the
DOM is — and three things were wrong when it was inferred:

| Inferred | Actually |
| --- | --- |
| Icons nested inside `navMenu` | A **sibling** of it. `Header_navContainer` is `space-between` over *three* children — logo, wallet group, icon group — and that is what centres the balance. Nested, the whole lot slides right. |
| `walletBtn` on a wrapper `div`, with `roundedWalletButton` inside | `walletBtn` is on the **button itself**, and `roundedWalletButton` is not used here at all — it belongs to the Shuffle US variant. |
| Wallet button a sibling of `BalanceSelect_root` | **Inside** it. See below — this sets both the gap and the popup's anchor. |
| Balance amount in a `<p>` | Two nested spans: `IconValue_root > FormattedAmount_root BalanceSelect_amount`. |
| The coin's own amount | The wallet's worth in a **display fiat**: `₹0.00` beside an ETH mark. |
| Bell, crown, chat | **Bet slip**, crown, chat. Notifications are a row in the account menu, not a bar icon. |
| 7 invented menu rows | 13 real ones, led by a VIP card linking to `/vip-program`. |
| Sidebar unchanged by signing in | It grows a **Profile** group and a **Shuffle Wise** link. |

**The `<p>` was the first gap.** The reference's own stylesheet carries
`.balanceBtn p { margin-right: var(--spacing-md2) }`. That rule never fires on
the live site because nothing inside the button is a paragraph — but it did
here, adding 16px inside the pill.

**The Wallet button's parent was the second.** Measured on the live site,
`BalanceSelect_root` is 217.8px wide against a 117.5px pill and a 92px button:
`117.5 + 8 + 92`. The button is *inside* it, and two things follow —

- **the gap is 8px**, from that element's own `gap: var(--spacing-sm4)`, not
  `btnContainer`'s `column-gap: var(--spacing-sm5)`, which never applies because
  `btnContainer` is left holding a single child; and
- **the popup anchors to the pill *and* button together.** It is `position:
  absolute; left: 50%` against the nearest positioned ancestor, which is
  `BalanceSelect_root`. At 217.8px that is `left: 108.912px` — what the live
  site computes. With the button outside, the root shrinks to the pill and the
  panel hangs off to the left.

**Display currency.** The header's figure is the selected wallet converted
through `GET /user/exchange-rate/rates` (`usdRate` is USD per unit, so
`amount × rate(from) ÷ rate(to)`). `userconfig` has no column for the choice —
only theme, language and two notification flags — so it lives in `localStorage`,
defaulting to INR to match the reference. No rate for either side falls back to
the coin's own amount rather than printing a figure it cannot stand behind.

**Geometry, measured at 1536px against the live header — every row identical:**

| | Live | Clone |
| --- | --- | --- |
| Logo wrapper | `x 272 · w 196 · h 76` | same |
| Logo image | `x 296 · w 172 · h 28` | same |
| `BalanceSelect_root` | `x 769.84 · w 217.82` | same |
| Balance pill | `x 769.84 · w 117.47` | same |
| Pill → Wallet gap | `8px` | same |
| Wallet button | `x 895 · w 92 · h 48 · r 6` | same |
| Popup anchor | `left: 108.912px` | same |
| `userActions` | `x 1290 · w 190` | same |
| Icon buttons | `x 1290 / 1340 / 1390` | same |
| Account button | `x 1440 · w 40` | same |
| Menu panel | `w 260` | same |

The logo was never wrong — the same `<a><img height="28" src="/icons/logo.svg"></a>`
in the same 196px wrapper, at the same coordinates. What differed was the pill's
width, and that came from the `<p>` and the button's parent, both above.

**The sidebar** grows two things once a session exists, in the live order
`… Providers → Profile → VIP → Blog → Affiliate → Shuffle Wise → Live Support`:
a **Profile** `ExpandableLinks` group (Wallet, Vault, Transactions, Settings)
and a **Shuffle Wise** link. Both are signed-in only, and that is verified
rather than assumed — the signed-out capture renders its whole nav server-side
and contains neither `icons/profile.svg` nor a Shuffle Wise link ("Shuffle Wise"
appears there only in the i18n string table).

The Profile group sits inside a `NavigationLineBreakWrapper`, which is what
draws the hairline above it. **That class had no CSS in this repo at all** —
`NavContent.jsx` had been applying it to the two sport directories since the
clone was built, and the capture never carried its rules, so nothing drew
anywhere. Read off the live stylesheet and added:

```css
.NavigationLineBreakWrapper_root        { margin: var(--spacing-sm1) 0;
                                          border-top / border-bottom: 1px solid var(--color-gray700) }
.NavigationLineBreakWrapper_root > div  { border-bottom: …; padding: var(--spacing-sm5) 0 }
.NavigationLineBreakWrapper_root > div:last-child { border-bottom: 0 }
.NavigationLineBreakWrapper_expanded    { margin: var(--spacing-sm5) 0 }
```

So this also restored the dividers around **Lottery / Airdrop / Promotions** and
**All Sports / All Esports**, which had been missing them silently.

And the `<hr className="NavDivider_root">` that separates the casino categories
from the site-wide links is now **signed-out only**. Signed in, the Profile
wrapper closes that section with its own `border-bottom`, and keeping the rule
as well drew two hairlines a few pixels apart. The live nav has no `<hr>` at all
in that state — `Providers → NavigationLineBreakWrapper → VIP`, verified by
counting `hr` elements in its nav — while the signed-out capture has two (the
desktop rail and the mobile panel). Both states now match.

**Icons** are the site's own SVGs — `bet-slip`, `crown`, `wallet`,
`user-profile`, `shield-lock`, `notifications`, `transactions`, `redeem-code`,
`setting`, `shuffle-wise`, `logout`, plus `images/vip/unranked.svg`. An earlier
pass hand-drew approximations; those are gone. `crown.svg` turned out to be
byte-identical to the `vip.svg` already in the capture.

**One rule in `shuffle-header.css` is heavier than the reference's**, and says
why inline: `div.UserMenuVipCard_progressBarContent { padding: 0; background: none }`
cancels the VIP-progress block's 24px inset inside the menu card, but
`shuffle-home.css` also carries four container-scoped copies of that padding
(`.magic-container.left-side-opened-only .ProgressBarSection_graphContent`,
three classes) which outrank it. They do not collide on the live site because
its CSS modules are split per route and those blocks ship with the VIP page's
chunk. This clone bundles every stylesheet together, so the override needs one
more class to win.

| Piece | Source |
| --- | --- |
| Balance pill + currency popup | `GET /user/wallet/balances`, live |
| Selected currency | `localStorage`, falling back to the largest holding when the stored code is not in the response |
| Account name | session `/auth/me` |
| VIP card — tier badge and progress bar | `GET /user/vip`, live |
| Logout | `POST /user/auth/logout`, live |
| VIP and Affiliate Program menu rows | anchors to `/vip-program` and `/affiliate`, routed client-side |
| Wallet / Vault | open live modals (`shuffle:wallet` / vault) |
| Transactions / Settings | routed to live pages |
| Notifications row | opens the panel (empty until wired — §4.3) |
| Bet slip, chat icon buttons | rendered, inert — no sportsbook / chat module |

The inert controls use `ButtonVariants_keepEnabledStyle`, the reference's own
variant for keeping an enabled appearance on a `:disabled` button, so they look
right rather than greyed. Menu items that truly have nowhere to go get
`cursor: not-allowed` on hover — the one rule in that stylesheet that is ours
rather than the reference's, and it is marked as such. Delete it as the screens
get built.

**Icons.** The capture holds only signed-out icons, so `wallet`, `receipt`,
`crown`, `user`, `settings`, `logout`, `transactions` and `vault` were drawn to
match the set already in `public/icons/` — 16×16, `fill="none"`, round caps and
joins.

### The wallet modal

Opened from three places — the header's Wallet button, the rail's Profile →
Wallet, and the account menu's Wallet — all through a `shuffle:wallet` window
event, the same pattern the auth modal already used.

**Nothing about it was in the capture.** The modal is a lazily-loaded chunk a
signed-out visitor never fetches, so neither its SCSS nor its markup reached
`assets/`. Both were read off the live signed-in modal at `?modal=wallet` —
rules out of `document.styleSheets`, structure out of the DOM — and are in
`src/styles/shuffle-wallet.css`. Measured there: a 540px body on gray900 with
an 8px radius, `ModalContent_modalContent` supplying a 40px inset, four tabs in
the same `TabViewOutline` the auth modal uses, and the tab mirrored into the URL
as `?modal=wallet&md-tab=…`.

**The four tabs against what this backend can actually do:**

| Tab | State |
| --- | --- |
| **Deposit — fiat** | ✅ fully wired. `GET /user/bank-details/:coin` publishes the account, each row copyable; `POST /user/deposits/fiat` files the claim. Sent as `FormData` because the route is `multer().single('screenshot')` — a JSON body never reaches the validator. |
| **Deposit — crypto** | ⚠️ `GET /user/crypto/chains` answers `CRYPTO_PROVIDER_DISABLED`; CCPayment is not configured. The network select, address and QR render behind the reference's own `Deposit_contentBlur` with the reason stated. **No address is invented** — that would be inventing somewhere for real money to go. |
| **Withdraw — fiat** | ✅ fully wired. `POST /user/withdrawals/fiat`, with the validator's conditional rule mirrored client-side (holder name always; INR needs IFSC **or** UPI; other currencies need bank name + account + IFSC together) so a player is told before the request, not by a 422 after it. Balance-capped, with the reference's 25/50/75/MAX row. |
| **Withdraw — crypto** | ⚠️ there is no POST. `GET /user/withdrawals/crypto` serves history only, so the tab says so rather than offering a button wired to nothing. |
| **Buy Crypto** | ❌ no on-ramp module; `payment-orders` answers `PAYORDER_PROVIDER_DISABLED`. |
| **Tip** | ❌ no player-to-player transfer route in any of the four services. |

The currency list is the player's own wallet rather than a fixed catalogue, held
balances first, each row showing its worth in the display fiat — the same
conversion the header uses. Codes are written the reference's way,
`Tether (USDT)` rather than `USDT`; the names are in `src/lib/currencies.js` and
an unlisted code falls back to itself, which is what the platform's own ledger
columns (`BJB`, `NC`, `SC`) get.

**On the unconfigured crypto state.** A first pass put the explanation in a
`Deposit_walletGeoRestrictionBlock` and blurred the address and QR with
`Deposit_contentBlur`. Both are the reference's own classes but neither belongs
here: the block added ~110px of flat grey the real modal has nowhere in that
column, taking the modal to 705px against the reference's ~610, and the blur's
`inset: -16px` bleeds past its wrapper and smears the warning underneath it. The
rows now render at their real sizes with an empty disabled address field, and
the reason goes in the `WarningMessage` slot the layout already has. Both rules
stay in the stylesheet for the geo-block they were written for.

One rule in that stylesheet is ours, and says so inline:
`.ActivityBoard_selectOption .CurrencySelect_wrapper { width: 100% }`. The
reference's popup markup was never captured, so the list reuses this clone's own
`ActivityBoard_selectPopup`, and the reference's row class has to be told to
fill it before `space-between` has anything to spread.

### The VIP page

`/vip-program` is two pages behind one route, and the reference switches on
whether anybody is signed in. This clone served the signed-out one to everyone,
including players whose rank the backend had been able to answer since
`modules/vip` was written.

**Signed out** — hero, Getting started, The advantages, The benefits, FAQ. This
was the page's captured HTML rendered through `dangerouslySetInnerHTML`, with an
effect reaching into the DOM to work the accordions. It is now components with
the same classes, element for element, so the benefits table and the FAQ can be
shared with the signed-in page instead of existing twice.

**Signed in** — `VIP Program` title, an overview card, Your Rewards, VIP levels,
The benefits. Its markup and its conditions come from the reference's own page
chunk (`_next/static/chunks/pages/vip-program-*.js`, which is shipped
un-minified enough to read) and its CSS from `_next/static/css/fbe8cdf1…css`,
de-hashed into `src/styles/shuffle-vip.css`.

| Section | Source |
| --- | --- |
| Overview — badge, rank, progress bar, next level | `GET /user/vip`, live |
| VIP levels — 5 tier accordions over 75 bands, locked until reached | `GET /user/vip/levels`, live |
| Your Rewards — Instant Rakeback | `GET /user/rakeback` + `POST /user/rakeback/claim` |
| Your Rewards — Daily / Weekly / Monthly Bonus | `GET /user/bonus` + `POST /user/bonus/claim/:type` |
| The benefits | Published schedule, a literal in both — it is what the *programme* offers per rank, not a reading of the account |

**The two ladders are not the same shape.** The reference names its levels
(`BRONZE_1` … `MYTHIC`) and reads them from site config. This platform numbers
them: 75 bands, each carrying a `card` tier. A tier here is therefore a *run of
levels* sharing a card, which is exactly the grouping the reference's accordions
render. `groupByTier` reads the run boundaries off the data, so a band added to
the ladder appears with no edit on this side.

**The reference has seven reward states; this platform can tell three.**
`locked` (the bonus needs a VIP level not reached), `claimable` (an award is
waiting *and* the player qualifies — the backend computes both, which is the fix
for a legacy bug where the API reported ineligible and the claim route paid out
anyway) and eligible-with-nothing-waiting. The reference would show a countdown
to the next claim in that last state; there is no next-claim timestamp anywhere
in `bonus.service.js`, so the card says "Wager to Unlock" rather than a time it
cannot stand behind.

**Verified.** The signed-out page was measured against the live one at the same
viewport and rail state: every section offset and height matches to within the
0.8px-per-text-block the font files differ by (3.2px cumulative over a 2756px
page). Two findings came out of the measurement — see §"A frozen animation reads
as a layout bug" below.

The signed-in page **was** measured against the live original, once a browser
holding a shuffle.com session was connected. At 1536px with the rail expanded,
every section matches:

| | reference | clone |
| --- | --- | --- |
| Overview card | 1184×366, 32px padding, 48px gap | same |
| Overview artwork | 536×302 | same |
| Your Rewards | 1184×301, `margin-top: 24px` | same |
| Reward cards | 4 × 278×257, 24px padding | same |
| The benefits | 1184×499, 8 ranks, same ticks | same |
| VIP levels | 1184×723, 9 accordions | same |

The last row was the one real divergence and is now closed — see below.

### The VIP ladder was replaced

The clone first rendered 5 accordions against the reference's 9, because the
two platforms had different ladders. The reference publishes **41 levels in 9
tiers** — Wood (500 XP), then Bronze/Silver/Gold/Platinum/Jade/Sapphire/Ruby/
Diamond at five sub-levels each, to Diamond 5 at 37,000,000.
`packages/common/src/vipLevels.js` held the legacy **75 numbered levels in 5
cards**, 1 XP to 15,058,625,000, which never issued Jade, Sapphire or Ruby at
all — ranks the benefits table promises and Sapphire being the one it says
unlocks a VIP host.

The reference's ladder was adopted, thresholds read off its own signed-in page
rather than guessed. **This moved every player**, and nothing was migrated
because nothing is stored: a level is a function of lifetime wager, and the
function changed. The entry point rose (1 XP → 500) and the top fell about 400×
(15,058,625,000 → 37,000,000).

`level` stayed an ordinal 1…41 — every caller compares it numerically, and a
named string would have broken `bonus.service.js`'s gate and the admin reports'
sort silently. A `name` field carries "Bronze 1"; `vip.service.js`, the profile
read, the socket payload and the player report all pass it through, so nothing
downstream rebuilds a rank from a tier and an offset. That matters for Wood,
which is one level in its own tier and has no number after it.

**The bonus gates moved with it, and they loosened.** They are level numbers:
20/25/30 meant 29,000/45,000/69,000 on the old ladder and would have meant
900,000/1,650,000/3,800,000 on the new one. They are now 2/2/7 — Bronze 1,
Bronze 1, Silver 1 — which is where the reference puts them, and which its own
locked cards name. So the daily and weekly bonuses are reachable 29× and 45×
sooner than before, and the monthly nearly 7×. `bonus.constants.js` says so at
the point of change; if the ladder is ever reverted these have to move back in
the same commit.

Daily and weekly now share a gate, so the test asserting "each bonus type has
its own VIP threshold" was asserting a rule the platform no longer has; it now
checks that the gates separate the monthly bonus from the other two, and that
the first band (Wood) is still below every gate.

**Four things the measurement caught, all of them mine rather than the
reference's.** A fourth line on the overview card reading "N XP to Bronze 1",
added on the reasoning that a percentage with no denominator does not say how
much further it is — the reference's card has three things on it. "Reach VIP 20"
as a locked card's status, where the reference returns
`vipBonusWagerToUnlockTxt` ("Wager to Unlock") and puts the level on the button
only. A `Card_description` under each reward name carrying the pending amount,
which the live card does not have and which made the cards 279px against 257.
And "Daily Bonus" where the live page says "Daily Rakeback" — the label now
follows the reference, though the money still comes out of `dailybonus`, which
is a bonus column and not a rake calculation.

**`vipOverviewImage` goes on the `<img>`, not on a wrapper.** The overview's
artwork was built as `div.vipOverviewImage > img.VipPageOverview_image` while
the file was still missing, and that nesting is wrong: the class carries
`width: 100%`, `min-height: 10rem`, `overflow: hidden` and the rounded
`--color-gray800` panel, and the reference puts all of it on the image itself.
Wrapped, the div took the sizing and the `<img>` inside had none, so a 3840×2160
file rendered at its own scale rather than the column's. As a bare `<img>` it is
536×301.5 — the column width at the file's own 16:9 — which is what the
reference's markup produces. `VipPageOverview_image` belongs to a different
element and is not used on this page.

The file itself had to be saved by hand: it is 1.9 MB, the shell has no outbound
network (`curl` exits 43 even unsandboxed), and the browser bridge that carried
the nine VIP icons in a slice at a time refuses downloads outright — a scripted
`<a download>` and a real synthesised click on one both completed silently with
no file written.

**The menu row was declared and never read.** `items` in `UserMenu.jsx` carried
an `href` on VIP and Affiliate Program from the start, and `MenuRow`
special-cased only Wallet — so both rendered as disabled buttons alongside the
rows that genuinely have nowhere to go, and clicking either did nothing even
though the affiliate page had existed all along. They are anchors now, so they
also get a middle-click and a status bar, with the click intercepted to route on
this side rather than reload the app. The VIP card at the top of the panel was a
plain `<a>` doing a full page load; it routes now too.

**`src/data/vip.html`** is no longer imported. It is kept because it is the only
copy of the rendered public page anywhere in the repo — `assets/` has the chunk
and the stylesheet but not the HTML — and it is what the page's copy was read
from.

### The token dashboard and the motion vocabulary

`/token` is built, and like `/vip-program` it is **two pages behind one route**.
Measured in both states on the live site:

    signed out  header · hero · rule · site stats · graphs · links · promos
    signed in   … plus the two unlock tiles, the lottery staking block, and the
                second rule that separates it

That split is not arbitrary — the tiles report a rate against *your* wagering
and the lottery block stakes *your* balance, so neither means anything without
an account. The hero copy changes with the session too: a visitor is sold the
airdrop, a player is told the round is running.

**A first pass got several things wrong, every one caught by measuring the live
page rather than reading the captured chunk.** It rendered all ten sections signed out, so a
visitor was offered a staking form. It guessed the fourth graph card as "Market
Cap" when the live one is "SHFL Lottery", and the period select as 24H/7D/30D/1Y
when it is Daily/Weekly/Monthly. It rendered `TokenLineDash` as an empty div,
but both of that component's rules target `> hr` children, so every divider drew
nothing. And the charts collapsed to 0×0 — `.TokenChartContainer_chart` is
`height: 100%` inside a card in an auto-sized grid row, so the percentage had
nothing definite to resolve against and recharts logged
"The width(0) and height(0) of chart should be greater than 0" once per card;
the plot height is now pinned to the 144px measured on the live page.

Three more came out of a second review, and they are all the same mistake —
using a class that *looks* right rather than the one the reference uses.
`HeroBanner_heading` belongs on an `<h2>` inside a bare `div`, not on a styled
div; the body is `HeroBanner_description > p.TokenBanner_text`, and putting the
copy straight into the description skips the class carrying its size, colour and
alignment; and the hero button is `TokenHeroBannerContent_signUpButton`, not
`HeroBanner_linkButton` — the latter is the reference's *text-link* variant and
brings `text-decoration: underline` plus a text-shadow with it, which is exactly
what was showing on the button. `TokenClaimableTiles_fiat` was the same trap in
the tiles: it carries `min-width: 8rem` and the reference does not use it in
that row at all, so wrapping the `=` in it opened 128px of dead space.

`TokenLineDash` needed the SHFL mark: the divider is `<hr><img/><hr>`, and the
`column-gap` exists to sit the logo between the two dashed runs.

**The deployed page is not the captured one.** shuffle.com has redeployed since
`assets/` was taken: the captured `pages/token-*.js` chunk has no airdrop hero,
no `TokenClaimableTiles`, no `TokenHeroTile` and no `TokenLineDash`, and the
live page has all four. Both `shuffle-token.css` (478 rules) and the markup were
read off the deployed page so they agree with each other; mixing the captured
stylesheet with live markup would have matched neither.

**`recharts`, because the reference uses `recharts`.** Its chart markup is
`recharts-responsive-container` > `recharts-wrapper`, so choosing the same
library means the DOM, the class names and the rendered SVG line up rather than
approximate. It costs ~360 kB raw / ~105 kB gzipped.

Nothing on the page is wired — no token module in any service, no SHFL rate —
so the figures live in `components/token/tokenData.js` with the date they were
read, and the staking form's submit is `disabled` for the same reason the
wallet's Buy Crypto tab is.

### The motion vocabulary

shuffle.com animates with framer-motion, and every entrance on the site comes
from **one module of twelve shared variants**. `styles/shuffle-motion.css` is
that module transcribed — the offsets, durations and easings are the
reference's, each as a keyframe plus a `motion-*` class, with `--motion-delay`
for staggering.

Two honest gaps, both noted in the file: CSS has no spring, so
`--motion-spring` is a cubic-bezier that overshoots similarly rather than
identically; and CSS cannot hold an element alive to animate it out, so the two
exit variants are not reproduced. Everything is switched off under
`prefers-reduced-motion: reduce`, which the reference does not do — a
thirty-second scale on a full-bleed banner is exactly what that setting is for.

The VIP hero animation added earlier now sits on the shared `shuffleRise`
keyframe instead of a private copy.

### Design rules held to

- **No component's markup changed.** The clone is pixel-matched against
  shuffle.com; every `className` is verbatim. Wiring changed where data comes
  from, never what is rendered.
- **A dead backend must not blank the site.** Every read has a static fallback,
  so `npm run dev` in `frontend/` alone still renders the full clone.
- **Branch on `error.code`, never `error.message`.**
- **The access token lives in memory + `localStorage`.** A refresh-token cookie
  would be better and needs a backend change (the token is in the JSON body
  today); noted, not silently worked around.

---

### Running the tests

The DB-backed suites look for `ibitplay_test` and skip with "No test database
reachable" when it is absent, which is how they behaved before this work — so
the assertions in them were never running. It is created the same way as the
dev database:

```
DB_NAME=ibitplay_test npm run db:create
DB_NAME=ibitplay_test npm run db:migrate
DB_NAME=ibitplay_test npm run db:seed      # roles — the reports suite needs them
```

then run with the dev credentials in the environment (`DB_PORT`, `DB_PASSWORD`
from `.env`). With that in place: **1210 of 1229 pass**. The 19 failures are
`services/sports` — which cannot load at all, §2.2 — plus socket, provider-feed
and transaction-history masking tests. None of those modules reference the VIP
ladder.

## 6. Running it

```bash
# backend — omit `sports` until §2.2 is resolved
cd backend && node scripts/dev.js user admin casino gateway

# frontend
cd frontend && npm run dev
```

`curl localhost:4000/health` — expect user/admin/casino `ok`, sports `down`.

To see §4.2 switch from fallback to live data, seed the catalogue:

```
cd backend && npm run db:seed:demo
```

That runs (among other demo data) `004-provider-game-catalogue.js`, which fills
**`gisgamesnew`**, `js_games`, provider tables, and the five collection lists
(`hot_games`, `live_casino`, `popular_slots`, `crash_games`, `indian_games`).
Lobby collections and `?category=` browse then go live; banners still need
rows in `banners` (or admin) separately.

### Verified end to end

In Chrome against the running platform:

| | |
| --- | --- |
| Register → auto-login → session | ✅ tokens stored, header switches |
| Reload | ✅ session restored from `/auth/me`, no signed-out flash |
| Header | ✅ live balance pill + username from `/wallet/balances` |
| Latest Bets | ✅ the 4 real rows; `classic_dice` resolved to the captured "Dice" artwork, multipliers derived from stake and profit (25 staked, +25 profit → `2.00x`, payout 50) |
| Weekly Race | ✅ live row, backend's masked handle `Player 2207`, prize column deliberately blank |
| My Bets | ✅ enabled only when signed in; 0 rows for a new account, with no capture standing in |
| Logout | ✅ tokens cleared, header reverts, My Bets disabled again |
| **API unreachable** | ✅ 135 game cards, 56 providers, 10 captured board rows — the full clone, no blank regions |

---

## 7. What to fix next, in order

1. **Restore `services/sports/src/modules/bets/legacy/`** from wherever the port
   was done. Nothing in the sportsbook moves until sports-service boots.
2. **Seed catalogue + banners** if not already — `npm run db:seed:demo` for
   `gisgamesnew` / collections / providers; seed or admin-set `banners` for the
   hero. Code in §4.2 is waiting on data.
3. **Wire global Search** to `GET /casino/games/search` (endpoint already in
   `endpoints.js`; `SearchButton` is inert).
4. **Wire the notifications panel** to `GET /user/notifications` (player routes
   exist; panel is still hard-empty).
5. **Decide the sportsbook's data model.** The captured Shuffle shape and the
   cricket-exchange feed are not the same product. Largest outstanding product
   decision.
6. **Move the refresh token to an httpOnly cookie** (backend change).
7. **Crypto withdraw POST**, Tip / P2P, on-ramp — see
   [MISSING-AND-UNWIRED.md](MISSING-AND-UNWIRED.md).

### The lottery staking block, measured rather than inferred

`TokenLottery` was first built from the class names in the captured stylesheet
alone. Every class was real and every one was in the right place, and the block
still came out 38px too tall, because the class names do not say how the
elements nest. Read off the live block instead (`1184×345.6` at 1536px, each
half `591.2×344` at 24px padding):

* **`½` / `2x` / `Max` live inside the field.** They are three 32px
  `ButtonVariants_buttonHeightXSmall ButtonVariants_tertiary` buttons in
  `span.InputSuffix_root > div.TokenLotteryForm_buttonGroup`, which is what the
  input's `Input_hasRightIcon` reserves room for. Rendering `MAX` as a
  full-width button under the input added 32px on its own. `Max` is `disabled`
  on a zero balance; the selected **tab** is `disabled` too — that is how the
  reference marks the active one, not a styling rule.
* **The submit is `buttonHeightMedium` (48px), not `Large` (54px).** +6px.
  Its label is "Stake SHFL" / "Unstake SHFL", not "Stake".
* **The progress read is upside down from the obvious reading.** The two
  amounts go in the top bare `<label>` — `span.TokenLotteryChart_tokenAmount`,
  and the second wrapped in `div.ProgressBarSection_rightContainer` — and the
  words "Staked" / "Available" go in the `ProgressBarSection_supportText` row
  *beneath* the bar, each in a `span.TokenLotteryChart_footerText`. Putting the
  words on top and the amount on the right is the natural guess and is wrong.
* **The bar is `div.ProgressBarSection_customProgress`, not `<progress>`.**
  Both exist in the stylesheet and `ProgressBarSection_skipBorder` only applies
  to the `<progress>` variant, so picking the wrong one silently picks a
  different rule set. Unstaked, the div renders as a bare gray700 track; filled,
  it nests `customProgressWidth > customProgressLeft + customProgressRight`.
* **The field label is "You're Staking" on `label.TextInput_label > span`**,
  inside a `LabelBlock_root TextInput_labelBlock TextInput_hasRightLabel`, with
  the fiat value beside it in a `<span class="TokenLotteryForm_rightLabel">` —
  a span, not a `<p>`. The input carries a `span.TextInput_inputPrefix` holding
  `/icons/token-large.svg` and reads "Enter SHFL amount".
* **`TokenLotteryForm_ticketAmountContainer` is a `<section>` of two `<p>`s** —
  "To Receive" plus a `Tooltip_trigger` info icon, then the ticket icon and the
  bare words "Lottery Tickets". The live block shows no count on an empty
  field, so neither does this one; entries-per-SHFL is a rate this deployment
  does not have.
* **`TokenLotteryChart_icon` is sized by HTML attributes.** The file's own
  viewBox is 130×130 and the reference pins `width="124" height="124"` on the
  `<img>`; nothing in the CSS does it. Six pixels, and the only thing left
  between the block and an exact match once the rest was fixed.

The paragraph ends "generated for you every **week**", not "every draw".

