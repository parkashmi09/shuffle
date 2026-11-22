/**
 * Every backend route this app calls, in one list.
 *
 * Paths only — no shaping, no fallbacks. A route that moves is edited here and
 * nowhere else, and `docs/FRONTEND-BACKEND-INTEGRATION.md` §4 is the map of
 * which screen uses which.
 *
 * The service segment is part of the path (`/user/...`, `/casino/...`,
 * `/admin/...`); the gateway routes on that prefix, so these are written the
 * way the gateway expects rather than grouped by our own idea of a feature.
 */
import { del, get, patch, post, put } from "./api";
import { underAgentBase } from "./agentBase";

/** One request per page load, shared by every caller; a failure is not kept, so the next caller retries. */
const once = (fn) => {
  let p = null;
  return () => (p ??= fn().catch((e) => { p = null; throw e; }));
};

export const auth = {
  // `site`: each side signs in its own players, an agent's on /agent and a direct player on the main site.
  login: (identifier, password, extra) =>
    post("/user/auth/login", { identifier, password, site: underAgentBase() ? "agent" : "direct", ...extra }, { auth: false }),
  /** The /agent sign-in form's Demo Login: a throwaway account and its session. No body. */
  demoLogin: () => post("/user/auth/demo-login", undefined, { auth: false }),
  register: (body) => post("/user/auth/register", body, { auth: false }),
  me: () => get("/user/auth/me"),
  logout: (refreshToken) => post("/user/auth/logout", refreshToken ? { refreshToken } : {}),
  forgotPassword: (email) => post("/user/auth/forgot-password", { email }, { auth: false }),
  /** The token from the reset email (`/reset-password?token=`) and the new password (min 8). */
  resetPassword: (token, newPassword) => post("/user/auth/reset-password", { token, newPassword }, { auth: false }),
  /** `{ enabled, configured }` — the button follows `enabled` (the owner's `google_signin`), keys or not. */
  googleStatus: () => get("/user/auth/google/status", { auth: false }),
  /** The one-time `code` from `/login/google?code=` plus this tab's nonce → the session, as login answers it. */
  googleExchange: (code, nonce) => post("/user/auth/google/exchange", { code, nonce }, { auth: false }),
  changePassword: (body) => post("/user/auth/change-password", body),
  sessions: () => get("/user/auth/sessions"),
  revokeSession: (sessionId) => del(`/user/auth/sessions/${sessionId}`),
  /** Idle logout heartbeat while the player interacts (≤ 1 a minute): `{ recorded }`. */
  activity: () => post("/user/auth/activity"),
  /** `{ signedOut, nextCheckAt? }` — no `nextCheckAt` and not signed out means idle logout is off. */
  idleCheck: () => post("/user/auth/idle-check"),
};

/**
 * The settings pages.
 *
 * `profile` is the account tab's source — username, email, level, join date and
 * whether 2FA is on. `kyc` backs Verify and `twoFactor` backs the Security
 * tab's panel; both are player-scoped and live.
 */
export const profile = {
  get: () => get("/user/profile"),
  /** Lifetime play: `{ bets, wins, winRate, wagered: { usd, byCurrency } }`. */
  stats: () => get("/user/profile/stats"),
  update: (body) => put("/user/profile", body),
  /** `code` is the one `emailOtp.request(newEmail, "change-email")` sent to the NEW address; `password` is the current one. */
  changeEmail: (email, code, password) => post("/user/profile/change-email", { email, code, password }),
  /** One of the site admin's avatars by id; 403 `AVATAR_LOCKED` above the player's VIP level. Answers the profile. */
  setAvatar: (avatarId) => post("/user/profile/avatar", { avatarId }),
  /** Enabled avatars, `[{ id, url, minLevel, sort }]` — `url` is the gateway's `/api/v1/...` path. Public. */
  avatars: () => get("/admin/avatars/public", { auth: false }),
};

/** Public email codes (6 digits). `purpose`: `change-email` sends to the address given. */
export const emailOtp = {
  request: (email, purpose) => post("/user/email/otp", { email, purpose }, { auth: false }),
  /** Lost authenticator: mails a code to the account behind `identifier` (always `{ requested: true }`). */
  twoFactorReset: (identifier) => post("/user/email/2fa/reset", { identifier }, { auth: false }),
  /** Turns 2FA off for that account: `{ reset: true }`. */
  twoFactorResetConfirm: (identifier, code) => post("/user/email/2fa/reset/confirm", { identifier, code }, { auth: false }),
};

