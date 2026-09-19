# Missing and unwired

> Measured against the live modal row by row. Deposit matches the reference
> exactly at every offset: modal 634px, currency grid `y97 h156`, address input
> `y291 h48`, warning `y347 h16`, QR `y379` at 174×174, footer `y577 h17`.
> Three things got it there — the two selects share **one**
> `CurrencyNetworkSelectOptionsWrapper_root` (the reference's grid is 156px,
> which is two fields plus its gap, not one field per wrapper), the QR is 174px
> not 168, and the unconfigured warning is one line, because two pushed
> everything below it down 16px.


Everything the frontend renders that the backend cannot yet answer, and
everything the backend answers that no screen asks for.

The rule this repo follows is that **the shape of a screen is not conditional on
configuration**. A control is built out whether or not a route exists, so the
work left is a call rather than a redesign. Where a screen cannot act its submit
is simply `disabled`, which is what the live modal does with an incomplete form
too. **The screens carry no notice about this deployment's configuration** — a
player should not be reading about `CCPAYMENT_*` in a wallet. That belongs here.

Companion to [FRONTEND-BACKEND-INTEGRATION.md](FRONTEND-BACKEND-INTEGRATION.md),
which is the map of what *is* wired. Re-read §0 / §4 there for the catalogue
hooks (`useLobbySection`, `useCategory`, home tabs) before treating a casino
surface as “still dummy”.

---

## 1. The one thing deliberately left blank

**Crypto deposit addresses.** Every other control in the wallet is complete.
The address field is not filled with a plausible-looking string, and will not be
until a provider issues one.

An address is where money goes and does not come back. A fabricated one that
reached a real player is not a cosmetic bug, so the field renders empty with the
rest of the row finished around it. One line in `DepositTab.jsx`
(`const address = ""`) becomes the provider call.

Everything else on this page is built.

---

## 2. Blocked on configuration

These have code on both sides. They need environment variables or seed data, not
a redesign.

| What | Symptom | Fix |
| --- | --- | --- |
| Crypto deposits — networks, addresses | `GET /user/crypto/chains` → `CRYPTO_PROVIDER_DISABLED` | `CCPAYMENT_*` in `backend/.env` |
| Card / on-ramp purchases | `GET /user/payments/methods/:provider` → `PAYORDER_PROVIDER_DISABLED` | a PSP in `backend/.env` |
| Casino lobby / browse live catalogue | `GET /casino/games` → `200 []`; collections empty | `npm run db:seed:demo` — seeder `004-provider-game-catalogue.js` fills **`gisgamesnew`**, `js_games`, providers, and collection tables (`hot_games`, `live_casino`, `popular_slots`, …). Naming only `gis_games` is wrong for what the lobby reads. |
| Home hero banners | `GET /admin/banners/home` → `404 BANNERS_NOT_FOUND` | seed `banners`, or set them in admin |
| Game launch | `POST /casino/js-games/v2/launch` needs operator upstream creds | js-games / provider account config (Fun Play stays disabled on purpose) |
| Sports — everything | service will not boot: `Cannot find module './legacy/oddsGuard'` | restore `services/sports/src/modules/bets/legacy/` (see §2.2 of the integration doc) |

The dev runner stops every service when one child dies, so until that folder is
restored the platform starts as `node scripts/dev.js user admin casino gateway`
rather than `npm run dev`. `/health` then reports `degraded` with sports `down`
and the other three `ok`, which is the honest state.

Until crypto is configured the wallet's network picker falls back to
`src/lib/networks.js` — public facts about which chains an asset moves on, which
is safe to list because it invents no account data. It is **not** a claim about
what this operator accepts; that is provider configuration.

**After catalogue seed**, home lobby rows mapped in `ROW_COLLECTION`, home tabs
Slots / Live Casino / Table Games, category browse, and provider pages switch to
live data automatically (`useResource` + `isLive`). Originals / Shuffle Games /
Shuffle Picks / Latest Releases stay on capture by design — see integration
doc §4.2.

---

## 3. Missing backend routes

Screens are built. There is nothing to call (or the only call is history-only).

All four wallet tabs are the live modal's own layouts, read off
`?modal=wallet&md-tab=…` element by element:

