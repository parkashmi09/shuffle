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

/** One request per page load, shared by every caller; a failure is not kept, so the next caller retries. */
const once = (fn) => {
  let p = null;
  return () => (p ??= fn().catch((e) => { p = null; throw e; }));
};

export const auth = {
  login: (identifier, password, extra) => post("/user/auth/login", { identifier, password, ...extra }, { auth: false }),
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
  update: (body) => put("/user/profile", body),
  /** Needs a 6-digit code the player has already been sent. */
  changeEmail: (email, code) => post("/user/profile/change-email", { email, code }),
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
 * issued, which is a different product with no screen here.
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
  confirm: (code) => post("/user/2fa/setup-verify", { code }),
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
 * Opening a provider game — jsGames v2 (`gamesv2.ibitplay.com`).
 *
 * ── WHAT THE BACKEND DOES WITH THIS ──────────────────────────────────────
 *
 * `POST /casino/js-games/v2/launch` takes the game and the currency and
 * NOTHING ELSE that identifies a player: the user id comes from the bearer
 * token, and the credit the provider is told about comes from that player's
 * real balance. The legacy route took `user_id` in the body, so anyone could
 * open a session as anyone.
 *
 * It answers `{ gameLaunchUrl, sessionToken }`. The URL is the provider's own
 * — Spribe, Evolution and the rest each host their own client — and it is what
 * goes in the iframe. The token is the session the provider quotes back on
 * every bet callback, and the backend has already written it to
 * `game_sessions` by the time this resolves.
 *
 * `gameUid` is the catalogue's `uuid`: `gisgamesnew.uuid` IS the provider's
 * `game_uid` for all 1,980 rows, so the uuid in the page URL is the launch key
 * and no second lookup is needed.
 *
 * ── CURRENCY ─────────────────────────────────────────────────────────────
 *
 * The backend accepts `INR`, `USDT` and `USD`. Only INR currently launches:
 * the operator account is INR-only upstream and the other two come back
 * `Game launch failed`. See `LAUNCH_CURRENCIES` in `GamePage`.
 */
export const jsGames = {
  launch: (gameUid, currencyCode, language) =>
    post("/casino/js-games/v2/launch", { gameUid, currencyCode, ...(language ? { language } : {}) }),
  /** The caller's own rounds at this provider. */
  history: () => get("/casino/js-games/v2/history"),
};

/** The site's races — `GET /user/race/:type/leaderboard` (`daily` | `weekly` | `monthly`), public. */
export const race = {
  /** `{ endsAt, payoutNetPrizePool, payoutCurrency, leaderboard: [{ rank, name, points, usdWagered, payout }], me }`. */
  leaderboard: (type = "weekly") => get(`/user/race/${type}/leaderboard`),
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
  banners: () => get("/admin/banners", { auth: false }),
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
  claimOne: (rewardId) => post("/user/affiliate/rewards/claim", { rewardId }),
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

  cryptoWithdrawals: (query) => get("/user/withdrawals/crypto", { query }),
  cryptoWithdrawalSummary: () => get("/user/withdrawals/crypto/summary"),
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
};