/**
 * Settings → Preferences.
 *
 * `GET/PATCH /user/preferences` is the `userconfig` module. Columns used by
 * the tab: `emailNotifications`, `pushNotifications`, `hideBalance` (Streamer
 * Mode). `theme` and `language` are the other two fields; neither has a
 * control on this page. Fiat View and Hide zero balances are client-only and
 * live on the session (see `lib/playerPreferences.js`).
 */
export const preferences = {
  get: () => get("/user/preferences"),
  update: (body) => patch("/user/preferences", body),
};

/**
 * The redeem-code dialog.
 *
 * `POST /user/bonus/redeem` takes the code a player typed and credits the
 * bonus currency, answering `{ code, amount, currency, newBalance }`. It is
 * NOT `gift-cards`: those are claimed by numeric id from a list the operator
 * issued, which is a different product (`giftCards`, the dialog's Gift Cards tab).
 *
 * The two failures are player-readable as they stand — 404 "That redeem code
 * is not valid" and 409 "That redeem code has already been used or has
 * expired" — so the modal shows `error.message` rather than mapping codes.
 */
export const redeem = {
  code: (code) => post("/user/bonus/redeem", { code }),
  /** A player's own issued codes, active or spent. */
  mine: (query) => get("/user/bonus/codes", { query }),
};

/**
 * The Bonus centre on /vip-program (owner `bonus_centre`, routes under the `bonus` plan).
 * `history`: claims `[{ id, type, amount, amountCurrency, claimed, claimedAt, createdAt }]`;
 * `games`: `{ counters: { luckyspin, dailybonus, … } } | null`; `events`: `[{ id, event, amount, createdAt }]`.
 * `redeem.mine` is the player's codes.
 */
export const bonusCentre = {
  history: (query) => get("/user/bonus/history", { query }),
  games: () => get("/user/bonus/games"),
  events: (query) => get("/user/bonus/events", { query }),
};

/**
 * Gift cards (owner `gift_cards`) — the Gift Cards tab of the redeem dialog.
 * `list`: `[{ giftcards: { id, uniqueKey, description, amount, periodDays, endDate, depositStatus, depositAmount,
 * wagerStatus, wagerTimes }, usergiftcards: { status: Activated | Claimed | Expired, expired } | null,
 * deposit: { status, message }, wager: { status, totalUsdWager, requiredWagerUSD } }]`.
 */
export const giftCards = {
  list: () => get("/user/gift-cards"),
  claimed: (query) => get("/user/gift-cards/claimed", { query }),
  activate: (giftCardId) => post("/user/gift-cards/activate", { giftCardId }),
  /** Answers `{ giftCardId, status, amount, currency, newBalance }`. */
  claim: (giftCardId) => post("/user/gift-cards/claim", { giftCardId }),
};

/**
 * The weekly raffle (owner `raffles`). `current` is public: `{ enabled, number, drawAt, status, prizePoolUsd,
 * winners, prizeUsd, wagerPerTicketUsd, latestDrawn }`; `mine`: `{ tickets: [{ ticket, source }], freeClaimed,
 * wageredUsd, nextTicketInUsd }`; `results(n)`: the draw plus `winners: [{ ticket, player, prizeUsd, count }]`.
 */
export const raffle = {
  current: () => get("/user/raffle/current", { auth: false }),
  mine: () => get("/user/raffle/me"),
  claimFree: () => post("/user/raffle/claim"),
  results: (number) => get(`/user/raffle/draws/${number}`),
};

/**
 * The spin wheel (owner `spin_wheel`). `slices`: `{ slices: [{ id, label, rewardPct, color, isBadLuck }], disabled,
 * maxBonus, currency }`; `eligibility`: `{ eligible, code?, reason?, nextEligibleAt, activeBonus }`;
 * `spin`: `{ winIndex, slice, isBadLuck, redeemCode, rewardPct }` — a won % is added to the next deposit.
 */
export const spinWheel = {
  slices: () => get("/user/spin-wheel/slices", { auth: false }),
  eligibility: () => get("/user/spin-wheel/eligibility"),
  claims: (query) => get("/user/spin-wheel/claims", { query }),
  spin: () => post("/user/spin-wheel/spin"),
};

/** `status` is `NotSubmitted` | `Unverified` | `Pending` | `Verified` | `Rejected`. */
export const kyc = {
  status: () => get("/user/kyc/status"),
  /**
   * Multipart: firstName, lastName, dateOfBirth, address, city, country,
   * documentType (`id_card` | `passport` | `driving_licence`), and at least one
   * of the files `idFront`, `idBack`, `passport`.
   */
  submit: (form) => post("/user/kyc/submit", form),
};