| Tab | Reference layout, reproduced |
| --- | --- |
| **Deposit** | Currency + Network in one grid, address row with copy, warning, QR, `Deposit history` |
| **Withdraw** | Currency + Network, address, amount with balance caption, 25/50/75/MAX, fee and network notices |
| **Buy Crypto** | `You Pay With` amount paired with a narrow fiat select, `In Exchange For`, `Select Provider and Receive`, `Buy Now`, provider logo strip, disclaimer |
| **Tip** | Currency, `Username*`, amount with balance caption, `Public Tip` switch, `Send Tip` |

**No tab explains this deployment's configuration any more.** An earlier pass put
provider notices inside the forms; a player should not be reading about
`CCPAYMENT_*` in a wallet. What each screen is waiting for is here instead.

| Screen | Needs | Nearest thing that exists |
| --- | --- | --- |
| **Wallet → Withdraw (crypto)** | `POST /user/withdrawals/crypto` | `GET /user/withdrawals/crypto` — history only |
| **Wallet → Buy Crypto** | an on-ramp broker | `payment-orders`, provider-gated |
| **Wallet → Tip** | a player-to-player transfer | the internal wallet credit/debit pair — cluster-only, refused at the gateway by design |
| **Token dashboard** (`/token`) | a token module — price, market cap, TVL, holders, supply — and a staking route for the SHFL lottery | nothing. No token module in any service, and `GET /user/exchange-rate/rates` carries 25 currencies with SHFL not among them |
| **Header → Chat** | any chat module | none in user, admin, casino or sports |
| **Header → bet slip panel** | the sportsbook | `services/sports` will not boot |

Fiat deposit, fiat withdraw, and vault **are wired** — they are not on this
list. See integration doc §4.1 / wallet section.

---

## 4. Live routes with no screen (or no FE call)

The opposite problem: these answer today and nothing in the app asks — or the
UI is present but still hard-wired to empty / inert.

**Still unused by the frontend**

| Area | Routes | Notes |
| --- | --- | --- |
| **Global game search** | `GET /casino/games/search` | Declared in `endpoints.js`; `SearchButton` has no handler. Category-page search *does* pass `search` into `casino.games` when live. |
| **Notifications inbox** | `GET /user/notifications`, unread-count, mark-read | Player routes exist on user-service. `NotificationPanel` always renders the empty state and does not call them (comment in the panel is stale). |
| **Swap** | `/user/swap/*` | No screen |
| **P2P** | P2P module | No screen (Tip tab needs this shape of transfer) |
| **Gift cards / spin wheel** | `/user/gift-cards/*`, `/user/spin-wheel/*` | No screens |
| **Clubs / club broadcasts** | `/user/club-broadcasts/*` | No screens |
| **Withdrawal whitelist** | whitelist routes | No dedicated UI |
| **Site blogs → BlogPage** | `GET /admin/blogs` | Three plain-text posts; FE still uses 28 captured HTML articles |
| **Casino catalogue stats** | `GET /casino/games/stats` | Unused; GameStatsPanel reads bet-history instead |
| **Legacy GIS / catalogue launch** | `/casino/gis/launch`, `/casino/catalogue/launch` | Player path is `POST /casino/js-games/v2/launch` |

**Came off this list (now have screens that call the API)**

- Wallet fiat deposit / withdraw, vault
- Transactions (`/transactions/…`)
- Settings (account, verify/KYC, security/2FA, preferences, sessions)
- Affiliate dashboard (`/affiliate/overview` etc.) — marketing `/affiliate` stays capture
- VIP bonus + rakeback claims
- Favourites + recently-played (tile star + `/favourites`, `/casino/recently-played`)
- Game detail + launch

The `Deposit history` / `Withdrawal history` links in the wallet still need a
clear landing on the transactions tabs if they are not already routed there.

---

## 5. Frontend gaps

Things the clone renders from a capture that have no live source, and things it
has not built.

