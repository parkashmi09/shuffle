# Shuffle sidebar → frontend matrix

Class: **a** = on/off or content the player site (5174) must reflect · **b** = back office (page loads with data, actions work, no frontend) ·
**c** = no surface in shuffle's UI (why given). Script key = `toggles.mjs --only <key>`.
Reader = the `frontend/src` file that reads the value. Owner = owner panel (3145) → Features & plan (`features`) / Site flags (`flags`) / policies.
The admin (`admin/src/configs/navConfig.tsx`) is the shared bitcasino admin, so the sidebar is the same as on the other sites;
only the frontend column is shuffle's.

## Upstream gate

Owner flag off ⇒ admin `PUT /site-config/global {flag:true}` is refused `NOT_ENTITLED` ⇒ public flag off (script `upstream`, uses `vipclub`).
On shuffle that is only visible for `affiliate` (the one admin flag the site reads). Owner features with `absent` in
`owner-panel/src/configs/siteUi.ts` (raffles, swap, tips, gift_cards, spin_wheel, chat, club_membership, analytics, live_tv) are pinned off for shuffle.

## Owner Features & plan

`siteUi.ts` describes the shuffle surface of each `toggle` feature, but **the frontend does not read feature on/off**
(`useSiteFeatures` exposes only policies). So every row below is class **c** today: the script proves `/admin/features/public`
changes; the surface stays. Report "owner off, surface still shown" as a frontend gap, not a backend bug.

| Owner feature | siteUi surface (what should go when off) | Reader |
|---|---|---|
| vip | `/vip-program`, header VIP panel | none |
| promotions | `/promotions`, `/promotions/:slug`, `/sports/promotions/:slug` | none |
| bonus | reward cards on `/vip-program` + VIP panel, redeem-code modal | none |
| affiliate | `/affiliate` + sub pages | none (the admin flag is read) |
| races | home tournaments carousel, Weekly Race tab | none |
| challenges | `/challenges` | none |
| vault | user menu Vault modal | none |
| notifications | right-side notification panel | none |
| kyc | `/settings/verify` | none |
| blog | `/blog`, `/blog/:slug` | none |
| push_notifications | OneSignal web push (`lib/onesignal.js`, loaded when the backend says push is on) | backend push config |
| banners (fixed) | home hero carousel | admin banners |

## Owner policies (class a)

| Policy | Reader | Surface |
|---|---|---|
| business_model | `useSiteFeatures().canSignUp` (TopBar, AuthModal) | b2b → no Register button / tab |
| deposit_mode | `useSiteFeatures().depositRoutes` (wallet DepositTab) | manual / automatic routes |
| withdrawal_mode | `useSiteFeatures().withdrawalRoutes` (wallet WithdrawTab) | manual / automatic routes |

## Site admin sidebar