/** KYC levels 3 and 4: `{ identity, levelsOn, levels: [{ level, label, unlocked, status, rejectionReason, submittedAt }] }`. */
export const kycLevels = {
  status: () => get("/user/kyc-levels"),
  /** Multipart, the one file `document` (JPG / PNG / PDF); resend allowed only after a rejection. */
  submit: (level, form) => post(`/user/kyc-levels/${level}`, form),
};

/** The email-verification code (6 digits) — deposits can be gated on a verified address. */
export const emailVerify = {
  request: () => post("/user/email/verify/request"),
  confirm: (code) => post("/user/email/verify/confirm", { code }),
};

/** `status` answers `{ isEnabled, hasInitiated }`. */
export const twoFactor = {
  status: () => get("/user/2fa/status"),
  /** Begins setup — answers `{ qrCode, secret }`; `qrCode` is a data: URL. */
  begin: () => post("/user/2fa/enable"),
  /** The account password is required to enrol an authenticator. */
  confirm: (code, password) => post("/user/2fa/setup-verify", { code, password }),
  disable: (code, password) => post("/user/2fa/disable", { code, password }),
};

export const wallet = {
  balances: () => get("/user/wallet/balances"),
  balanceOf: (currency) => get(`/user/wallet/balances/${currency}`),
  history: (query) => get("/user/wallet/history", { query }),
  /**
   * The movement ledger — every credit and debit with the reason that caused it.
   *
   * Not `history`: that route answers a bare `{ history, count }` rather than the
   * platform envelope (kept verbatim for a legacy client), so `request` finds no
   * `data` and hands back `null`. `ledger` is enveloped and paginated, and is
   * what the transactions page's Other tab reads.
   */
  ledger: (query) => get("/user/wallet/ledger", { query, withMeta: true }),
};

/**
 * The player's exchange bets — mssports `GET /sports/user/cricket/sports-bets/user`.
 * `page` + `limit`; `status: "all"` is open and settled together (the default is matched only).
 * Answers `{ success, data: rows[], pagination }` with raw `sports_bets` columns.
 */
export const sportsBets = {
  mine: (query) => get("/sports/user/cricket/sports-bets/user", { query: { status: "all", ...query }, withMeta: true }),
};

export const vip = {
  /** The caller's own progress. Player route — needs a token. */
  progress: () => get("/user/vip"),
  /**
   * The ladder's bands, as an ARRAY.
   *
   * The route answers `{ ladder, label, unranked, bonusGates, levels }` and
   * `get` resolves the envelope's `data`, so the bare call hands back that
   * wrapper. Every consumer treats what it gets as the band list —
   * `groupByTier` does `for (const band of levels)`, `levelName` does
   * `levels.find(…)` — so the wrapper reached them as a non-iterable object.
   * Unwrapped once here rather than at each of the four call sites; nothing on
   * this side reads the other four fields.
   */
  levels: () =>
    get("/user/vip/levels").then((res) => (Array.isArray(res) ? res : res?.levels ?? [])),
  /** Unpaid rank-up rewards: `{ cards: [card], totalUsd }`. */
  rankUps: () => get("/user/vip/rank-ups"),
  /** Pays every pending rank-up at once: `{ granted: [{ card, amount, currency, amountUsd }] }`. */
  claimRankUps: () => post("/user/vip/rank-ups/claim"),
  /** The benefits table: `{ perks: [{ label, cards: ["bronze", …] }] }`, enabled perks only, public. */
  perks: () => get("/admin/vip-branding/perks", { auth: false }),
};

/**
 * The VIP page's "Your Rewards" grid.
 *
 * Two modules, because they are two different things on the backend and the
 * reference shows them side by side: `bonus` is the recurring daily / weekly /
 * monthly awards, each gated on a VIP level and each waiting on an award row
 * before it can be claimed; `rakeback` is a running balance that becomes
 * claimable once it clears a minimum.
 */
export const bonus = {
  /** `{ vip, currency, types: { daily, weekly, monthly } }`. */
  overview: () => get("/user/bonus"),
  /** `type` is `daily` | `weekly` | `monthly`. */
  claim: (type) => post(`/user/bonus/claim/${type}`),
};