| Area | State |
| --- | --- |
| **Casino home / browse (partial)** | **Hybrid.** Slots, Live, Table (home tabs + category pages), mapped lobby collections, providers, banners: API with capture fallback. **Capture-only by design:** Originals / Shuffle Games, Shuffle Picks, Latest Releases category, Game Shows as a browse slug. See integration §0 / §4.2. |
| **Coin marks for 15 assets** | The wallet's currency list is this platform's 28 balances; the reference ships a 16px mark for only 13 of them. `ADA BCH MKR NEXO SHIB TUSD USDP` and the fiat `AED BDT MVR NPR PKR` all 404 on shuffle.com — it does not list those assets — and `BJB NC SC` are this platform's own tokens, which have no mark anywhere. They render the star fallback, which is what the reference does with an asset it has no icon for. Drop a file into `public/icons/crypto/` or `public/icons/fiat/` and it is picked up with no code change. |
| ~~Token-page assets~~ | **Done.** Every asset the token page asks for is in and byte-exact. `/icons/token/shflLottery.svg` (22,867 bytes) came through `WebFetch` in one call — SVG is text, so the fetch tool returns it whole, which is worth trying before the console channel for anything textual. `/images/shfl-staking-background.png` (259,049 bytes, 1713x1038) came from the user by hand: a PNG does not compress, so the gzip-then-hex console channel would have needed roughly 576 round trips. **Binaries have no route in from here** — the shell has no outbound network and the extension refuses downloads — so ask rather than grind. Note the browser caches the 404 for a background image for the life of the document: after dropping one in, reload the page or it stays blank while `getComputedStyle` cheerfully reports the URL. |
| **The token page's chart series** | `recharts` is installed and the four cards draw real charts, but there is no price history to draw: `TokenGraphs.jsx` generates a deterministic walk that ENDS on the published figure. It is the one place on the site where invented data is plotted as though measured, so every card labels its support text "sample series". Delete `series()` when a feed exists. |
| **QR encoder** | `QrCode.jsx` is the reference's frame at the right size with the encoder left as a seam. Adding one is a dependency decision, not a styling one: `qrcode` or `qrcode.generator` both fit, ~15 lines in `encode()`. Until then it renders a waiting state at the same footprint, so nothing moves when it lands. |
| **Lottery, Airdrop, Challenges, Promotions, Tournaments, Weekly Race** | Captured HTML and JSON. No module in any service. |
| **Blog** | `/admin/blogs` has three plain-text posts; the frontend renders 28 captured HTML articles. Different content model. |
| **OAuth (Google, Line, Telegram)** | Buttons render; no OAuth on the backend. |
| **Opening a game** | Player path is `POST /casino/js-games/v2/launch` (wired in GamePage). Still needs operator upstream credentials. Legacy GIS/catalogue launch routes are unused by the FE. |
| **Global Search** | Button renders; does not call `casino.search`. |
| **Notifications panel** | Layout complete; does not call `GET /user/notifications`. |
| **Live support** | Button renders; no support integration. |
| **Sportsbook** | Nine captured JSON files. Even with sports-service booting, the upstream feed is a cricket-exchange shape unrelated to the captured Shuffle sportsbook — a rewrite, not a wiring job. |
| **Shuffle Wise** | Client-local / capture; not a backend product module. |
| **Settings → Ignored users** | Tab exists; no live ignore-list API wired. |

---

## 6. Known behavioural gaps

- **The refresh token is in `localStorage`.** An httpOnly cookie is the right
  home, but `POST /user/auth/login` returns it in the JSON body, so that is a
  backend change. Not worked around silently.
- **The display currency is client-side.** `userconfig` carries theme, language
  and two notification flags — no column for it — so the wallet's fiat display
  lives in `localStorage`, defaulting to INR.
- **No withdrawal fee is shown for fiat.** The reference quotes one; this
  platform has no fee configuration for fiat payouts, so the notice states the
  terms it can stand behind instead of a number it cannot.
- **Notifications are not pushed.** The reference uses a socket.
  `packages/socket` exists and the services declare handlers, but no socket
  client is wired on this side yet — and the panel does not even poll the
  player list route yet (§4).
- **The activity board polls.** Same reason — the reference pushes over a
  socket; this reads `/casino/bet-history/live` every 5s.
- **Nav Profile comment is stale.** `NavContent.jsx` still says the four profile
  links have “no screen yet”; Wallet, Vault, Transactions, and Settings are
  live. Update the comment when touching that file.