| Group · item | Admin page | Class | Setting → public route | Frontend surface / expected |
|---|---|---|---|---|
| Dashboard | /dashboard | b | — | KPIs load |
| Users · Users | /users (tabs: direct users / agent system) | b | — | list loads, search; the `player-api.mjs` player is there |
| Users · Wallets | /wallets | b | — | balances load |
| Users · Login & IP history | /ip-tracker | b | — | rows load |
| Users · Redeem Codes | /redeem-codes | b (money: read-only) | redeem via `POST /user/bonus/redeem` | user menu redeem modal |
| Users · Turnover Report | /turnover-report | b | — | report loads |
| Exchange · Dashboard, Account List, Bank, Executives, Activity log | /exchange/dashboard, /exchange/users, /exchange/bank, /access/executives, /audit | b | — | load; Activity log shows the script's flips |
| Exchange reports · Account Statement, Party/Total P&L, User Win Loss, General Lock | /exchange/reports/* | b | — | load with filters |
| Branches · Branches, Branch Report | /branches, /branch-report | b | owner policy `branch_management` | — |
| Whitelabel · Whitelabels | /whitelabels | b | owner policy `whitelabel` | parked |
| Sports Exchange · Market Analysis, Current Bets, Turn Over, Settlement, Global Settings, Events | /exchange/* | b | owner flag `sportsexchange` | — |
| Sports Exchange · Sports switch | /exchange/sports-switch | c | `PUT /site-config/sports {enabled}` → public `sports` (key `sports`) | shuffle's `/sports` pages do not read it |
| Transactions · Deposit / Withdraw | /transactions/deposit, /withdraw (status tabs) | b (money: read-only in the crawl; money-loop.md writes) | — | queues load; Manual tab drives the wallet |
| Transactions · Account Statement | /reports/statements | b | — | loads |
| Transactions · KYC | /kyc | b | owner feature `kyc` | review queue; `/settings/verify` status via `GET /user/kyc/status` |
| Transactions · Bank details | /bank-details | b | `GET /user/bank-details/:coin` | wallet Deposit methods (needs ≥1 INR row for the API chain) |
| Finance · Exchange rates, Coins | /exchange-rates, /coins | b (money: read-only) | `/user/exchange-rate/rates`, `/user/crypto/coins` | wallet currency list |
| Finance · Vault, Wager report, Swap history, Tips | /vault, /casino/wager-report, /swap, /tips | b | — | reports load |
| Promotions · Promotions | /promotions/campaigns | a (content) | published campaigns → `GET /admin/promotions`, `/admin/promotions/sidebar` | `/promotions` tiles, nav promo rows |
| Promotions · Bonus | /bonus | a (register bonus only) | `registerbonus` in `/admin/site-config/public`; flag `bonus` (key `bonus`) has no reader | register modal amount; amounts read-only |
| Promotions · Bonus balances | /bonus-balances | b | — | loads |
| Promotions · Gift cards | /gift-cards | c | flag `giftcards` | owner `gift_cards` absent |
| Promotions · Spin wheel | /spin-wheel | c | flag `wheelspin` | owner `spin_wheel` absent |
| Promotions · VIP Club | /vip | b | flag `vipclub` has no reader; levels → `GET /user/vip/levels` | `/vip-program` levels |
| Promotions · Affiliate | /affiliate | **a** | flag `affiliate` (key `affiliate`), `affiliatebonus`, `comissionpercent` | nav/user menu/footer Affiliate, `/affiliate` dashboard vs marketing page, commission % |
| Promotions · Races, Raffle, Challenges, Reload bonuses | /races, /raffle, /challenges, /reload-bonuses | b (config, money read-only) | — | race board, `/challenges` |
| Casino · Lobby curation | /casino/curation | a (content) | curated collections → `GET /casino/games/collections/:name` | home/casino rails |
| Casino · Providers, Bet history, Vendor/Type Priority | /casino/providers, /casino/bets, /vendor-priority, /type-priority | b | flag `casino` has no reader | `/casino/providers` list / order |
| Originals · Dashboard, Turnover, Bet history, Games | /casino/original-games/* | b | flag `originals` has no reader | — |
| Marketing | /marketing | b | marketing account only | — |
| Content · Banners | /content/banners | a (content) | `GET /admin/banners/:type`; flag `home_heroSection` has no reader | home hero carousel |
| Content · Avatars | /content/avatars | c | — | no avatar picker |
| Content · Blogs | /content/blogs | a (content) | `GET /admin/blogs`, `/admin/blogs/slug/:slug` | `/blog`, `/blog/:slug` |
| Content · Notifications | /content/notifications | a (content) | `GET /user/notifications` | notification panel |
| Content · Push (Compose, Campaigns, Templates, Settings) | /push/* | b | owner `push_notifications` | OneSignal (`lib/onesignal.js`) |
| Reports · User reports, Profit & loss, Risk | /reports/players, /pnl, /risk | b | — | load |
| Site config · Features | /site-config/features | b | variants are owner-managed (403 OWNER_MANAGED on/off) | read-only view of the owner plan |
| Site config · Branding | /site-config/branding | c | `/admin/branding/public` | not read — brand is static `public/brand/` (`lib/siteBranding.js`) |
| Site config · Content | /site-config/content | c | `PUT /admin/site-content/:key` → `/admin/site-content/public` | not read by shuffle's frontend |
| Site config · Feature flags | /site-config/flags | a for `affiliate`, c for the rest | `PUT /site-config/global {flag}` → `/admin/site-config/public` | see below |
| Site config · Limits and policy | /site-config/limits | b (money: read-only) | `/site-config/settings` | — |
| Settings · Payment Methods | /payment-methods | b (money: read-only) | — | deposit methods |
| Settings · My account | /account | b | — | profile, 2FA |

## Feature flags (toggles.mjs keys)

| Flag | Reader | Surface |
|---|---|---|
| affiliate | `usePublicSiteConfig.affiliateEnabled` (App, NavContent, UserMenu, Footer, StaticPage, AffiliateProgramPage) | Affiliate rows; off → `/affiliate` = marketing page |
| casino, sports, originals, vipclub, bonus, wheelspin, giftcards, home_heroSection, home_livesports, home_promocards, home_leaderboard | none | **c** — public value flips (script PASS), shuffle UI unchanged |

Other flags (lotto, crash, livegames, provider and coin flags, other home_* keys): **c**.

## Site config → Content

All 7 sections (home, footer, social, support, legal, pages, vip) are **c** on shuffle: the script proves
`/admin/site-content/public` changes; the frontend uses its own copy (`frontend/src/data`, `pages/StaticPage.jsx`).

## Player site routes (crawl list)

`/`, `/casino/categories/originals`, `/casino/categories/slots`, `/casino/categories/live-casino`, `/casino/categories/latest-releases`,
`/casino/providers`, `/casino/recently-played`, `/favourites`, `/sports`, `/sports/soccer`, `/sports/cricket`, `/vip-program`, `/promotions`,
`/challenges`, `/affiliate`, `/blog`, `/lottery`, `/airdrop`, `/token`, `/transactions`, `/settings/account`, `/settings/verify`,
`/shuffle-wise/self-exclusion`.

## Money loop (see [money-loop.md](money-loop.md))

| Surface | Admin / owner setting | Player site (5174) expected |
|---|---|---|
| Wallet → Deposit (fiat) | Transactions → Bank details rows; owner `deposit_mode` | method list, pay-to details, UTR + screenshot, submit → pending; approve → balance |
| Wallet → Withdraw | owner `withdrawal_mode` / `withdrawal_requirements` | KYC / wager gate answers shown; form submits `POST /user/withdrawals/fiat` |
| Transactions → Deposit / Withdraw → Manual | approve / reject / decide (transaction password) | reflected in the wallet and `/transactions` |