/** Locked deposit bonus: `{ active: [{ id, unlockMode: "gradual" | "rollover", amount, currency, claimable, locked, remaining, progress }] }`. */
export const bonusBalance = {
  get: () => get("/user/bonus-balance"),
  /** Moves what the gradual bonuses have unlocked to cash: `{ claimed: [{ bonusId, amount, currency }] }`. */
  claim: () => post("/user/bonus-balance/claim"),
};

/** `{ enabled, welcome, percent, maxBonus, wagerMultiplier, currency, netLoss, bonus, state, period, claimExpiresAt }`. */
export const lossBonus = {
  get: () => get("/user/loss-bonus"),
  claim: () => post("/user/loss-bonus/claim"),
};

export const rakeback = {
  /** `{ amount, currency, claimable, minimum, rate }`. */
  amount: () => get("/user/rakeback"),
  claim: () => post("/user/rakeback/claim"),
};

export const casino = {
  /** Paginated catalogue. `type`, `provider`, `search` narrow it. */
  games: (query) => get("/casino/games", { query, auth: false, withMeta: true }),
  gamesByProvider: (provider, query) => get(`/casino/games/provider/${provider}`, { query, auth: false, withMeta: true }),
  /** A curated collection: `hot`, `live-casino`, `popular-slots`, `crash`, `indian`. */
  collection: (name, query) => get(`/casino/games/collections/${name}`, { query, auth: false, withMeta: true }),
  /**
   * One game, by catalogue uuid — the game screen's read.
   *
   * `/detail/` is a real segment, not decoration. This was `/casino/games/
   * :uuid`, which — because the module mounts its public routes before its
   * player routes on the same base — also matched `/favourites` and
   * `/recently-played` and answered 404 for both.
   */
  game: (uuid) => get(`/casino/games/detail/${uuid}`, { auth: false }),
  /** `{ rows, total }` — note the shape differs from the paginated lists above. */
  providers: () => get("/casino/games/providers", { auth: false }),
  search: (q, query) => get("/casino/games/search", { query: { q, ...query }, auth: false }),
  stats: () => get("/casino/games/stats", { auth: false }),
  /** The admin's lobby categories, `[{ slug, name, sortOrder, active, count }]` — read once per page load. */
  categories: once(() => get("/casino/games/categories", { auth: false })),
  /** One category's hand-picked games, paginated; `provider` and `sort` (`az` | `za`) narrow it. */
  categoryGames: (slug, query) => get(`/casino/games/categories/${slug}`, { query, auth: false, withMeta: true }),

  favourites: () => get("/casino/games/favourites"),
  addFavourite: (gameRef, source) => put(`/casino/games/favourites/${gameRef}`, { source }),
  removeFavourite: (gameRef) => del(`/casino/games/favourites/${gameRef}`),
  recentlyPlayed: () => get("/casino/games/recently-played"),
};

/**
 * Opening a game. The player comes from the bearer token, never the body.
 *
 * ── CURRENCY ─────────────────────────────────────────────────────────────
 *
 * The game launches in the header's wallet when the route and the row allow it
 * (`lib/gameCurrency.js`); otherwise the page asks the player for another.
 */
export const jsGames = {
  /**
   * Any lobby game — `POST /casino/games/launch` with the catalogue `uuid` (the one `/casino/games`
   * returns): the row's aggregator picks the route. Answers `{ gameLaunchUrl, via }`.
   */
  launch: (gameUuid, currencyCode, language) =>
    post("/casino/games/launch", { gameUuid, currencyCode, ...(language ? { language } : {}) }),
  /**
   * The Originals — the Original Games aggregator: the games the admin has on, in the admin's order
   * (`[{ game_code, name, image }]`, empty while Originals are off), and a launch
   * (`{ gameLaunchUrl, sessionId, mode }`, `mode` demo on sandbox keys).
   */
  originals: () => get("/casino/original-games/games", { auth: false }),
  launchOriginal: (gameCode, currencyCode) => post("/casino/original-games/launch", { gameCode, currencyCode }),
  /** The caller's own rounds at this provider. */
  history: () => get("/casino/js-games/v2/history"),
};

/** The site's races — `GET /user/race/:type/leaderboard` (`daily` | `weekly` | `monthly`), public. */
export const race = {
  /** `{ endsAt, payoutNetPrizePool, payoutCurrency, leaderboard: [{ rank, name, points, usdWagered, payout }], me }`. */
  leaderboard: (type = "weekly") => get(`/user/race/${type}/leaderboard`),
  /** `GET /user/race` — `[{ type, enabled, configured, ... }]` for daily / weekly / monthly. */
  configs: () => get("/user/race"),
  /** The caller's prizes, newest first — `[{ id, type, rank, amount, currency, claimed, raceEndsAt }]`. */
  rewards: (query) => get("/user/race/rewards", { query }),
  /** Pays one prize into the wallet; the route takes no body. */
  claim: (rewardId) => post(`/user/race/rewards/${rewardId}/claim`),
  /** Settled races, newest first: `[{ raceId, type, endsAt, currency, prizePool, winners: [{ rank, name, amount, currency }], me }]`. */
  history: (query) => get("/user/race/history", { query }),
};

/** `GET /casino/challenges` — `{ active, completed }`, each `{ id, game, gameName, imageUrl, minMultiplier, minBetUsd, prizeUsd, winners, winnersFound, winnerNames }`. */
export const challenges = {
  list: () => get("/casino/challenges", { auth: false }),
};

export const betHistory = {
  /** The public ticker — nobody is named. */
  live: (limit = 20) => get("/casino/bet-history/live", { query: { limit }, auth: false }),
  /** Biggest wins. Public, and also unnamed. */
  topWins: (limit = 20) => get("/casino/bet-history/top-wins", { query: { limit }, auth: false }),
  /** Contest board — handles are masked, so it renders signed out. */
  leaderboard: (query) => get("/casino/bet-history/leaderboard", { query, auth: false }),
  /** Where the caller sits on that board. `rank: null` means "has not bet in the window". */
  myPosition: (query) => get("/casino/bet-history/leaderboard/me", { query }),
  /** The caller's own rounds. */
  mine: (query) => get("/casino/bet-history", { query, withMeta: true }),
  stats: () => get("/casino/bet-history/stats"),
};

export const site = {
  /** The feature flags every browser needs, signed in or not. */
  config: once(() => get("/admin/site-config/public", { auth: false })),
  /**
   * The coins players may use, in the site's order (owner plan + site admin both on):
   * `[{ code, name, symbol, decimals, kind, image, networks: [{ key, name }], sort }]`.
   * `image` is `/api/v1/admin/currencies/:code/image?v=…`, or null when none is uploaded.
   */
  coins: once(() => get("/admin/currencies/public", { auth: false })),
  /** The owner's branding: `{ branded, siteName, title, titleTemplate, description, keywords, themeColor, logoUrl, markUrl, ogImageUrl, … }`. */
  branding: () => get("/admin/branding/public", { auth: false }),
  /** The site admin's copy, `{ footer?, social?, support?, legal?, home?, pages?, vip? }` — only saved sections. */
  content: () => get("/admin/site-content/public", { auth: false }),
  /** Every active slide, in slide order — `[{ type, title, subtitle, cta, sortOrder, url }]`. */
  banners: (query) => get("/admin/banners", { query, auth: false }),
  blogs: (query) => get("/admin/blogs", { query, auth: false, withMeta: true }),
  blogBySlug: (slug) => get(`/admin/blogs/slug/${slug}`, { auth: false }),
  promotions: (query) => get("/admin/promotions", { query, auth: false, withMeta: true }),
  promotionSidebar: once(() => get("/admin/promotions/sidebar", { auth: false })),
  promotionBySlug: (segment, slug) => get(`/admin/promotions/slug/${segment}/${slug}`, { auth: false }),
};

export const notifications = {
  /** Resolves `{ data: rows[], meta: { total, limit, offset, page } }`. */
  list: (query) => get("/user/notifications", { query, withMeta: true }),
  unreadCount: () => get("/user/notifications/unread-count"),
  markRead: (id) => post(`/user/notifications/${id}/read`),
  markAllRead: () => post("/user/notifications/read-all"),
};

/**
 * The vault modal.
 *
 * The reference vault is a flat balance — the modal moves an amount in or out
 * and nothing else. This backend's vault is the older fixed-term product: a
 * transfer in opens a *deposit* against a lock period, and a transfer out
 * closes one whole deposit by id. `VaultModal` bridges the two; see the notes
 * there.
 */
export const vault = {
  /** `{ totals, deposits }` for the caller. `coin` narrows it. */
  data: (coin) =>
    get("/user/vault", {
      query: coin ? { coin: String(coin).trim().toUpperCase() } : undefined,
    }),
  /** Active lock terms, shortest first. */
  lockOptions: () => get("/user/vault/lock-options"),
  transferIn: (body) => post("/user/vault/transfer-in", body),
  transferOut: (body) => post("/user/vault/transfer-out", body),
  /** Paid interest, newest first: raw `{ id, coin, deposit_id, interest, rate, createdAt }` rows. */
  interest: (query) => get("/user/vault/interest", { query }),
  /** Moves in and out: raw `{ id, coin, amount, type, deposit_id, createdAt }` rows. */
  transactions: (query) => get("/user/vault/transactions", { query }),
};

/**
 * The wallet modal's Swap tab (owner `swap` plan; agent players are refused).
 * `estimate` answers `{ feePercentage, feeAmount, amountAfterFee, converted }`; `swap` the same plus
 * `newBalances`. `history` is raw `swap_history` rows (`from_currency`, `to_amount`, `created_at` …).
 */
export const swap = {
  estimate: (fromCurrency, toCurrency, amount) => get("/user/swap/estimate", { query: { fromCurrency, toCurrency, amount } }),
  run: (fromCurrency, toCurrency, amount) => post("/user/swap", { fromCurrency, toCurrency, amount }),
  history: (query) => get("/user/swap/history", { query }),
};

/**
 * Settings → Security's address book. `list` answers `{ whitelistOnly, addresses: [{ id, label,
 * currency, network, address, memo, createdAt }] }`; `enforce(true)` refuses on an empty list.
 */
export const withdrawWhitelist = {
  list: () => get("/user/withdrawals/whitelist"),
  add: (body) => post("/user/withdrawals/whitelist", body),
  remove: (id) => del(`/user/withdrawals/whitelist/${id}`),
  enforce: (enabled) => put("/user/withdrawals/whitelist/enforcement", { enabled }),
};

/** Daily quests (owner `challenges`): `{ dailyQuest: { first: { endsAt, quests: [{ key, title, description, unit, target, progress, completed }] } } }`. */
export const quests = {
  list: () => get("/user/quests"),
};

/** The caller's medals: `{ medalCount, total, medals: [{ key, title, unlocked, unlockedAt, rule: { description }, progress: { current, target } }] }`. */
export const medals = {
  mine: () => get("/user/medals"),
};

/**
 * Daily Reload and Pre-Monthly bonus (owner `bonus`). `overview`: `{ vipLevel, DAILY_RELOAD, PRE_MONTHLY }`, each
 * `{ enabled, eligible, minVipLevel, open, opensAt, amount, currency, claimed, claimable }`; `calendar`: `{ enabled,
 * eligible, today, percent, days: [{ date, earnedUsd, claimedUsd, state }] }`.
 */
export const reloadRewards = {
  overview: () => get("/user/reload-rewards"),
  calendar: () => get("/user/reload-rewards/calendar"),
  claim: (program) => post(`/user/reload-rewards/${program}/claim`),
};

/**
 * GIS extras. `launchDemo` answers `{ url }` (signed in only); `freespins` is the caller's active free spins,
 * `{ total, freespins: [{ id, gameUuid, game: { uuid, name, provider, image }, quantity, quantityLeft, validUntil }] }`.
 * The jackpot figures are the provider's own payload, passed through unshaped.
 */
export const gis = {
  launchDemo: (gameUuid, device) => post("/casino/gis/launch-demo", { gameUuid, device }),
  freespins: () => get("/casino/gis/freespins/mine"),
  jackpots: () => get("/casino/gis/jackpots"),
  /** Public: the hub's jackpot info. */
  publicJackpots: () => get("/casino/catalogue/jackpots", { auth: false }),
};

/**
 * The deposit rollover. `progress`: `{ multiplier, target, wagered, remaining, met, locked }` (USD);
 * `tasks`: `{ tasks: [{ id, label, target, wagered, remaining, status, locked, since }] }`.
 */
export const wager = {
  progress: () => get("/user/wager/progress"),
  tasks: () => get("/user/wager/tasks"),
};

/**
 * The signed-in affiliate pages — `/affiliate/*`.
 *
 * The reference splits an affiliate's own numbers four ways: an overview, the
 * people they referred, their campaigns and their earnings. This backend has no
 * campaign object — a player has one referral code and that is the whole of it
 * — so Campaigns renders the single implicit campaign that code already is.
 */
export const affiliate = {
  /** `{ referralCode, referralLink }`. */
  referralInfo: () => get("/user/affiliate"),
  /** Attach the signed-in player to a referrer (code or username). */
  joinTeam: (referralCode, campaign) =>
    post("/user/affiliate/team/join", {
      referralCode,
      ...(campaign ? { campaign: String(campaign).trim().slice(0, 80) } : {}),
    }),
  /** `{ referralCode, total, members }` — who signed up under the code. */
  team: (query) => get("/user/affiliate/team", { query }),
  /** `{ total, totalAmount, rows }` — commission already credited. */
  rewards: (query) => get("/user/affiliate/rewards", { query }),
  /** `{ total, claimedTotal, currency, rows }` — unlocked rewards summary. */
  unclaimed: () => get("/user/affiliate/rewards/unclaimed"),
  claimAll: () => post("/user/affiliate/rewards/claim-all"),
  /** One kind's rewards, newest first: `{ total, rows: [{ id, kind, member, amount, currency, claimed, status, createdAt }] }`; `kind` is `referral` | `commission`. */
  rewardHistory: (query) => get("/user/affiliate/rewards/history", { query }),
  claimOne: (rewardId, kind) => post("/user/affiliate/rewards/claim", { rewardId, kind }),
};

export const rates = {
  all: () => get("/user/exchange-rate/rates", { auth: false }),
  convert: (from, to, amount) => get(`/user/exchange-rate/convert/${from}/${to}/${amount}`, { auth: false }),
};

/**
 * The wallet modal's surface.
 *
 * Two deposit routes exist and they are different products, not alternatives:
 *
 * - **Crypto** goes through CCPayment — `chains` lists the networks a coin can
 *   arrive on, and the address comes from the provider. Both refuse with
 *   `CRYPTO_PROVIDER_DISABLED` until `CCPAYMENT_*` is configured.
 * - **Fiat** is a bank transfer the operator publishes and the player claims:
 *   `bankDetails` returns where to send it, `POST /deposits/fiat` files the
 *   claim with a screenshot.
 *
 * There is no on-ramp module in any of the four services, so the modal's Buy
 * Crypto tab has nothing to call. Tips are `tips` below.
 */
export const funding = {
  /** Networks a coin can be deposited on. Public; needs the provider configured. */
  chains: () => get("/user/crypto/chains", { auth: false }),
  /** Provider metadata for one coin. `symbol` is required by the validator. */
  coin: (symbol) => get("/user/crypto/coins", { query: { symbol }, auth: false }),

  /** Where to send a fiat transfer — bank name, account, IFSC, UPI. */
  bankDetails: (coinType) => get(`/user/bank-details/${coinType}`),

  fiatDeposits: (query) => get("/user/deposits/fiat", { query }),
  createFiatDeposit: (body) => post("/user/deposits/fiat", body),

  /**
   * The owner's withdrawal gate for one currency: `{ ok, missing[], kyc, wager,
   * bonusForfeitRequired, bonusForfeitAllowed, … }`. The POST refuses with the
   * same reasons (403 FIAT_WITHDRAW_KYC_REQUIRED / WITHDRAW_WAGER_REQUIRED,
   * 409 BONUS_FORFEIT_REQUIRED), so this is what the form shows up front.
   */
  withdrawRequirements: (currency) => get("/user/withdrawals/requirements", { query: { currency } }),

  /** Saved payout accounts: `[{ id, method, accountHolderName, bankName, accountNumberMasked, ifscCode, upiId, isDefault }]`. */
  bankAccounts: () => get("/user/bank-accounts"),
  /** `{ method: "upi", accountHolderName, upiId }` or `{ method: "bank", accountHolderName, bankName?, accountNumber, ifscCode }`. */
  addBankAccount: (body) => post("/user/bank-accounts", body),

  fiatWithdrawals: (query) => get("/user/withdrawals/fiat", { query }),
  createFiatWithdrawal: (body) => post("/user/withdrawals/fiat", body),
  /** Only while `In Queue`; the held amount goes back to the balance (409 NOT_CANCELLABLE after). */
  cancelFiatWithdrawal: (withdrawalId) => post(`/user/withdrawals/fiat/${withdrawalId}/cancel`),

  /** The automatic gateway's offer — `/methods/f2pay` answers `{ methods: [{ method, currency }], payout: ["INR"] }`. */
  paymentMethods: (provider) => get(`/user/payments/methods/${provider}`),
  /** `{ provider, currency, amount, method }` → `{ reference, redirectUrl }`; the gateway's callback credits the wallet. */
  createDepositOrder: (body) => post("/user/payments/deposits", body),
  /** `{ provider, currency, amount, details: { account_name, account_number, bank_code }, forfeitBonus? }`; held now, settled or refunded by the callback. */
  createWithdrawalOrder: (body) => post("/user/payments/withdrawals", body),

  cryptoWithdrawals: (query) => get("/user/withdrawals/crypto", { query }),
  cryptoWithdrawalSummary: () => get("/user/withdrawals/crypto/summary"),

  /** Gateway orders, newest first: `[{ provider, flow, reference, amount, currency, status, rawStatus, createdAt }]`; `flow` `payin` | `payout`. */
  orders: (query) => get("/user/payments/orders", { query }),
  /** Asks the provider again; reported, never applied — answers the order plus `providerView`. */
  refreshOrder: (provider, reference) =>
    post(`/user/payments/orders/${provider}/${encodeURIComponent(reference)}/refresh`),
};

/**
 * Shuffle Wise — `/user/responsible-gambling`, the player's own breaks and limits.
 *
 * `GET /` answers `{ selfExclusions[], limits[] }` (only rows still in force).
 * `type` is `CASINO` | `SPORTS` | `PLATFORM`; `breakPeriod` is one of the
 * `BREAK_PERIODS` values in `lib/shuffleWise.js`; a limit is
 * `{ type: LOSS_LIMIT | WAGER_LIMIT, usdAmount, periodUnit: DAYS | WEEKS | MONTHS }`.
 */
export const responsibleGambling = {
  overview: () => get("/user/responsible-gambling"),
  cooldown: (type) => post("/user/responsible-gambling/self-exclusions/cooldown", { type }),
  selfExclude: (type, breakPeriod) => post("/user/responsible-gambling/self-exclusions", { type, breakPeriod }),
  createLimit: (body) => post("/user/responsible-gambling/limits", body),
  removeLimit: (id) => post(`/user/responsible-gambling/limits/${id}/remove`),
};

/**
 * The wallet modal's Tip tab — `POST /user/tip/send`.
 *
 * Body `{ toUsername, currency, amount, note?, requestId? }`; the sender is the
 * token's player. Refusals (`TIP_USER_NOT_FOUND`, `TIP_INSUFFICIENT_BALANCE`,
 * `TIP_OVER_DAILY_LIMIT`, …) carry player-readable messages.
 */
export const tips = {
  send: (body) => post("/user/tip/send", body),
  /** `{ rows: [{ id, direction: sent | received, counterparty: { id, name }, currency, amount, note, createdAt }], total }`; `limit` ≤ 100. */
  history: (query) => get("/user/tip/history", { query }),
  /** Recipient lookup: players whose name starts with `q` and who accept tips, `[{ id, name }]`. */
  users: (q) => get("/user/tip/users", { query: { q } }),
  /** `{ enabled, limits }` — `enabled` is whether this player accepts tips. */
  settings: () => get("/user/tip/settings"),
  setReceiving: (enabled) => patch("/user/tip/settings", { enabled }),
};

/**
 * The transactions page's deposit and withdrawal tabs.
 *
 * `transaction-history` is the module built for this screen, and it is the only
 * source that covers every rail: deposits union `ccdeposit` (crypto),
 * `fiat_deposits`, `apaydeposits` and `pay_in_transactions`; withdrawals union
 * the crypto, fiat and A-Pay payout tables. Each row arrives in ONE shape
 * whichever rail it came from:
 *
 *     { id, reference, amount, currency, status, details, date, method, type }
 *
 * `method` is the rail (`crypto`, `manual`, `apay`, `waypay`) and `type` is
 * what the reference's Method column prints (`Crypto`, `Fiat`).
 *
 * This replaces reading `/user/deposits/fiat` directly, which showed fiat only
 * — a crypto deposit was missing from the player's own history, which is
 * indistinguishable from having lost the money.
 */
export const history = {
  deposits: (query) => get("/user/history/deposits", { query }),
  withdrawals: (query) => get("/user/history/withdrawals", { query }),
  /** Both lists in one call, for a statement view. */
  combined: (query) => get("/user/history", { query }),
  /** Staff top-ups and take-backs: `{ id, amount, direction: credit | debit | unknown, transferType, note, createdAt }` (no currency). */
  transfers: (query) => get("/user/history/transfers", { query }),
  /** Per-currency sums, `[{ currency, count, total }]`, every status. */
  cryptoStats: () => get("/user/history/crypto/stats"),
  fiatStats: () => get("/user/history/fiat/stats"),
  withdrawalStats: () => get("/user/history/withdrawals/stats"),
};
